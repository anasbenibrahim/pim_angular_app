import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { AdminPatientLocation, AdminService } from '../../../../core/services/admin.service';

declare const L: any;

type MarkerStatus = 'active' | 'monitoring' | 'inactive' | 'offline';
type FilterType = 'all' | MarkerStatus;

interface PatientMapItem extends AdminPatientLocation {
  displayName: string;
  initials: string;
  status: MarkerStatus;
  lastUpdateLabel: string;
  profileImageUrl: string | null;
}

@Component({
  selector: 'app-live-map',
  templateUrl: './live-map.component.html',
  styleUrl: './live-map.component.css',
  imports: [CommonModule, FormsModule],
  standalone: true
})
export class LiveMapComponent implements AfterViewInit, OnDestroy {
  private readonly adminService = inject(AdminService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);

  private map: any | null = null;
  private markerLayer: any | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private wsClient: Client | null = null;
  private adminLiveSubscription: StompSubscription | null = null;
  private readonly defaultCenter: [number, number] = [36.8065, 10.1815];
  private didAutoFit = false;
  private patientImagesById = new Map<number, string | null>();

  loading = false;
  errorMessage = '';
  liveConnected = false;
  filter: FilterType = 'all';
  patients: PatientMapItem[] = [];

  get filteredPatients(): PatientMapItem[] {
    if (this.filter === 'all') {
      return this.patients;
    }
    return this.patients.filter((patient) => patient.status === this.filter);
  }

  get totalPatients(): number {
    return this.patients.length;
  }

  get locatedPatients(): number {
    return this.patients.filter((patient) => patient.lat !== null && patient.lon !== null).length;
  }

  get activePatients(): number {
    return this.patients.filter((patient) => patient.status === 'active').length;
  }

