import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ApiConfig } from '../config/api.config';

export type UserRole = 'admin' | 'volunteer' | 'doctor';
export type ApiUserRole = 'ADMIN' | 'PATIENT' | 'VOLONTAIRE' | 'FAMILY_MEMBER' | 'DOCTOR';

export interface AuthSession {
  email: string;
  userId: number;
  role: UserRole;
  apiRole: ApiUserRole;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  remember: boolean;
  loginAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  role: UserRole;
  remember: boolean;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  cin: string;
  phone: string;
  cinFrontFile?: File | null;
  cinBackFile?: File | null;
  faceImageFile?: File | null;
}

export interface RegisterDoctorPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  gender: string;
  spokenLanguage: string;
  cnamConventioned: 'YES' | 'NO';
  insuranceConventioned: 'YES' | 'NO';
  specialty: string;
  registrationNumber: string;
  yearsExperience: number;
  experienceDetails?: string;
  professionalDetails?: string;
  profilePhotoFile?: File | null;
  diplomas: File[];
}

interface AuthApiResponse {
  accessToken: string;
  refreshToken: string;
  email: string;
  role: ApiUserRole;
  userId: number;
  message: string;
}

interface VolunteerSignupPendingApiResponse {
  signupRequestId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ERROR';
  message: string;
}

interface VolunteerSignupStatusApiResponse {
  signupRequestId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ERROR';
  message: string;
  facialScore?: number | null;
}

interface DoctorSignupPendingApiResponse {
  signupRequestId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ERROR';
  message: string;
}

export interface UserProfile {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  age: number | null;
  role: ApiUserRole;
  profileImageUrl?: string | null;
  facialImageUrl?: string | null;
  createdAt: string;
  referralCode?: string | null;
  patientId?: number | null;
  patientNom?: string | null;
  patientPrenom?: string | null;
}

export interface UpdateProfilePayload {
  nom: string;
  prenom: string;
  age: number;
  imageFile?: File;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly STORAGE_KEY = 'pim_auth_session';
  private static readonly SESSION_STORAGE_KEY = 'pim_auth_session_runtime';
  private static get API_BASE_URL(): string {
    return ApiConfig.apiBaseUrl;
  }

  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(this.readSession());

  readonly session$ = this.sessionSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  get session(): AuthSession | null {
    return this.sessionSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.sessionSubject.value !== null;
  }

  async login(payload: LoginPayload): Promise<{ success: boolean; message: string }> {
    const email = payload.email.trim().toLowerCase();
    const password = payload.password.trim();

    if (!email || !password) {
      return { success: false, message: 'Veuillez renseigner votre identifiant et votre mot de passe.' };
    }

    try {
      const authResponse = await firstValueFrom(
        this.http.post<AuthApiResponse>(`${AuthService.API_BASE_URL}/auth/login`, {
          email,
          password
        })
      );

      const expectedRole: ApiUserRole =
        payload.role === 'admin'
          ? 'ADMIN'
          : payload.role === 'doctor'
            ? 'DOCTOR'
            : 'VOLONTAIRE';
      if (authResponse.role !== expectedRole) {
        return { success: false, message: 'Ce compte ne correspond pas au type de connexion sélectionné.' };
      }

      const profile = await this.getCurrentUserByToken(authResponse.accessToken);
      const displayName = `${profile.prenom} ${profile.nom}`.trim();

      const session: AuthSession = {
        email: authResponse.email,
        userId: authResponse.userId,
        role: payload.role,
        apiRole: authResponse.role,
        displayName: displayName || this.buildDisplayName(authResponse.email),
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken,
        remember: payload.remember,
        loginAt: new Date().toISOString()
      };

      this.sessionSubject.next(session);
      this.persistSession(session);

      return { success: true, message: 'Connexion réussie.' };
    } catch (error) {
      return {
        success: false,
        message: this.extractErrorMessage(error, 'Impossible de se connecter pour le moment.')
      };
    }
  }

