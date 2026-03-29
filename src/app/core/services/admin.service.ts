import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export type ApiUserRole = 'ADMIN' | 'PATIENT' | 'VOLONTAIRE' | 'FAMILY_MEMBER';
export type AddictionType = 'OPIATES' | 'COCAINE' | 'ALCOHOL' | 'OTHER';
export type GeoZoneType = 'DANGER' | 'SAFE' | 'CAUTION';
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
}

export interface UserStats {
  totalUsers: number;
  totalPatients: number;
  totalFamilyMembers: number;
  totalVolontaires: number;
  totalAdmins: number;
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

export interface GeoCoordinatePayload {
  lat: number;
  lon: number;
}

export interface GeoZonePayload {
  name: string;
  type: GeoZoneType;
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
  minDwellSeconds?: number | null;
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
  zoneShapeType: string;
  severity: ZoneSeverity;
  activeFrom: string | null;
  activeTo: string | null;
  daysOfWeek: string[];
  minDwellSeconds: number;
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
  private static readonly API_BASE_URL = 'http://localhost:8080/api';

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
    return AdminService.API_BASE_URL.replace(/\/api$/, '');
  }

  getWebSocketBaseUrl(): string {
    const backendBase = this.getBackendBaseUrl();
    if (backendBase.startsWith('https://')) {
      return backendBase.replace(/^https:\/\//, 'wss://');
    }
    if (backendBase.startsWith('http://')) {
      return backendBase.replace(/^http:\/\//, 'ws://');
    }
    return backendBase;
  }

  private buildAuthHeaders(): HttpHeaders {
    const token = this.authService.session?.accessToken ?? '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
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