  get offlinePatients(): number {
    return this.patients.filter((patient) => patient.status === 'offline').length;
  }

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.initMap();
    await this.refreshLocations();
    this.connectLiveUpdates();
    this.refreshTimer = setInterval(() => {
      void this.refreshLocations(false);
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.liveConnected = false;
    this.adminLiveSubscription?.unsubscribe();
    this.adminLiveSubscription = null;
    void this.wsClient?.deactivate();
    this.wsClient = null;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  async onManualRefresh(): Promise<void> {
    await this.refreshLocations();
  }

  onFilterChange(): void {
    this.renderMarkers();
  }

  statusLabel(status: MarkerStatus): string {
    if (status === 'active') {
      return 'Actif';
    }
    if (status === 'monitoring') {
      return 'Surveillance';
    }
    if (status === 'inactive') {
      return 'Inactif';
    }
    return 'Hors ligne';
  }

  trackByPatientId(_: number, patient: PatientMapItem): number {
    return patient.patientId;
  }

  onPatientImageError(patientId: number): void {
    this.patientImagesById.set(patientId, null);
    this.patients = this.patients.map((patient) =>
      patient.patientId === patientId ? { ...patient, profileImageUrl: null } : patient
    );
    this.renderMarkers();
  }

  private initMap(): void {
    const mapElement = document.getElementById('admin-live-map');
    if (!mapElement || this.map) {
      return;
    }

    this.map = L.map(mapElement, {
      center: this.defaultCenter,
      zoom: 6,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 0);
  }

  private async refreshLocations(showLoader = true): Promise<void> {
    if (!this.map) {
      return;
    }

    if (showLoader) {
      this.loading = true;
    }
    this.errorMessage = '';

    try {
      const [response, users] = await Promise.all([
        this.adminService.getLatestPatientsLocations(),
        this.adminService.getAllUsers()
      ]);

      this.patientImagesById = new Map(
        users
          .filter((user) => user.role === 'PATIENT')
          .map((user) => [
            user.id,
            this.resolveFirstMediaUrl(user.profileImageUrl, user.facialImageUrl, user.cinFrontImageUrl)
          ])
      );

      this.patients = response
        .map((item) =>
          this.toPatientMapItem(
            item,
            this.resolvePatientImage(item, this.patientImagesById.get(item.patientId) ?? null)
          )
        )
        .sort((left, right) => left.displayName.localeCompare(right.displayName));

      this.renderMarkers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur de chargement de la carte.';
      this.errorMessage = message;
    } finally {
      this.loading = false;
    }
  }

  private connectLiveUpdates(): void {
    if (this.wsClient || !isPlatformBrowser(this.platformId)) {
      return;
    }

    const client = new Client({
      brokerURL: `${this.adminService.getWebSocketBaseUrl()}/ws`,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000
    });

    client.onConnect = () => {
      this.ngZone.run(() => {
        this.liveConnected = true;
        this.errorMessage = '';
        this.adminLiveSubscription?.unsubscribe();
        this.adminLiveSubscription = client.subscribe('/topic/admin/patients-locations', (message) => {
          this.onAdminLocationMessage(message);
        });
      });
    };

    client.onStompError = (frame) => {
      this.ngZone.run(() => {
        this.liveConnected = false;
        if (!this.errorMessage) {
          this.errorMessage = frame.headers['message'] || 'Erreur WebSocket STOMP.';
        }
      });
    };

    client.onWebSocketClose = () => {
      this.ngZone.run(() => {
        this.liveConnected = false;
      });
    };

    client.onWebSocketError = () => {
      this.ngZone.run(() => {
        this.liveConnected = false;
      });
    };

    client.activate();
    this.wsClient = client;
  }

  private onAdminLocationMessage(message: IMessage): void {
    try {
      const payload = JSON.parse(message.body) as AdminPatientLocation;
      if (!payload || typeof payload.patientId !== 'number') {
        return;
      }
      this.ngZone.run(() => {
        this.upsertRealtimePatient(payload);
      });
    } catch {
      // Ignore malformed frame; polling fallback will resync.
    }
  }

  private upsertRealtimePatient(payload: AdminPatientLocation): void {
    const profileImage = this.resolvePatientImage(
      payload,
      this.patientImagesById.get(payload.patientId) ??
        this.patients.find((item) => item.patientId === payload.patientId)?.profileImageUrl ??
        null
    );
    const nextItem = this.toPatientMapItem(payload, profileImage);
    const index = this.patients.findIndex((item) => item.patientId === payload.patientId);
    if (index >= 0) {
      const next = [...this.patients];
      next[index] = nextItem;
      this.patients = next.sort((left, right) => left.displayName.localeCompare(right.displayName));
    } else {
      this.patients = [...this.patients, nextItem].sort((left, right) =>
        left.displayName.localeCompare(right.displayName)
      );
    }

    this.renderMarkers();
  }

  private renderMarkers(): void {
    if (!this.map || !this.markerLayer) {
      return;
    }

    this.markerLayer.clearLayers();
    const located = this.filteredPatients.filter(
      (patient) => patient.lat !== null && patient.lon !== null
    );

    for (const patient of located) {
      const marker = L.marker([patient.lat, patient.lon], {
        icon: this.createMarkerIcon(patient)
      });

      marker.bindPopup(
        `<strong>${this.escapeHtml(patient.displayName)}</strong><br />
         Statut: ${this.statusLabel(patient.status)}<br />
         Dernière mise à jour: ${this.escapeHtml(patient.lastUpdateLabel)}`
      );

      marker.addTo(this.markerLayer);
    }

    if (located.length > 0 && !this.didAutoFit) {
      const bounds = L.latLngBounds(located.map((patient) => [patient.lat, patient.lon]));
      this.map.fitBounds(bounds, { padding: [30, 30] });
      this.didAutoFit = true;
    }
  }

  private createMarkerIcon(patient: PatientMapItem): any {
    const fallbackInitials = this.escapeHtml(patient.initials);
    const avatarContent = patient.profileImageUrl
      ? `<img src="${this.escapeHtml(patient.profileImageUrl)}" alt="${this.escapeHtml(patient.displayName)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"/><span class="avatar-fallback" style="display:none;">${fallbackInitials}</span>`
      : `<span class="avatar-fallback">${fallbackInitials}</span>`;

    return L.divIcon({
      className: 'patient-marker-wrapper',
      html: `
        <div class="patient-marker-shell ${patient.status}">
          <div class="patient-marker-label">${this.escapeHtml(patient.displayName)}</div>
          <div class="patient-marker-avatar">${avatarContent}</div>
          <div class="patient-marker-pin"></div>
        </div>
      `,
      iconSize: [148, 104],
      iconAnchor: [74, 90],
      popupAnchor: [0, -78]
    });
  }

  private toPatientMapItem(item: AdminPatientLocation, profileImageUrl: string | null): PatientMapItem {
    const displayName = `${item.prenom} ${item.nom}`.trim();
    const initials = this.buildInitials(displayName);
    const status = this.getStatus(item.timestamp);
    return {
      ...item,
      displayName,
      initials,
      status,
      lastUpdateLabel: this.formatLastUpdate(item.timestamp),
      profileImageUrl
    };
  }

  private resolvePatientImage(item: AdminPatientLocation, fallback: string | null): string | null {
    const fromPayload = this.resolveFirstMediaUrl(
      item.profileImageUrl,
      item.facialImageUrl,
      item.cinFrontImageUrl
    );
    if (fromPayload) {
      this.patientImagesById.set(item.patientId, fromPayload);
      return fromPayload;
    }
    return fallback;
  }

  private resolveFirstMediaUrl(...candidates: Array<string | null | undefined>): string | null {
    for (const candidate of candidates) {
      const resolved = this.adminService.resolveMediaUrl(candidate ?? null);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  private buildInitials(fullName: string): string {
    const parts = fullName
      .split(/\s+/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (parts.length === 0) {
      return 'P';
    }
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  private getStatus(timestamp: string | null): MarkerStatus {
    if (!timestamp) {
      return 'offline';
    }

    const lastUpdate = this.parseBackendTimestamp(timestamp);
    if (!lastUpdate) {
      return 'offline';
    }
    const minutes = (Date.now() - lastUpdate.getTime()) / (1000 * 60);

    if (minutes <= 2) {
      return 'active';
    }
    if (minutes <= 15) {
      return 'monitoring';
    }
    return 'inactive';
  }

  private formatLastUpdate(timestamp: string | null): string {
    if (!timestamp) {
      return 'Aucune position reçue';
    }

    const date = this.parseBackendTimestamp(timestamp);
    if (!date) {
      return 'Date invalide';
    }
    return date.toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  }

  private escapeHtml(input: string): string {
    return input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private parseBackendTimestamp(timestamp: string): Date | null {
    const trimmed = timestamp.trim();
    if (trimmed === '') {
      return null;
    }

    // Spring returns LocalDateTime (no timezone). Backend saves it in UTC.
    // Append "Z" so JS interprets it as UTC instead of browser local time.
    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed);
    const normalized = hasTimezone ? trimmed : `${trimmed}Z`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
