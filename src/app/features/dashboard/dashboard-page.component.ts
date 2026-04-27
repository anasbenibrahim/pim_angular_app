import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, UserRole } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { AdminService, AdminUserListItem, VolunteerSignupAdminItem } from '../../core/services/admin.service';
import { DashboardOverviewComponent } from './components/dashboard-overview/dashboard-overview.component';
import { DoctorAppointmentsHistoryComponent } from './components/doctor-appointments-history/doctor-appointments-history.component';
import { DoctorClinicalMessagingComponent } from './components/doctor-clinical-messaging/doctor-clinical-messaging.component';
import { DoctorClinicalWorkspaceComponent } from './components/doctor-clinical-workspace/doctor-clinical-workspace.component';
import { DoctorDashboardComponent } from './components/doctor-dashboard/doctor-dashboard.component';
import { DoctorsValidationComponent } from './components/doctors-validation/doctors-validation.component';
import { LiveMapComponent } from './components/live-map/live-map.component';
import { UsersManagementComponent } from './components/users-management/users-management.component';
import { VolunteersValidationComponent } from './components/volunteers-validation/volunteers-validation.component';

type DashboardSection =
  | 'dashboard'
  | 'appointments-history'
  | 'shared-care-plan'
  | 'clinical-messaging'
  | 'users'
  | 'volunteers'
  | 'doctors'
  | 'map';

interface SectionConfig {
  key: DashboardSection;
  title: string;
  subtitle: string;
  icon: string;
  roles: UserRole[];
}

interface HeaderNotificationItem {
  id: string;
  title: string;
  time: string;
  icon: string;
  color: 'green' | 'red' | 'blue';
  createdAtMs: number;
}

type HeaderPeriodFilterKey = 'today' | '7d' | '30d' | 'month' | 'all';

