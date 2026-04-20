import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import {
  AddictionType,
  AdminCreateUserPayload,
  AdminService,
  AdminUpdateUserPayload,
  AdminUserListItem,
  ApiUserRole,
  VolunteerPatientAssignment
} from '../../../../core/services/admin.service';

type UserType = 'Patient' | 'Famille' | 'Volontaire' | 'Doctor';
type UserStatus = 'Actif' | 'En attente' | 'Suspendu';

interface UserItem {
  id: number;
  initials: string;
  name: string;
  email: string;
  type: UserType;
  status: UserStatus;
  registeredAt: string;
  role: Extract<ApiUserRole, 'PATIENT' | 'FAMILY_MEMBER' | 'VOLONTAIRE' | 'DOCTOR'>;
  nom: string;
  prenom: string;
  age: number;
  referralCode?: string | null;
  volunteerAddictionSpecialties: AddictionType[];
}

type ToastKind = 'success' | 'error' | 'info';

interface ToastMessage {
  kind: ToastKind;
  text: string;
}

interface VolunteerAssignmentsGroup {
  volunteer: UserItem;
  assignments: VolunteerPatientAssignment[];
}

@Component({
  selector: 'app-users-management',
  templateUrl: './users-management.component.html',
  styleUrl: './users-management.component.css',
  standalone: false
})
export class UsersManagementComponent implements OnInit, OnDestroy {
  private autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;

  searchTerm = '';
  selectedType: 'Tous' | UserType = 'Tous';

  isLoading = false;
  isActionLoading = false;
  errorMessage = '';
  successMessage = '';
  toast: ToastMessage | null = null;
  assignmentErrorMessage = '';
  assignmentsLoading = false;

  showCreateForm = false;
  editingUserId: number | null = null;
  deleteCandidate: UserItem | null = null;
  editingUserRole: Extract<ApiUserRole, 'PATIENT' | 'FAMILY_MEMBER' | 'VOLONTAIRE' | 'DOCTOR'> | null = null;

  users: UserItem[] = [];
  volunteerAssignments: VolunteerAssignmentsGroup[] = [];

  readonly addictionTypes: AddictionType[] = ['ALCOHOL', 'COCAINE', 'OPIATES', 'OTHER'];

  readonly createModel: {
    email: string;
    password: string;
    nom: string;
    prenom: string;
    role: Extract<ApiUserRole, 'PATIENT' | 'FAMILY_MEMBER' | 'VOLONTAIRE'>;
    age: number;
    referralKey: string;
    dateNaissance: string;
    sobrietyDate: string;
    addiction: AddictionType;
    volunteerAddictionSpecialties: AddictionType[];
  } = {
    email: '',
    password: '',
    nom: '',
    prenom: '',
    role: 'VOLONTAIRE',
    age: 25,
    referralKey: '',
    dateNaissance: '',
    sobrietyDate: '',
    addiction: 'ALCOHOL',
    volunteerAddictionSpecialties: []
  };

  readonly editModel: {
    nom: string;
    prenom: string;
    age: number;
    volunteerAddictionSpecialties: AddictionType[];
  } = {
    nom: '',
    prenom: '',
    age: 25,
    volunteerAddictionSpecialties: []
  };

