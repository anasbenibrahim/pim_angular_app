import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiConfig } from '../config/api.config';

export type ApiUserRole = 'ADMIN' | 'PATIENT' | 'VOLONTAIRE' | 'FAMILY_MEMBER' | 'DOCTOR';
export type AddictionType = 'OPIATES' | 'COCAINE' | 'ALCOHOL' | 'OTHER';
export type GeoZoneType = 'DANGER' | 'SAFE' | 'CAUTION';
export type DangerZoneCategory = 'BAR' | 'DEALER_AREA' | 'OLD_TRIGGER_PLACE' | 'CUSTOM';
export type GeoZoneSource = 'MANUAL' | 'OSM' | 'TEMPLATE';
export type GeoZoneShapeType = 'CIRCLE' | 'POLYGON' | 'MULTIPOLYGON';
export type ZoneSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AdminUserListItem {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  age: number | null;
  role: ApiUserRole;
  createdAt: string;
  profileImageUrl?: string | null;
  referralCode?: string | null;
  linkedPatientId?: number | null;
  linkedPatientNom?: string | null;
  linkedPatientPrenom?: string | null;
  cin?: string | null;
  cinFrontImageUrl?: string | null;
  cinBackImageUrl?: string | null;
  facialImageUrl?: string | null;
  facialMatchScore?: number | null;
  identityVerified?: boolean | null;
  volunteerAddictionSpecialties?: AddictionType[] | null;
}

export interface UserMonthlyPoint {
  month: string;
  total: number;
  patients: number;
  familyMembers: number;
  volontaires: number;
  admins: number;
  doctors?: number;
}

export interface UserStats {
  totalUsers: number;
  totalPatients: number;
  totalFamilyMembers: number;
  totalVolontaires: number;
  totalAdmins: number;
  totalDoctors?: number;
  monthlyRegistrations: UserMonthlyPoint[];
}

export interface AdminCreateUserPayload {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  age?: number | null;
  role: ApiUserRole;
  dateNaissance?: string | null;
  sobrietyDate?: string | null;
  addiction?: AddictionType | null;
  volunteerAddictionSpecialties?: AddictionType[] | null;
  referralKey?: string | null;
  patientId?: number | null;
}

export interface AdminUpdateUserPayload {
  nom: string;
  prenom: string;
  age?: number | null;
  volunteerAddictionSpecialties?: AddictionType[] | null;
}

export interface AdminPatientLocation {
  patientId: number;
  nom: string;
  prenom: string;
  email: string;
  lat: number | null;
  lon: number | null;
  timestamp: string | null;
  profileImageUrl?: string | null;
  facialImageUrl?: string | null;
  cinFrontImageUrl?: string | null;
}

export interface VolunteerPatientAssignment {
  assignmentId: number;
  volontaireId: number;
  volontaireEmail: string;
  patientId: number;
  patientNom: string;
  patientPrenom: string;
  patientEmail: string;
  assignedAt: string;
}

export type VolunteerSignupStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ERROR';

export interface VolunteerSignupAdminItem {
  signupRequestId: number;
  email: string;
  nom: string;
  prenom: string;
  age: number;
  cin: string;
  phone: string | null;
  cinFrontImageUrl: string | null;
  cinBackImageUrl: string | null;
  faceImageUrl: string | null;
  facialScore: number | null;
  status: VolunteerSignupStatus;
  decisionReason: string | null;
  createdAt: string;
  processedAt: string | null;
}

export type DoctorSignupStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ERROR';