interface HeaderPeriodFilterOption {
  key: HeaderPeriodFilterKey;
  label: string;
  shortLabel: string;
  description: string;
}

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
  imports: [
    CommonModule,
    DashboardOverviewComponent,
    DoctorDashboardComponent,
    DoctorAppointmentsHistoryComponent,
    DoctorClinicalWorkspaceComponent,
    DoctorClinicalMessagingComponent,
    UsersManagementComponent,
    VolunteersValidationComponent,
    DoctorsValidationComponent,
    LiveMapComponent
  ],
  standalone: true
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  private readonly themeService = inject(ThemeService);
  private readonly adminService = inject(AdminService);
  private readonly hostElementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private notificationsPollTimer: number | null = null;
  private dayRefreshTimer: number | null = null;
  private readonly maxNotifications = 8;
  private static readonly HEADER_PERIOD_STORAGE_KEY = 'hopeup_admin_header_period_filter';

  role: UserRole = 'admin';
  displayName = 'Utilisateur';
  userEmail = '';
  activeSection: DashboardSection = 'dashboard';
  sidebarCollapsed = false;
  searchTerm = '';
  showNotifications = false;
  currentDayLabel = '';
  currentLocationLabel = 'Localisation...';
  notificationsLoading = false;
  notificationsError = '';
  showPeriodFilterMenu = false;
  selectedPeriodFilter: HeaderPeriodFilterKey = '7d';

  readonly periodFilterOptions: HeaderPeriodFilterOption[] = [
    { key: 'today', label: 'Aujourd’hui', shortLabel: 'Aujourd’hui', description: 'Événements depuis minuit' },
    { key: '7d', label: '7 derniers jours', shortLabel: '7 jours', description: 'Vue recommandée pour le suivi quotidien' },
    { key: '30d', label: '30 derniers jours', shortLabel: '30 jours', description: 'Suivi opérationnel mensuel' },
    { key: 'month', label: 'Ce mois', shortLabel: 'Ce mois', description: 'Du 1er jour du mois à maintenant' },
    { key: 'all', label: 'Tout', shortLabel: 'Tout', description: 'Aucun filtre temporel' }
  ];

  readonly sectionConfigs: SectionConfig[] = [
    {
      key: 'dashboard',
      title: 'Dashboard',
      subtitle: 'Vue globale des opérations et alertes de la plateforme.',
      icon: 'ri-dashboard-3-line',
      roles: ['admin', 'volunteer', 'doctor']
    },
    {
      key: 'appointments-history',
      title: 'Historique RDV',
      subtitle: 'Liste des rendez-vous traités (acceptés et rejetés).',
      icon: 'ri-file-list-3-line',
      roles: ['doctor']
    },
    {
      key: 'shared-care-plan',
      title: 'Plan de soin',
      subtitle: 'Patients acceptés, plan de soin personnalisé, tâches, rendez-vous et rapport.',
      icon: 'ri-clipboard-line',
      roles: ['doctor']
    },
    {
      key: 'clinical-messaging',
      title: 'Messagerie',
      subtitle: 'Messagerie doctor-patient sécurisée avec interface type WhatsApp.',
      icon: 'ri-message-3-line',
      roles: ['doctor']
    },
    {
      key: 'users',
      title: 'Gestion des utilisateurs',
      subtitle: 'Gestion des patients, familles et volontaires du système.',
      icon: 'ri-user-3-line',
      roles: ['admin']
    },
    {
      key: 'volunteers',
      title: 'Validation volontaires',
      subtitle: 'Analyse des dossiers et décision de validation.',
      icon: 'ri-heart-pulse-line',
      roles: ['admin']
    },
    {
      key: 'doctors',
      title: 'Validation doctors',
      subtitle: 'Analyse des dossiers doctors et décision de validation.',
      icon: 'ri-stethoscope-line',
      roles: ['admin']
    },
    {
      key: 'map',
      title: 'Carte en temps réel',
      subtitle: 'Position et état opérationnel des patients suivis.',
      icon: 'ri-map-pin-2-line',
      roles: ['admin']
    }
  ];

  notifications: HeaderNotificationItem[] = [];

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) { }

  ngOnInit(): void {
    const session = this.authService.session;
    if (!session) {
      void this.router.navigate(['/auth']);
      return;
    }

    this.role = session.role;
    this.displayName = session.displayName;
    this.userEmail = session.email;
    this.activeSection = this.visibleSections[0]?.key ?? 'dashboard';
    this.restorePeriodFilterPreference();
    this.refreshDateLabel();
    this.dayRefreshTimer = window.setInterval(() => this.refreshDateLabel(), 60_000);
    void this.loadDynamicHeaderLocation();
    if (this.role === 'admin') {
      void this.refreshNotifications();
      this.notificationsPollTimer = window.setInterval(() => {
        void this.refreshNotifications();
      }, 15_000);
    }
  }

  ngOnDestroy(): void {
    if (this.notificationsPollTimer !== null) {
      window.clearInterval(this.notificationsPollTimer);
      this.notificationsPollTimer = null;
    }
    if (this.dayRefreshTimer !== null) {
      window.clearInterval(this.dayRefreshTimer);
      this.dayRefreshTimer = null;
    }
  }

  get isDark(): boolean {
    return this.themeService.isDark;
  }

  get visibleSections(): SectionConfig[] {
    return this.sectionConfigs.filter((section) => section.roles.includes(this.role));
  }

  get activeConfig(): SectionConfig {
    return (
      this.visibleSections.find((section) => section.key === this.activeSection) ?? this.visibleSections[0]
    );
  }

  get userInitials(): string {
    const parts = this.displayName.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return this.displayName.slice(0, 2).toUpperCase();
  }

  get notificationCount(): number {
    return this.notifications.length;
  }

  get selectedPeriodFilterOption(): HeaderPeriodFilterOption {
    return this.periodFilterOptions.find((option) => option.key === this.selectedPeriodFilter) ?? this.periodFilterOptions[1];
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  selectSection(section: DashboardSection): void {
    const allowed = this.visibleSections.some((item) => item.key === section);
    this.activeSection = allowed ? section : (this.visibleSections[0]?.key ?? 'dashboard');
    this.showNotifications = false;
    this.showPeriodFilterMenu = false;
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.showPeriodFilterMenu = false;
    }
    if (this.showNotifications && this.role === 'admin') {
      void this.refreshNotifications();
    }
  }

  togglePeriodFilterMenu(): void {
    this.showPeriodFilterMenu = !this.showPeriodFilterMenu;
    if (this.showPeriodFilterMenu) {
      this.showNotifications = false;
    }
  }

  async selectPeriodFilter(option: HeaderPeriodFilterOption): Promise<void> {
    this.selectedPeriodFilter = option.key;
    this.showPeriodFilterMenu = false;
    this.persistPeriodFilterPreference();
    if (this.role === 'admin') {
      await this.refreshNotifications();
    }
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/auth']);
  }

  openProfile(): void {
    void this.router.navigate(['/profile']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) {
      return;
    }
    const host = this.hostElementRef.nativeElement;
    const clickedInsidePeriodFilter = !!(target instanceof Element && target.closest('.period-filter'));
    const clickedInsideNotifications = !!(target instanceof Element && target.closest('.notification-wrapper'));
    if (this.showPeriodFilterMenu && !clickedInsidePeriodFilter && host.contains(target)) {
      this.showPeriodFilterMenu = false;
    }
    if (this.showNotifications && !clickedInsideNotifications && host.contains(target)) {
      this.showNotifications = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    this.showPeriodFilterMenu = false;
    this.showNotifications = false;
  }

  private refreshDateLabel(): void {
    this.currentDayLabel = new Intl.DateTimeFormat('fr-FR', { day: '2-digit' }).format(new Date());
  }

  private async loadDynamicHeaderLocation(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.currentLocationLabel = 'Localisation indisponible';
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 7000,
          maximumAge: 10 * 60 * 1000
        });
      });

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'fr'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        address?: {
          city?: string;
          town?: string;
          village?: string;
          state?: string;
          county?: string;
          country_code?: string;
        };
      };

      const address = payload.address ?? {};
      const city = address.city ?? address.town ?? address.village ?? address.state ?? address.county;
      const countryCode = address.country_code?.toUpperCase();
      if (city && countryCode) {
        this.currentLocationLabel = `${city}, ${countryCode}`;
        return;
      }
      if (city) {
        this.currentLocationLabel = city;
        return;
      }
      this.currentLocationLabel = 'Position détectée';
    } catch {
      this.currentLocationLabel = 'Localisation indisponible';
    }
  }

  private async refreshNotifications(): Promise<void> {
    if (this.role !== 'admin') {
      this.notifications = [];
      return;
    }

    this.notificationsLoading = true;
    this.notificationsError = '';
    try {
      const [users, signups] = await Promise.all([
        this.adminService.getAllUsers(),
        this.adminService.getVolunteerSignups()
      ]);
      const nextNotifications = this.buildNotifications(users, signups);
      // Defer binding updates to avoid NG0100 when dev mode re-checks after async resolution.
      window.setTimeout(() => {
        this.notifications = nextNotifications;
        this.notificationsError = '';
        this.notificationsLoading = false;
      });
    } catch (error) {
      window.setTimeout(() => {
        this.notificationsError = error instanceof Error ? error.message : 'Impossible de charger les notifications.';
        this.notificationsLoading = false;
      });
    }
  }

  private buildNotifications(users: AdminUserListItem[], signups: VolunteerSignupAdminItem[]): HeaderNotificationItem[] {
    const now = Date.now();
    const periodStartMs = this.getSelectedPeriodStartMs(now);
    const notifications: HeaderNotificationItem[] = [];

    for (const signup of signups) {
      if (signup.status !== 'PENDING') {
        continue;
      }
      const createdAtMs = this.parseDateMs(signup.createdAt);
      if (createdAtMs === null) {
        continue;
      }
      notifications.push({
        id: `signup-${signup.signupRequestId}`,
        title: `Nouvelle demande volontaire: ${this.composeName(signup.prenom, signup.nom)}`,
        time: this.formatRelativeTime(createdAtMs, now),
        icon: 'ri-user-add-line',
        color: 'blue',
        createdAtMs
      });
    }

    for (const user of users) {
      if (user.role !== 'PATIENT' && user.role !== 'FAMILY_MEMBER') {
        continue;
      }
      const createdAtMs = this.parseDateMs(user.createdAt);
      if (createdAtMs === null) {
        continue;
      }
      const roleLabel = user.role === 'PATIENT' ? 'Nouveau patient' : 'Nouveau membre famille';
      notifications.push({
        id: `user-${user.id}-${user.role}`,
        title: `${roleLabel}: ${this.composeName(user.prenom, user.nom)}`,
        time: this.formatRelativeTime(createdAtMs, now),
        icon: user.role === 'PATIENT' ? 'ri-heart-pulse-line' : 'ri-group-line',
        color: 'green',
        createdAtMs
      });
    }

    return notifications
      .filter((item) => periodStartMs === null || item.createdAtMs >= periodStartMs)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, this.maxNotifications);
  }

  private getSelectedPeriodStartMs(nowMs: number): number | null {
    const now = new Date(nowMs);
    switch (this.selectedPeriodFilter) {
      case 'today': {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return start.getTime();
      }
      case '7d':
        return nowMs - (7 * 24 * 60 * 60 * 1000);
      case '30d':
        return nowMs - (30 * 24 * 60 * 60 * 1000);
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return start.getTime();
      }
      case 'all':
        return null;
    }
  }

  private parseDateMs(value: string | null | undefined): number | null {
    if (!value || !value.trim()) {
      return null;
    }
    const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private formatRelativeTime(timestampMs: number, nowMs: number): string {
    const diffMs = Math.max(0, nowMs - timestampMs);
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) {
      return 'À l’instant';
    }
    if (minutes < 60) {
      return `Il y a ${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `Il y a ${hours} h`;
    }
    const days = Math.floor(hours / 24);
    return `Il y a ${days} j`;
  }

  private composeName(prenom: string | null | undefined, nom: string | null | undefined): string {
    const full = `${prenom ?? ''} ${nom ?? ''}`.trim();
    return full || 'Utilisateur';
  }

  private restorePeriodFilterPreference(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const stored = localStorage.getItem(DashboardPageComponent.HEADER_PERIOD_STORAGE_KEY);
    if (stored && this.periodFilterOptions.some((option) => option.key === stored)) {
      this.selectedPeriodFilter = stored as HeaderPeriodFilterKey;
    }
  }

  private persistPeriodFilterPreference(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(DashboardPageComponent.HEADER_PERIOD_STORAGE_KEY, this.selectedPeriodFilter);
  }
}
