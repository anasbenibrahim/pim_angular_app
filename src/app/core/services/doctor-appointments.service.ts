import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from '../config/api.config';
import { AuthService } from './auth.service';

export type DoctorAppointmentStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';
export type DoctorAppointmentVisitType = 'CABINET' | 'VIDEO';

export interface DoctorAppointmentItem {
  id: number;
  doctorId: number;
  doctorName: string;
  doctorEmail: string;
  doctorSpecialty: string;
  doctorLocation: string;
  doctorProfileImageUrl?: string | null;
  patientId: number;
  patientName: string;
  patientEmail: string;
  patientPhone?: string | null;
  appointmentDateTime: string;
  visitType: DoctorAppointmentVisitType;
  reason: string;
  notes?: string | null;
  status: DoctorAppointmentStatus;
  decisionReason?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorAppointmentDecisionPayload {
  reason?: string;
  acceptedDateTime?: string;
}

export interface DoctorManagedAppointmentCreatePayload {
  patientId: number;
  appointmentDateTime: string;
  visitType: DoctorAppointmentVisitType;
  reason: string;
  notes?: string;
  patientPhone?: string;
}

export interface VideoCallStatusResponse {
  appointmentId: number;
  active: boolean;
  status: string;
  roomId?: string | null;
  scheduledAt?: string | null;
  doctorName?: string | null;
  patientName?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DoctorAppointmentsService {
  private static get API_BASE_URL(): string {
    return ApiConfig.apiBaseUrl;
  }

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  async getDoctorAppointments(): Promise<DoctorAppointmentItem[]> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.get<DoctorAppointmentItem[]>(
          `${DoctorAppointmentsService.API_BASE_URL}/appointments/doctor`,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de charger les demandes de rendez-vous.'));
    }
  }

  async acceptAppointment(
    appointmentId: number,
    payload?: DoctorAppointmentDecisionPayload
  ): Promise<DoctorAppointmentItem> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.post<DoctorAppointmentItem>(
          `${DoctorAppointmentsService.API_BASE_URL}/appointments/${appointmentId}/accept`,
          payload ?? {},
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible d’accepter ce rendez-vous.'));
    }
  }

  async rejectAppointment(
    appointmentId: number,
    payload?: DoctorAppointmentDecisionPayload
  ): Promise<DoctorAppointmentItem> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.post<DoctorAppointmentItem>(
          `${DoctorAppointmentsService.API_BASE_URL}/appointments/${appointmentId}/reject`,
          payload ?? {},
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de rejeter ce rendez-vous.'));
    }
  }

  async createDoctorAssignedAppointment(
    payload: DoctorManagedAppointmentCreatePayload
  ): Promise<DoctorAppointmentItem> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.post<DoctorAppointmentItem>(
          `${DoctorAppointmentsService.API_BASE_URL}/appointments/doctor-assigned`,
          payload,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de créer le rendez-vous patient.'));
    }
  }

  async acceptVideoCallRequest(appointmentId: number, acceptedDateTime?: string): Promise<void> {
    try {
      const headers = this.buildAuthHeaders();
      await firstValueFrom(
        this.http.post<void>(
          `${DoctorAppointmentsService.API_BASE_URL}/appointments/${appointmentId}/video-call/accept`,
          acceptedDateTime ? { acceptedDateTime } : {},
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible d’accepter la demande d’appel vidéo.'));
    }
  }

  async rejectVideoCallRequest(appointmentId: number, reason?: string): Promise<void> {
    try {
      const headers = this.buildAuthHeaders();
      await firstValueFrom(
        this.http.post<void>(
          `${DoctorAppointmentsService.API_BASE_URL}/appointments/${appointmentId}/video-call/reject`,
          reason ? { reason } : {},
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de rejeter la demande d’appel vidéo.'));
    }
  }

  async proposeVideoCallAlternative(appointmentId: number, acceptedDateTime: string, reason?: string): Promise<void> {
    try {
      const headers = this.buildAuthHeaders();
      await firstValueFrom(
        this.http.post<void>(
          `${DoctorAppointmentsService.API_BASE_URL}/appointments/${appointmentId}/video-call/propose`,
          { acceptedDateTime, reason },
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de proposer un autre créneau d’appel vidéo.'));
    }
  }

  async getVideoCallStatus(appointmentId: number): Promise<VideoCallStatusResponse> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(
        this.http.get<VideoCallStatusResponse>(
          `${DoctorAppointmentsService.API_BASE_URL}/appointments/${appointmentId}/video-call/status`,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de récupérer le statut de l’appel vidéo.'));
    }
  }

  private buildAuthHeaders(): HttpHeaders {
    const token = this.authService.session?.accessToken?.trim();
    if (!token) {
      throw new Error('Session invalide: token manquant.');
    }
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