export interface DoctorSignupAdminItem {
  signupRequestId: number;
  email: string;
  nom: string;
  prenom: string;
  phone: string | null;
  specialty: string;
  registrationNumber: string;
  yearsExperience: number | null;
  experienceDetails?: string | null;
  diplomas: string[];
  status: DoctorSignupStatus;
  decisionReason: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface DoctorSignupAdminItemApiResponse {
  signupRequestId: number;
  email: string;
  nom: string;
  prenom: string;
  phone: string | null;
  contactCoordinates?: string | null;
  specialty: string;
  qualifications?: string | null;
  registrationNumber: string;
  experienceDetails?: string | null;
  experienceYears?: number | null;
  yearsExperience?: number | null;
  diplomaFiles?: string[] | null;
  diplomas?: string[] | null;
  status: DoctorSignupStatus;
  decisionReason: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface ApiMessageResponse {
  message: string;
}

export interface GeoCoordinatePayload {
  lat: number;
  lon: number;
}

export interface GeoZonePayload {
  name: string;
  type: GeoZoneType;
  dangerCategory?: DangerZoneCategory | null;
  source: GeoZoneSource;
  shapeType: GeoZoneShapeType;
  description?: string | null;
  isActive?: boolean | null;
  radiusMeters?: number | null;
  centerLat?: number | null;
  centerLon?: number | null;
  polygonCoordinates?: GeoCoordinatePayload[] | null;
  multiPolygonCoordinates?: GeoCoordinatePayload[][] | null;
}

export interface GeoZoneItem {
  id: number;
  name: string;
  type: GeoZoneType;
  dangerCategory?: DangerZoneCategory | null;
  source: GeoZoneSource;
  shapeType: GeoZoneShapeType;
  description: string | null;
  isActive: boolean;
  radiusMeters: number | null;
  geoJson: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PatientZoneRulePayload {
  zoneId: number;
  severity: ZoneSeverity;
  activeFrom?: string | null;
  activeTo?: string | null;
  daysOfWeek?: string[] | null;
  dwellTimeSec?: number | null;
  minDwellSeconds?: number | null;
  cooldownSec?: number | null;
  notifyOnEnter?: boolean | null;
  notifyOnExit?: boolean | null;
  notifyFamily?: boolean | null;
  notifyVolunteer?: boolean | null;
  notifyAdmin?: boolean | null;
  isActive?: boolean | null;
  maxAccuracyMeters?: number | null;
  enterRadiusMeters?: number | null;
  exitRadiusMeters?: number | null;
}

export interface PatientZoneRuleItem {
  id: number;
  patientId: number;
  zoneId: number;
  zoneName: string;
  zoneType: string;
  zoneDangerCategory?: DangerZoneCategory | null;
  zoneShapeType: string;
  severity: ZoneSeverity;
  activeFrom: string | null;
  activeTo: string | null;
  daysOfWeek: string[];
  dwellTimeSec?: number;
  minDwellSeconds: number;
  cooldownSec?: number;
  notifyOnEnter?: boolean;
  notifyOnExit?: boolean;
  notifyFamily: boolean;
  notifyVolunteer: boolean;
  notifyAdmin: boolean;
  isActive: boolean;
  maxAccuracyMeters: number | null;
  enterRadiusMeters: number | null;
  exitRadiusMeters: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ZoneEventItem {
  id: number;
  patientId: number;
  patientNom: string;
  patientPrenom: string;
  zoneId: number;
  zoneName: string;
  eventType: 'ENTER' | 'EXIT' | 'DWELL_ALERT';
  severity: ZoneSeverity;
  timestamp: string;
  lat: number;
  lon: number;
  accuracyMeters: number | null;
  notifyFamily: boolean;
  notifyVolunteer: boolean;
  notifyAdmin: boolean;
  resolved: boolean;
  resolvedAt: string | null;
  note: string | null;
}

export interface ZonePresenceItem {
  patientId: number;
  zoneId: number;
  inside: boolean;
  distanceMeters: number | null;
  latestLocationAt: string | null;
  latestLat: number | null;
  latestLon: number | null;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private static get API_BASE_URL(): string {
    return ApiConfig.apiBaseUrl;
  }

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  async getAllUsers(): Promise<AdminUserListItem[]> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.get<AdminUserListItem[]>(`${AdminService.API_BASE_URL}/admin/users`, { headers })
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de charger les utilisateurs.'));
    }
  }

  async getUserStats(): Promise<UserStats> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.get<UserStats>(`${AdminService.API_BASE_URL}/admin/stats/users`, { headers })
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de charger les statistiques.'));
    }
  }