  async register(payload: RegisterPayload): Promise<{ success: boolean; message: string }> {
    const hasRequired =
      payload.firstName.trim() !== '' &&
      payload.lastName.trim() !== '' &&
      payload.email.trim() !== '' &&
      payload.age > 0 &&
      payload.cin.trim() !== '' &&
      payload.phone.trim() !== '' &&
      !!payload.cinFrontFile &&
      !!payload.cinBackFile &&
      !!payload.faceImageFile;

    if (!hasRequired) {
      return {
        success: false,
        message: 'Le formulaire volontaire est incomplet (CIN recto/verso + photo faciale obligatoires).'
      };
    }

    try {
      const formData = new FormData();
      formData.append(
        'data',
        JSON.stringify({
          email: payload.email.trim().toLowerCase(),
          nom: payload.lastName.trim(),
          prenom: payload.firstName.trim(),
          age: payload.age,
          cin: payload.cin.trim(),
          phone: payload.phone.trim()
        })
      );
      formData.append('cinFront', payload.cinFrontFile as File);
      formData.append('cinBack', payload.cinBackFile as File);
      formData.append('faceImage', payload.faceImageFile as File);
      
      const response = await firstValueFrom(
        this.http.post<VolunteerSignupPendingApiResponse>(`${AuthService.API_BASE_URL}/auth/signup/volontaire`, formData)
      );

      return {
        success: true,
        message: response.message || 'Demande envoyée. En attente de validation admin.'
      };
    } catch (error) {
      return {
        success: false,
        message: this.extractErrorMessage(error, 'Échec de la création du compte volontaire.')
      };
    }
  }

  async registerDoctor(payload: RegisterDoctorPayload): Promise<{ success: boolean; message: string }> {
    const hasRequired =
      payload.firstName.trim() !== '' &&
      payload.lastName.trim() !== '' &&
      payload.email.trim() !== '' &&
      payload.phone.trim() !== '' &&
      payload.city.trim() !== '' &&
      payload.address.trim() !== '' &&
      payload.gender.trim() !== '' &&
      payload.spokenLanguage.trim() !== '' &&
      payload.specialty.trim() !== '' &&
      payload.registrationNumber.trim() !== '' &&
      payload.yearsExperience >= 0 &&
      payload.diplomas.length > 0;

    if (!hasRequired) {
      return {
        success: false,
        message: 'Le formulaire doctor est incomplet (au moins un diplôme est obligatoire).'
      };
    }

    try {
      const cnamLabel = payload.cnamConventioned === 'YES' ? 'Oui' : 'Non';
      const insuranceLabel = payload.insuranceConventioned === 'YES' ? 'Oui' : 'Non';
      const contactCoordinates = `${payload.address.trim()} - ${payload.city.trim()}`;
      const qualificationsParts = [
        payload.professionalDetails?.trim() || '',
        `Langue parlée: ${payload.spokenLanguage.trim()}`,
        `Genre: ${payload.gender.trim()}`
      ].filter((value) => value !== '');
      const experienceDetailsParts = [
        payload.experienceDetails?.trim() || '',
        `Conventionné CNAM: ${cnamLabel}`,
        `Conventionné assurances/cartes: ${insuranceLabel}`
      ].filter((value) => value !== '');

      const formData = new FormData();
      formData.append(
        'data',
        JSON.stringify({
          email: payload.email.trim().toLowerCase(),
          nom: payload.lastName.trim(),
          prenom: payload.firstName.trim(),
          phone: payload.phone.trim(),
          contactCoordinates,
          specialty: payload.specialty.trim(),
          registrationNumber: payload.registrationNumber.trim(),
          yearsExperience: payload.yearsExperience,
          experienceYears: payload.yearsExperience,
          qualifications: qualificationsParts.join(' | ') || null,
          experienceDetails: experienceDetailsParts.join(' | ') || null
        })
      );

      if (payload.profilePhotoFile) {
        formData.append('profilePhoto', payload.profilePhotoFile);
      }

      payload.diplomas.forEach((file) => {
        formData.append('diplomas', file);
      });

      const response = await firstValueFrom(
        this.http.post<DoctorSignupPendingApiResponse>(`${AuthService.API_BASE_URL}/auth/signup/doctor`, formData)
      );

      return {
        success: true,
        message: response.message || 'Demande doctor envoyée. En attente de validation admin.'
      };
    } catch (error) {
      return {
        success: false,
        message: this.extractErrorMessage(error, 'Échec de la création de la demande doctor.')
      };
    }
  }