  constructor(
    private readonly adminService: AdminService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
    this.autoRefreshTimer = setInterval(() => {
      if (this.isActionLoading) {
        return;
      }
      void this.loadUsers(false, true);
    }, 10000);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  get filteredUsers(): UserItem[] {
    const normalizedTerm = this.searchTerm.trim().toLowerCase();

    return this.users.filter((user) => {
      const matchesType = this.selectedType === 'Tous' || user.type === this.selectedType;
      const matchesTerm =
        normalizedTerm === '' ||
        user.name.toLowerCase().includes(normalizedTerm) ||
        user.email.toLowerCase().includes(normalizedTerm);

      return matchesType && matchesTerm;
    });
  }

  get isCreatePatient(): boolean {
    return this.createModel.role === 'PATIENT';
  }

  get isCreateFamilyMember(): boolean {
    return this.createModel.role === 'FAMILY_MEMBER';
  }

  get isCreateVolunteer(): boolean {
    return this.createModel.role === 'VOLONTAIRE';
  }

  get isEditingVolunteer(): boolean {
    return this.editingUserRole === 'VOLONTAIRE';
  }

  get totalUsers(): number {
    return this.users.length;
  }

  get totalPatients(): number {
    return this.users.filter((user) => user.type === 'Patient').length;
  }

  get totalFamilies(): number {
    return this.users.filter((user) => user.type === 'Famille').length;
  }

  get totalVolunteers(): number {
    return this.users.filter((user) => user.type === 'Volontaire').length;
  }

  get totalDoctors(): number {
    return this.users.filter((user) => user.type === 'Doctor').length;
  }

  get totalAssignedPatients(): number {
    return this.volunteerAssignments.reduce((sum, item) => sum + item.assignments.length, 0);
  }

  async manualRefresh(): Promise<void> {
    await this.loadUsers();
    this.showToast('success', 'Liste des utilisateurs synchronisée.');
  }

  typeBadgeClass(type: UserType): string {
    if (type === 'Patient') {
      return 'type-patient';
    }

    if (type === 'Famille') {
      return 'type-family';
    }

    if (type === 'Doctor') {
      return 'type-doctor';
    }

    return 'type-volunteer';
  }

  statusBadgeClass(status: UserStatus): string {
    if (status === 'Actif') {
      return 'status-active';
    }

    if (status === 'En attente') {
      return 'status-pending';
    }

    return 'status-suspended';
  }

  trackById(_: number, item: UserItem): number {
    return item.id;
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    this.successMessage = '';
    this.errorMessage = '';
    if (!this.showCreateForm) {
      this.resetCreateForm();
    }
  }

  startEdit(user: UserItem): void {
    this.editingUserId = user.id;
    this.editingUserRole = user.role;
    this.editModel.nom = user.nom;
    this.editModel.prenom = user.prenom;
    this.editModel.age = user.age;
    this.editModel.volunteerAddictionSpecialties = [...user.volunteerAddictionSpecialties];
    this.successMessage = '';
    this.errorMessage = '';
  }

  cancelEdit(): void {
    this.editingUserId = null;
    this.editingUserRole = null;
    this.editModel.nom = '';
    this.editModel.prenom = '';
    this.editModel.age = 25;
    this.editModel.volunteerAddictionSpecialties = [];
  }

  viewUser(user: UserItem): void {
    this.successMessage = `Détails: ${user.name} (${user.email}) - ${user.type}`;
    this.errorMessage = '';
    this.showToast('info', `Détails disponibles pour ${user.name}.`);
  }

  async createUser(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    const validationError = this.validateCreateModel();
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.isActionLoading = true;

    try {
      const payload: AdminCreateUserPayload = {
        email: this.createModel.email.trim().toLowerCase(),
        password: this.createModel.password,
        nom: this.createModel.nom.trim(),
        prenom: this.createModel.prenom.trim(),
        role: this.createModel.role,
        age: this.createModel.age,
        referralKey: this.isCreateFamilyMember ? this.createModel.referralKey.trim() : null,
        dateNaissance: this.isCreatePatient ? this.createModel.dateNaissance : null,
        sobrietyDate: this.isCreatePatient ? this.createModel.sobrietyDate : null,
        addiction: this.isCreatePatient ? this.createModel.addiction : null
        ,
        volunteerAddictionSpecialties: this.isCreateVolunteer
          ? [...this.createModel.volunteerAddictionSpecialties]
          : null
      };

      await this.adminService.createUser(payload);
      this.successMessage = 'Utilisateur créé avec succès.';
      this.showToast('success', 'Utilisateur créé avec succès.');
      this.showCreateForm = false;
      this.resetCreateForm();
      await this.loadUsers();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec de création utilisateur.';
      this.showToast('error', this.errorMessage);
    } finally {
      this.isActionLoading = false;
    }
  }

  async updateUser(): Promise<void> {
    if (this.editingUserId === null) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    if (this.editModel.nom.trim().length < 2 || this.editModel.prenom.trim().length < 2) {
      this.errorMessage = 'Nom et prénom doivent contenir au moins 2 caractères.';
      return;
    }

    if (!Number.isFinite(this.editModel.age) || this.editModel.age < 1 || this.editModel.age > 150) {
      this.errorMessage = 'Âge invalide.';
      return;
    }

    if (this.isEditingVolunteer && this.editModel.volunteerAddictionSpecialties.length === 0) {
      this.errorMessage = 'Sélectionne au moins une spécialité addiction pour le volontaire.';
      return;
    }

    this.isActionLoading = true;

    try {
      const payload: AdminUpdateUserPayload = {
        nom: this.editModel.nom.trim(),
        prenom: this.editModel.prenom.trim(),
        age: this.editModel.age,
        volunteerAddictionSpecialties: this.isEditingVolunteer
          ? [...this.editModel.volunteerAddictionSpecialties]
          : null
      };

      await this.adminService.updateUser(this.editingUserId, payload);
      this.successMessage = 'Utilisateur mis à jour avec succès.';
      this.showToast('success', 'Utilisateur mis à jour avec succès.');
      this.cancelEdit();
      await this.loadUsers();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec de mise à jour.';
      this.showToast('error', this.errorMessage);
    } finally {
      this.isActionLoading = false;
    }
  }

  deleteUser(user: UserItem): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.deleteCandidate = user;
  }