  async createUser(payload: AdminCreateUserPayload): Promise<AdminUserListItem> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.post<AdminUserListItem>(`${AdminService.API_BASE_URL}/admin/users`, payload, { headers })
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de création utilisateur.'));
    }
  }

  async updateUser(userId: number, payload: AdminUpdateUserPayload): Promise<AdminUserListItem> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.put<AdminUserListItem>(`${AdminService.API_BASE_URL}/admin/users/${userId}`, payload, { headers })
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de mise à jour utilisateur.'));
    }
  }

  async deleteUser(userId: number): Promise<void> {
    try {
      const headers = this.buildAuthHeaders();
      await firstValueFrom(this.http.delete(`${AdminService.API_BASE_URL}/admin/users/${userId}`, { headers }));
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de suppression utilisateur.'));
    }
  }

  async getLatestPatientsLocations(): Promise<AdminPatientLocation[]> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.get<AdminPatientLocation[]>(
          `${AdminService.API_BASE_URL}/admin/patients/locations/latest`,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de charger la carte des patients.'));
    }
  }

  async getPendingVolunteerSignups(): Promise<VolunteerSignupAdminItem[]> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.get<VolunteerSignupAdminItem[]>(
          `${AdminService.API_BASE_URL}/admin/volunteer-signups/pending`,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(
        this.extractErrorMessage(error, 'Impossible de charger les demandes volontaires en attente.')
      );
    }
  }

  async getVolunteerSignups(): Promise<VolunteerSignupAdminItem[]> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.get<VolunteerSignupAdminItem[]>(
          `${AdminService.API_BASE_URL}/admin/volunteer-signups`,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(
        this.extractErrorMessage(error, 'Impossible de charger les demandes volontaires.')
      );
    }
  }

  async approveVolunteerSignup(signupRequestId: number, payload?: { score?: number; reason?: string }): Promise<void> {
    try {
      const headers = this.buildAuthHeaders();
      const body = payload ?? {};
      await firstValueFrom(
        this.http.post(`${AdminService.API_BASE_URL}/admin/volunteer-signups/${signupRequestId}/approve`, body, {
          headers
        })
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de validation du volontaire.'));
    }
  }

  async rejectVolunteerSignup(signupRequestId: number, payload?: { score?: number; reason?: string }): Promise<void> {
    try {
      const headers = this.buildAuthHeaders();
      const body = payload ?? {};
      await firstValueFrom(
        this.http.post(`${AdminService.API_BASE_URL}/admin/volunteer-signups/${signupRequestId}/reject`, body, {
          headers
        })
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec du rejet du volontaire.'));
    }
  }

  async deleteVolunteerSignup(signupRequestId: number): Promise<void> {
    try {
      const headers = this.buildAuthHeaders();
      await firstValueFrom(
        this.http.delete(`${AdminService.API_BASE_URL}/admin/volunteer-signups/${signupRequestId}`, {
          headers
        })
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de suppression de la demande volontaire.'));
    }
  }

  async getVolunteerAssignments(volontaireId: number): Promise<VolunteerPatientAssignment[]> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.get<VolunteerPatientAssignment[]>(
          `${AdminService.API_BASE_URL}/admin/volontaires/${volontaireId}/assignments`,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de charger les assignations du volontaire.'));
    }
  }

  async getPendingDoctorSignups(): Promise<DoctorSignupAdminItem[]> {
    try {
      const headers = this.buildAuthHeaders();
      const items = await firstValueFrom(
        this.http.get<DoctorSignupAdminItemApiResponse[]>(
          `${AdminService.API_BASE_URL}/admin/doctor-signups/pending`,
          { headers }
        )
      );
      return items.map((item) => this.normalizeDoctorSignup(item));
    } catch (error) {
      throw new Error(
        this.extractErrorMessage(error, 'Impossible de charger les demandes doctor en attente.')
      );
    }
  }

  async getDoctorSignups(): Promise<DoctorSignupAdminItem[]> {
    try {
      const headers = this.buildAuthHeaders();
      const items = await firstValueFrom(
        this.http.get<DoctorSignupAdminItemApiResponse[]>(
          `${AdminService.API_BASE_URL}/admin/doctor-signups`,
          { headers }
        )
      );
      return items.map((item) => this.normalizeDoctorSignup(item));
    } catch (error) {
      throw new Error(
        this.extractErrorMessage(error, 'Impossible de charger les demandes doctor.')
      );
    }
  }

  async approveDoctorSignup(signupRequestId: number, payload?: { reason?: string }): Promise<string> {
    try {
      if (!Number.isFinite(signupRequestId) || signupRequestId < 1) {
        throw new Error('Identifiant de demande doctor invalide.');
      }
      const headers = this.buildJsonAuthHeaders();
      const body = payload ?? {};
      const response = await firstValueFrom(
        this.http.post<ApiMessageResponse>(`${AdminService.API_BASE_URL}/admin/doctor-signups/${signupRequestId}/approve`, body, {
          headers
        })
      );
      return response?.message ?? 'Opération terminée.';
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de validation du doctor.'));
    }
  }

  async rejectDoctorSignup(signupRequestId: number, payload?: { reason?: string }): Promise<string> {
    try {
      if (!Number.isFinite(signupRequestId) || signupRequestId < 1) {
        throw new Error('Identifiant de demande doctor invalide.');
      }
      const headers = this.buildJsonAuthHeaders();
      const body = payload ?? {};
      const response = await firstValueFrom(
        this.http.post<ApiMessageResponse>(`${AdminService.API_BASE_URL}/admin/doctor-signups/${signupRequestId}/reject`, body, {
          headers
        })
      );
      return response?.message ?? 'Opération terminée.';
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec du rejet du doctor.'));
    }
  }

  async deleteDoctorSignup(signupRequestId: number): Promise<string> {
    try {
      const headers = this.buildAuthHeaders();
      const response = await firstValueFrom(
        this.http.delete<ApiMessageResponse>(`${AdminService.API_BASE_URL}/admin/doctor-signups/${signupRequestId}`, {
          headers
        })
      );
      return response?.message ?? 'Opération terminée.';
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de suppression de la demande doctor.'));
    }
  }

  async getGeoZones(): Promise<GeoZoneItem[]> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.get<GeoZoneItem[]>(
          `${AdminService.API_BASE_URL}/admin/geofencing/zones`,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de charger les zones geofencing.'));
    }
  }

  async createGeoZone(payload: GeoZonePayload): Promise<GeoZoneItem> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.post<GeoZoneItem>(
          `${AdminService.API_BASE_URL}/admin/geofencing/zones`,
          payload,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de création de zone.'));
    }
  }

  async updateGeoZone(zoneId: number, payload: GeoZonePayload): Promise<GeoZoneItem> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.put<GeoZoneItem>(
          `${AdminService.API_BASE_URL}/admin/geofencing/zones/${zoneId}`,
          payload,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de mise à jour de zone.'));
    }
  }

  async deleteGeoZone(zoneId: number): Promise<void> {
    try {
      const headers = this.buildAuthHeaders();
      await firstValueFrom(
        this.http.delete(
          `${AdminService.API_BASE_URL}/admin/geofencing/zones/${zoneId}`,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de suppression de zone.'));
    }
  }

  async getPatientZoneRules(patientId: number): Promise<PatientZoneRuleItem[]> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.get<PatientZoneRuleItem[]>(
          `${AdminService.API_BASE_URL}/admin/geofencing/patients/${patientId}/zone-rules`,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de charger les règles patient-zone.'));
    }
  }

  async createPatientZoneRule(patientId: number, payload: PatientZoneRulePayload): Promise<PatientZoneRuleItem> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.post<PatientZoneRuleItem>(
          `${AdminService.API_BASE_URL}/admin/geofencing/patients/${patientId}/zone-rules`,
          payload,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de création de règle patient-zone.'));
    }
  }

  async updatePatientZoneRule(
    patientId: number,
    ruleId: number,
    payload: PatientZoneRulePayload
  ): Promise<PatientZoneRuleItem> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.put<PatientZoneRuleItem>(
          `${AdminService.API_BASE_URL}/admin/geofencing/patients/${patientId}/zone-rules/${ruleId}`,
          payload,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de mise à jour de règle patient-zone.'));
    }
  }

  async deletePatientZoneRule(patientId: number, ruleId: number): Promise<void> {
    try {
      const headers = this.buildAuthHeaders();
      await firstValueFrom(
        this.http.delete(
          `${AdminService.API_BASE_URL}/admin/geofencing/patients/${patientId}/zone-rules/${ruleId}`,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de suppression de règle patient-zone.'));
    }
  }

  async getZoneEvents(params?: {
    patientId?: number;
    zoneId?: number;
    resolved?: boolean;
    from?: string;
    to?: string;
  }): Promise<ZoneEventItem[]> {
    try {
      const headers = this.buildAuthHeaders();
      const query = new URLSearchParams();
      if (params?.patientId != null) query.set('patientId', String(params.patientId));
      if (params?.zoneId != null) query.set('zoneId', String(params.zoneId));
      if (params?.resolved != null) query.set('resolved', String(params.resolved));
      if (params?.from) query.set('from', params.from);
      if (params?.to) query.set('to', params.to);
      const url = `${AdminService.API_BASE_URL}/admin/geofencing/zone-events${query.toString() ? `?${query.toString()}` : ''}`;
      return await firstValueFrom(this.http.get<ZoneEventItem[]>(url, { headers }));
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de charger les événements de zone.'));
    }
  }

  async resolveZoneEvent(eventId: number, payload?: { resolved?: boolean; note?: string }): Promise<ZoneEventItem> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.post<ZoneEventItem>(
          `${AdminService.API_BASE_URL}/admin/geofencing/zone-events/${eventId}/resolve`,
          payload ?? {},
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Échec de résolution de l’événement de zone.'));
    }
  }

  async getZonePresence(patientId: number, zoneId: number): Promise<ZonePresenceItem> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.get<ZonePresenceItem>(
          `${AdminService.API_BASE_URL}/admin/geofencing/patients/${patientId}/zones/${zoneId}/presence`,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de re-vérifier la présence en zone.'));
    }
  }

  getBackendBaseUrl(): string {
    return ApiConfig.backendBaseUrl;
  }

  getWebSocketBaseUrl(): string {
    return ApiConfig.websocketBaseUrl;
  }

  resolveMediaUrl(path: string | null | undefined): string | null {
    if (!path || path.trim() === '') {
      return null;
    }
    const value = path.trim();
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/')) {
      return `${this.getBackendBaseUrl()}${value}`;
    }
    return `${this.getBackendBaseUrl()}/${value}`;
  }

  private normalizeDoctorSignup(item: DoctorSignupAdminItemApiResponse): DoctorSignupAdminItem {
    const diplomas = Array.isArray(item.diplomas)
      ? item.diplomas
      : Array.isArray(item.diplomaFiles)
        ? item.diplomaFiles
        : [];
    const yearsExperience = item.yearsExperience ?? item.experienceYears ?? null;
    const signupRequestId = Number(item.signupRequestId);
    if (!Number.isFinite(signupRequestId)) {
      throw new Error('Réponse API invalide: signupRequestId manquant pour une demande doctor.');
    }

    return {
      signupRequestId,
      email: item.email,
      nom: item.nom,
      prenom: item.prenom,
      phone: item.phone ?? null,
      specialty: item.specialty,
      registrationNumber: item.registrationNumber,
      yearsExperience,
      experienceDetails: item.experienceDetails ?? null,
      diplomas,
      status: item.status,
      decisionReason: item.decisionReason ?? null,
      createdAt: item.createdAt,
      processedAt: item.processedAt ?? null
    };
  }

  private buildAuthHeaders(): HttpHeaders {
    const token = this.authService.session?.accessToken ?? '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  /** Ensures JSON POST bodies are parsed by Spring (some clients omit Content-Type when merging headers). */
  private buildJsonAuthHeaders(): HttpHeaders {
    return this.buildAuthHeaders().set('Content-Type', 'application/json');
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as { message?: string } | null;
      if (payload && typeof payload.message === 'string' && payload.message.trim() !== '') {
        return payload.message;
      }
      if (typeof error.message === 'string' && error.message.trim() !== '') {
        return error.message;
      }
    }
    if (error instanceof Error && error.message.trim() !== '') {
      return error.message;
    }
    return fallback;
  }
}