  async getCurrentUser(): Promise<UserProfile> {
    const token = this.session?.accessToken;
    if (!token) {
      throw new Error('Session invalide');
    }
    return this.getCurrentUserByToken(token);
  }

  async updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    const session = this.session;
    if (!session) {
      throw new Error('Session invalide');
    }

    const formData = new FormData();
    formData.append(
      'data',
      JSON.stringify({
        nom: payload.nom.trim(),
        prenom: payload.prenom.trim(),
        age: payload.age
      })
    );

    if (payload.imageFile) {
      formData.append('image', payload.imageFile);
    }

    const endpoint = this.profileEndpointByRole(session.apiRole);
    const headers = this.buildAuthHeaders(session.accessToken);
    const response = await firstValueFrom(
      this.http.put<UserProfile>(`${AuthService.API_BASE_URL}/auth/profile/${endpoint}`, formData, { headers })
    );

    const updatedSession: AuthSession = {
      ...session,
      displayName: `${response.prenom} ${response.nom}`.trim() || session.displayName
    };

    this.sessionSubject.next(updatedSession);
    this.persistSession(updatedSession);

    return response;
  }

  logout(): void {
    this.sessionSubject.next(null);
    this.persistSession(null);
  }

  private profileEndpointByRole(role: ApiUserRole): string {
    if (role === 'ADMIN') {
      return 'admin';
    }
    if (role === 'VOLONTAIRE') {
      return 'volontaire';
    }
    if (role === 'PATIENT') {
      return 'patient';
    }
    if (role === 'DOCTOR') {
      return 'doctor';
    }
    if (role === 'FAMILY_MEMBER') {
      return 'family';
    }
    return 'volontaire';
  }

  private buildAuthHeaders(accessToken: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${accessToken}`
    });
  }

  private async getCurrentUserByToken(accessToken: string): Promise<UserProfile> {
    const headers = this.buildAuthHeaders(accessToken);
    return firstValueFrom(this.http.get<UserProfile>(`${AuthService.API_BASE_URL}/auth/me`, { headers }));
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error;
      if (body && typeof body === 'object' && 'message' in body) {
        const msg = (body as { message?: unknown }).message;
        if (typeof msg === 'string' && msg.trim() !== '') {
          return msg;
        }
      }
      if (typeof body === 'string' && body.trim() !== '') {
        return body.length > 300 ? `${body.slice(0, 300)}…` : body;
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

  private async waitForVolunteerDecision(
    signupRequestId: number,
    email: string
  ): Promise<VolunteerSignupStatusApiResponse> {
    const maxAttempts = 20;
    const delayMs = 1500;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const status = await firstValueFrom(
        this.http.get<VolunteerSignupStatusApiResponse>(
          `${AuthService.API_BASE_URL}/auth/signup/volontaire/status/${signupRequestId}`,
          { params: { email } }
        )
      );

      if (status.status !== 'PENDING') {
        return status;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }

    return {
      signupRequestId,
      status: 'PENDING',
      message: 'Demande envoyée. Validation en cours, vous recevrez un email dès la décision.',
      facialScore: null
    };
  }

  private readSession(): AuthSession | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = localStorage.getItem(AuthService.STORAGE_KEY)
      ?? sessionStorage.getItem(AuthService.SESSION_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      localStorage.removeItem(AuthService.STORAGE_KEY);
      sessionStorage.removeItem(AuthService.SESSION_STORAGE_KEY);
      return null;
    }
  }

  private persistSession(session: AuthSession | null): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (!session) {
      localStorage.removeItem(AuthService.STORAGE_KEY);
      sessionStorage.removeItem(AuthService.SESSION_STORAGE_KEY);
      return;
    }

    if (session.remember) {
      localStorage.setItem(AuthService.STORAGE_KEY, JSON.stringify(session));
      sessionStorage.removeItem(AuthService.SESSION_STORAGE_KEY);
      return;
    }

    localStorage.removeItem(AuthService.STORAGE_KEY);
    sessionStorage.setItem(AuthService.SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private buildDisplayName(email: string): string {
    const normalized = email.includes('@') ? email.split('@')[0] : email;
    const capitalized = normalized
      .split(/[._\-\s]/)
      .filter((chunk) => chunk.length > 0)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
      .join(' ');

    return capitalized || 'Volontaire';
  }
}