  cancelDelete(): void {
    this.deleteCandidate = null;
  }

  async confirmDelete(): Promise<void> {
    const user = this.deleteCandidate;
    if (!user) {
      return;
    }

    this.isActionLoading = true;

    try {
      await this.adminService.deleteUser(user.id);
      this.successMessage = 'Utilisateur supprimé avec succès.';
      this.showToast('success', `Utilisateur supprimé: ${user.name}`);
      if (this.editingUserId === user.id) {
        this.cancelEdit();
      }
      this.deleteCandidate = null;
      window.location.reload();
      return;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec de suppression.';
      this.showToast('error', this.errorMessage);
    } finally {
      this.isActionLoading = false;
    }
  }

  private async loadUsers(showLoader = true, silent = false): Promise<void> {
    this.runInAngular(() => {
      if (showLoader) {
        this.isLoading = true;
      }
      if (!silent) {
        this.errorMessage = '';
      }
    });

    try {
      const rawUsers = await this.adminService.getAllUsers();
      const mappedUsers = rawUsers
        .filter((user) =>
          user.role === 'PATIENT' ||
          user.role === 'FAMILY_MEMBER' ||
          user.role === 'VOLONTAIRE' ||
          user.role === 'DOCTOR'
        )
        .map((user) => this.mapUser(user));
      this.runInAngular(() => {
        this.users = mappedUsers;
      });

      await this.loadVolunteerAssignments(mappedUsers, silent);
    } catch (error) {
      if (!silent) {
        this.runInAngular(() => {
          this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les utilisateurs.';
          this.volunteerAssignments = [];
        });
      }
    } finally {
      this.runInAngular(() => {
        this.isLoading = false;
      });
    }
  }

  private mapUser(user: AdminUserListItem): UserItem {
    const name = `${user.prenom} ${user.nom}`.trim();
    const createdAt = this.formatDate(user.createdAt);

    return {
      id: user.id,
      initials: this.buildInitials(user.prenom, user.nom),
      name,
      email: user.email,
      type: this.mapUserType(user),
      status: this.mapStatus(user),
      registeredAt: createdAt,
      role: user.role as Extract<ApiUserRole, 'PATIENT' | 'FAMILY_MEMBER' | 'VOLONTAIRE' | 'DOCTOR'>,
      nom: user.nom,
      prenom: user.prenom,
      age: user.age ?? 0,
      referralCode: user.referralCode ?? null,
      volunteerAddictionSpecialties: [...(user.volunteerAddictionSpecialties ?? [])]
    };
  }

  private mapUserType(user: AdminUserListItem): UserType {
    if (user.role === 'PATIENT') {
      return 'Patient';
    }
    if (user.role === 'FAMILY_MEMBER') {
      return 'Famille';
    }
    if (user.role === 'DOCTOR') {
      return 'Doctor';
    }
    return 'Volontaire';
  }

  private mapStatus(user: AdminUserListItem): UserStatus {
    if (user.role === 'VOLONTAIRE') {
      const createdAt = new Date(user.createdAt);
      const elapsedHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      if (elapsedHours <= 24) {
        return 'En attente';
      }
    }
    return 'Actif';
  }

  private async loadVolunteerAssignments(users: UserItem[], silent: boolean): Promise<void> {
    const volunteers = users.filter((user) => user.role === 'VOLONTAIRE');

    if (volunteers.length === 0) {
      this.runInAngular(() => {
        this.volunteerAssignments = [];
        this.assignmentsLoading = false;
        this.assignmentErrorMessage = '';
      });
      return;
    }

    this.runInAngular(() => {
      this.assignmentsLoading = true;
      if (!silent) {
        this.assignmentErrorMessage = '';
      }
    });

    try {
      const groups = await Promise.all(
        volunteers.map(async (volunteer) => {
          try {
            const assignments = await this.adminService.getVolunteerAssignments(volunteer.id);
            return { volunteer, assignments };
          } catch {
            return { volunteer, assignments: [] as VolunteerPatientAssignment[] };
          }
        })
      );

      this.runInAngular(() => {
        this.volunteerAssignments = groups.sort((left, right) =>
          left.volunteer.name.localeCompare(right.volunteer.name)
        );
      });
    } catch (error) {
      if (!silent) {
        this.runInAngular(() => {
          this.assignmentErrorMessage =
            error instanceof Error
              ? error.message
              : 'Impossible de charger la relation volontaires-patients.';
        });
      }
    } finally {
      this.runInAngular(() => {
        this.assignmentsLoading = false;
      });
    }
  }

  formatAssignmentDate(value: string): string {
    if (!value) {
      return '-';
    }
    const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private validateCreateModel(): string | null {
    if (!this.createModel.email.trim() || !this.createModel.nom.trim() || !this.createModel.prenom.trim()) {
      return 'Email, nom et prénom sont obligatoires.';
    }

    if (this.createModel.password.length < 6) {
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    }

    if (this.createModel.age < 1 || this.createModel.age > 150) {
      return 'Âge invalide.';
    }

    if (this.isCreatePatient) {
      if (!this.createModel.dateNaissance || !this.createModel.sobrietyDate) {
        return 'Date de naissance et date de sobriété sont obligatoires pour un patient.';
      }
    }

    if (this.isCreateFamilyMember && !this.createModel.referralKey.trim()) {
      return 'Referral key obligatoire pour un membre famille.';
    }

    if (this.isCreateVolunteer && this.createModel.volunteerAddictionSpecialties.length === 0) {
      return 'Sélectionne au moins une spécialité addiction pour le volontaire.';
    }

    return null;
  }

  private resetCreateForm(): void {
    this.createModel.email = '';
    this.createModel.password = '';
    this.createModel.nom = '';
    this.createModel.prenom = '';
    this.createModel.role = 'VOLONTAIRE';
    this.createModel.age = 25;
    this.createModel.referralKey = '';
    this.createModel.dateNaissance = '';
    this.createModel.sobrietyDate = '';
    this.createModel.addiction = 'ALCOHOL';
    this.createModel.volunteerAddictionSpecialties = [];
  }

  addictionLabel(value: AddictionType): string {
    switch (value) {
      case 'ALCOHOL':
        return 'Alcool';
      case 'COCAINE':
        return 'Cocaïne';
      case 'OPIATES':
        return 'Opiacés';
      case 'OTHER':
      default:
        return 'Autre';
    }
  }

  isCreateSpecialtySelected(type: AddictionType): boolean {
    return this.createModel.volunteerAddictionSpecialties.includes(type);
  }

  toggleCreateVolunteerSpecialty(type: AddictionType): void {
    this.createModel.volunteerAddictionSpecialties = this.toggleInArray(
      this.createModel.volunteerAddictionSpecialties,
      type
    );
  }

  isEditSpecialtySelected(type: AddictionType): boolean {
    return this.editModel.volunteerAddictionSpecialties.includes(type);
  }

  toggleEditVolunteerSpecialty(type: AddictionType): void {
    this.editModel.volunteerAddictionSpecialties = this.toggleInArray(
      this.editModel.volunteerAddictionSpecialties,
      type
    );
  }

  private toggleInArray(values: AddictionType[], value: AddictionType): AddictionType[] {
    const next = new Set(values);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return this.addictionTypes.filter((type) => next.has(type));
  }

  private formatDate(dateIso: string): string {
    const parsed = new Date(dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(parsed);
  }

  private buildInitials(prenom: string, nom: string): string {
    const p = prenom.trim().charAt(0);
    const n = nom.trim().charAt(0);
    return `${p}${n}`.toUpperCase();
  }

  private runInAngular(fn: () => void): void {
    if (this.isDestroyed) {
      return;
    }
    this.ngZone.run(() => {
      if (this.isDestroyed) {
        return;
      }
      fn();
      this.cdr.detectChanges();
    });
  }

  private showToast(kind: ToastKind, text: string): void {
    this.runInAngular(() => {
      this.toast = { kind, text };
      if (this.toastTimer) {
        clearTimeout(this.toastTimer);
        this.toastTimer = null;
      }
      this.toastTimer = setTimeout(() => {
        this.runInAngular(() => {
          this.toast = null;
        });
      }, 3000);
    });
  }
}
