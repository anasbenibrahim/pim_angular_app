import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiConfig } from '../config/api.config';
import { AuthService } from './auth.service';

export type ClinicalMessageTemplate =
  | 'RECHUTE'
  | 'RELAPSE'
  | 'CRAVING'
  | 'MOTIVATION'
  | 'DETRESSE'
  | 'INFO'
  | 'GENERAL'
  | 'VIDEO_CALL_REQUEST'
  | 'VIDEO_CALL_ACCEPTED'
  | 'VIDEO_CALL_REJECTED'
  | 'VIDEO_CALL_SCHEDULED';
export type ClinicalTaskStatus = 'PENDING' | 'COMPLETED';
export type CarePlanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED';
export type CarePlanItemType = 'GOAL' | 'APPOINTMENT' | 'TASK';
export type ClinicalRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SentimentEmotion = 'STRESS' | 'CRAVING' | 'MOTIVATION' | 'NORMAL';
export type SentimentSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ClinicalSentimentAnalysis {
  emotion: SentimentEmotion;
  score: number;
  severity: SentimentSeverity;
  recommendation: string;
}

export interface ClinicalSentimentHistoryItem {
  messageId: number;
  emotion: SentimentEmotion;
  score: number;
  severity: SentimentSeverity;
  recommendation: string;
  patientSuggestion: string;
  createdAt: string;
}

export interface ClinicalMessageAttachment {
  name: string;
  url: string;
  contentType?: string | null;
  sizeBytes?: number | null;
}

export interface ClinicalMessageItem {
  id: number;
  doctorId: number;
  doctorName: string;
  patientId: number;
  patientName: string;
  senderRole: string;
  templateType: ClinicalMessageTemplate;
  content: string;
  createdAt: string;
  delivered?: boolean | null;
  readAt?: string | null;
  attachment?: ClinicalMessageAttachment | null;
  sentimentAnalysis?: ClinicalSentimentAnalysis | null;
  patientSuggestion?: string | null;
}

export interface ClinicalMessageCreatePayload {
  patientId?: number;
  doctorId?: number;
  templateType?: ClinicalMessageTemplate;
  content: string;
  attachment?: ClinicalMessageAttachment;
}

export interface InAppNotificationItem {
  id: number;
  title: string;
  content: string;
  type: string;
  read: boolean;
  createdAt: string;
}

export interface ConsultationNoteItem {
  id: number;
  appointmentId: number;
  doctorId: number;
  doctorName: string;
  patientId: number;
  patientName: string;
  consultationSummary: string;
  behavioralPrescription?: string | null;
  followUpDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationNotePayload {
  consultationSummary: string;
  behavioralPrescription?: string;
  followUpDate?: string;
}

export interface ClinicalTaskItem {
  id: number;
  doctorId: number;
  doctorName: string;
  patientId: number;
  patientName: string;
  appointmentId?: number | null;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  reminderAt?: string | null;
  status: ClinicalTaskStatus;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalTaskCreatePayload {
  patientId: number;
  appointmentId?: number;
  title: string;
  description?: string;
  dueAt?: string;
  reminderAt?: string;
}

export interface CarePlanItem {
  id: number;
  itemType: CarePlanItemType;
  title: string;
  details?: string | null;
  dueAt?: string | null;
  completed: boolean;
  completedAt?: string | null;
  createdAt: string;
}

export interface CarePlanItemPayload {
  itemType: CarePlanItemType;
  title: string;
  details?: string;
  dueAt?: string;
}

export interface CarePlanItemRecord {
  id: number;
  doctorId: number;
  doctorName: string;
  patientId: number;
  patientName: string;
  title: string;
  weekStartDate: string;
  weekEndDate: string;
  status: CarePlanStatus;
  patientValidatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: CarePlanItem[];
}

export interface CarePlanCreatePayload {
  patientId: number;
  title: string;
  weekStartDate: string;
  weekEndDate: string;
  items: CarePlanItemPayload[];
}

export interface ClinicalCheckInItem {
  id: number;
  patientId: number;
  patientName: string;
  doctorId?: number | null;
  doctorName?: string | null;
  checkInDate: string;
  moodScore: number;
  symptomScore: number;
  cravingScore: number;
  motivationScore: number;
  notes?: string | null;
  riskScore: number;
  riskLevel: ClinicalRiskLevel;
  createdAt: string;
}

export interface ClinicalCheckInPayload {
  moodScore: number;
  symptomScore: number;
  cravingScore: number;
  motivationScore: number;
  notes?: string;
}

export interface SharedPlanStats {
  totalAppointments: number;
  completedAppointments: number;
  upcomingAppointments: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  pendingTasks: number;
  dueSoonTasks: number;
}

export interface SharedPlanContextCount {
  context: ClinicalMessageTemplate;
  count: number;
}

export interface SharedPlanMessageSummary {
  totalMessages: number;
  contexts: SharedPlanContextCount[];
}

export interface SharedPlanAppointmentItem {
  id: number;
  doctorId: number;
  doctorName: string;
  appointmentDateTime: string;
  visitType: string;
  status: string;
  reason: string;
  consultationSummary?: string | null;
  behavioralPrescription?: string | null;
  followUpDate?: string | null;
}

export interface SharedPlanTaskItem {
  id: number;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  reminderAt?: string | null;
  status: ClinicalTaskStatus;
  overdue: boolean;
  dueSoon: boolean;
  doctorName: string;
}

export interface SharedPlanCarePlanItem {
  id: number;
  title: string;
  weekStartDate: string;
  weekEndDate: string;
  status: CarePlanStatus;
  totalItems: number;
  completedItems: number;
}

export interface ClinicalSharedCarePlan {
  patientId: number;
  patientName: string;
  generatedAt: string;
  adherenceScore: number;
  stats: SharedPlanStats;
  alerts: string[];
  appointments: SharedPlanAppointmentItem[];
  tasks: SharedPlanTaskItem[];
  carePlans: SharedPlanCarePlanItem[];
  contextSummary: SharedPlanMessageSummary;
}

export interface ClinicalMessageInsight {
  context: ClinicalMessageTemplate;
  count: number;
  lastDetectedAt?: string | null;
  interpretation: string;
}

export interface ClinicalConsultationReportItem {
  consultationNoteId: number;
  appointmentId: number;
  doctorId: number;
  doctorName: string;
  appointmentDateTime?: string | null;
  consultationSummary: string;
  behavioralPrescription?: string | null;
  followUpDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalCheckInResponse {
  id: number;
  patientId: number;
  patientName: string;
  doctorId?: number;
  doctorName?: string;
  checkInDate: string;
  moodScore: number;
  symptomScore: number;
  cravingScore: number;
  motivationScore: number;
  notes?: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
}

export interface ClinicalMedicalReport {
  patientId: number;
  patientName: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  sharedCarePlan: ClinicalSharedCarePlan;
  consultationNotes: ClinicalConsultationReportItem[];
  messageInsights: ClinicalMessageInsight[];
  checkIns: ClinicalCheckInResponse[];
  recommendations: string[];
  clinicianSummary: string;
}

export interface AiDiagnosisSuggestion {
  diagnosis: string;
  probability: number;
  icd11Code: string;
  evidence: string[];
  tests: string[];
  source?: string | null;
}

export interface AiDiagnosisResponse {
  diagnoses: AiDiagnosisSuggestion[];
  disclaimer: string;
  processingTimeMs: number;
}

export interface AiUrgencyAnalysisResponse {
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  confidence: number;
  recommendedAction: string;
  reasoning: string;
  triggeredKeywords: string[];
  requiresHumanReview: boolean;
  processingTimeMs?: number;
}

export interface AiRiskFactor {
  factor: string;
  weight: number;
  description: string;
}

export interface AiIntervention {
  type: string;
  description: string;
  priority: string;
}

export interface AiCompliancePredictionResponse {
  riskLevel: string;
  adherenceProbability: number;
  riskFactors: AiRiskFactor[];
  suggestedInterventions: AiIntervention[];
  nextAssessmentDate: string;
}

export interface AiSummaryResponse {
  summaryId: string;
  generatedAt: string;
  summary: string;
  wordCount: number;
  format: string;
  processingTimeMs: number;
}

export interface AiChatbotResponse {
  message: string;
  triageAction: string;
  nextQuestion: string;
  processingTimeMs: number;
}

@Injectable({ providedIn: 'root' })
export class ClinicalCareService {
  private static get API_BASE_URL(): string {
    return ApiConfig.apiBaseUrl;
  }

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  async sendMessage(payload: ClinicalMessageCreatePayload): Promise<ClinicalMessageItem> {
    return this.post<ClinicalMessageItem>('/clinical/messages', payload, 'Impossible d’envoyer le message clinique.');
  }

  async uploadMessageAttachment(file: File, patientId?: number): Promise<ClinicalMessageAttachment> {
    const headers = this.buildAuthHeaders();
    const formData = new FormData();
    formData.append('file', file);
    const suffix = typeof patientId === 'number' ? `?patientId=${patientId}` : '';

    try {
      return await firstValueFrom(
        this.http.post<ClinicalMessageAttachment>(
          `${ClinicalCareService.API_BASE_URL}/clinical/messages/attachments${suffix}`,
          formData,
          { headers }
        )
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible d’envoyer la pièce jointe.'));
    }
  }

  async getThread(params: { patientId?: number; doctorId?: number }): Promise<ClinicalMessageItem[]> {
    const query = new URLSearchParams();
    if (typeof params.patientId === 'number') query.set('patientId', String(params.patientId));
    if (typeof params.doctorId === 'number') query.set('doctorId', String(params.doctorId));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.get<ClinicalMessageItem[]>(`/clinical/messages/thread${suffix}`, 'Impossible de charger l’historique de messagerie.');
  }

  async getSentimentHistory(patientId: number): Promise<ClinicalSentimentHistoryItem[]> {
    return this.get<ClinicalSentimentHistoryItem[]>(
      `/clinical/messages/sentiment-history?patientId=${patientId}`,
      'Impossible de charger l’historique émotionnel.'
    );
  }

  async upsertConsultationNote(appointmentId: number, payload: ConsultationNotePayload): Promise<ConsultationNoteItem> {
    return this.put<ConsultationNoteItem>(
      `/clinical/appointments/${appointmentId}/consultation-note`,
      payload,
      'Impossible d’enregistrer la note de consultation.'
    );
  }

  async getConsultationNote(appointmentId: number): Promise<ConsultationNoteItem> {
    return this.get<ConsultationNoteItem>(
      `/clinical/appointments/${appointmentId}/consultation-note`,
      'Impossible de charger la note de consultation.'
    );
  }

  async createTask(payload: ClinicalTaskCreatePayload): Promise<ClinicalTaskItem> {
    return this.post<ClinicalTaskItem>('/clinical/tasks', payload, 'Impossible de créer la tâche clinique.');
  }

  async getMyTasks(): Promise<ClinicalTaskItem[]> {
    return this.get<ClinicalTaskItem[]>('/clinical/tasks/mine', 'Impossible de charger vos tâches cliniques.');
  }

  async getDoctorTasks(patientId?: number): Promise<ClinicalTaskItem[]> {
    const suffix = typeof patientId === 'number' ? `?patientId=${patientId}` : '';
    return this.get<ClinicalTaskItem[]>(`/clinical/tasks${suffix}`, 'Impossible de charger les tâches patients.');
  }

  async updateTaskCompletion(taskId: number, completed: boolean): Promise<ClinicalTaskItem> {
    return this.patch<ClinicalTaskItem>(
      `/clinical/tasks/${taskId}/completion`,
      { completed },
      'Impossible de mettre à jour la tâche clinique.'
    );
  }

  async deleteTask(taskId: number): Promise<void> {
    await this.delete(`/clinical/tasks/${taskId}`, 'Impossible de supprimer la tâche clinique.');
  }

  async deleteConsultationNote(consultationNoteId: number): Promise<void> {
    await this.delete(
      `/clinical/consultation-notes/${consultationNoteId}`,
      'Impossible de supprimer la consultation.'
    );
  }

  async deleteAppointment(appointmentId: number): Promise<void> {
    await this.delete(`/clinical/appointments/${appointmentId}`, 'Impossible de supprimer le rendez-vous.');
  }

  async createCarePlan(payload: CarePlanCreatePayload): Promise<CarePlanItemRecord> {
    return this.post<CarePlanItemRecord>('/clinical/care-plans', payload, 'Impossible de créer le plan de soin.');
  }

  async updateCarePlan(planId: number, payload: CarePlanCreatePayload): Promise<CarePlanItemRecord> {
    return this.put<CarePlanItemRecord>(
      `/clinical/care-plans/${planId}`,
      payload,
      'Impossible de modifier le plan de soin.'
    );
  }

  async getMyCarePlans(): Promise<CarePlanItemRecord[]> {
    return this.get<CarePlanItemRecord[]>('/clinical/care-plans/mine', 'Impossible de charger les plans de soin.');
  }

  async getDoctorCarePlans(patientId?: number): Promise<CarePlanItemRecord[]> {
    const suffix = typeof patientId === 'number' ? `?patientId=${patientId}` : '';
    return this.get<CarePlanItemRecord[]>(`/clinical/care-plans${suffix}`, 'Impossible de charger les plans de soin doctor.');
  }

  async validateCarePlan(planId: number): Promise<CarePlanItemRecord> {
    return this.post<CarePlanItemRecord>(
      `/clinical/care-plans/${planId}/validate`,
      {},
      'Impossible de valider ce plan de soin.'
    );
  }

  async completeCarePlanItem(itemId: number): Promise<CarePlanItemRecord> {
    return this.post<CarePlanItemRecord>(
      `/clinical/care-plans/items/${itemId}/complete`,
      {},
      'Impossible de mettre à jour la progression du plan de soin.'
    );
  }

  async submitCheckIn(payload: ClinicalCheckInPayload): Promise<ClinicalCheckInItem> {
    return this.post<ClinicalCheckInItem>('/clinical/check-ins', payload, 'Impossible d’envoyer le check-in clinique.');
  }

  async getMyCheckIns(): Promise<ClinicalCheckInItem[]> {
    return this.get<ClinicalCheckInItem[]>('/clinical/check-ins/mine', 'Impossible de charger vos check-ins cliniques.');
  }

  async getDoctorCheckIns(patientId?: number): Promise<ClinicalCheckInItem[]> {
    const suffix = typeof patientId === 'number' ? `?patientId=${patientId}` : '';
    return this.get<ClinicalCheckInItem[]>(`/clinical/check-ins${suffix}`, 'Impossible de charger les check-ins patients.');
  }

  async getMySharedCarePlan(): Promise<ClinicalSharedCarePlan> {
    return this.get<ClinicalSharedCarePlan>('/clinical/shared-plan/mine', 'Impossible de charger le plan de soin partagé patient.');
  }

  async getDoctorSharedCarePlan(patientId: number): Promise<ClinicalSharedCarePlan> {
    return this.get<ClinicalSharedCarePlan>(
      `/clinical/patients/${patientId}/shared-plan`,
      'Impossible de charger le plan de soin partagé du patient.'
    );
  }

  async getMyMedicalReport(): Promise<ClinicalMedicalReport> {
    return this.get<ClinicalMedicalReport>('/clinical/medical-report/mine', 'Impossible de charger votre dossier médical.');
  }

  async getDoctorMedicalReport(patientId: number): Promise<ClinicalMedicalReport> {
    return this.get<ClinicalMedicalReport>(
      `/clinical/patients/${patientId}/medical-report`,
      'Impossible de charger le rapport médical du patient.'
    );
  }

  async suggestDifferentialDiagnosis(payload: {
    patientId: string;
    symptoms: string[];
    vitalSigns?: Record<string, unknown>;
    medicalHistory?: string[];
    age?: string;
    gender?: string;
  }): Promise<AiDiagnosisResponse> {
    return this.post<AiDiagnosisResponse>(
      '/ai/diagnosis/suggest',
      payload,
      'Impossible de générer des suggestions de diagnostic.'
    );
  }

  async analyzeUrgency(payload: {
    patientId: string;
    doctorId?: string;
    messageContent: string;
  }): Promise<AiUrgencyAnalysisResponse> {
    return this.post<AiUrgencyAnalysisResponse>(
      '/ai/analysis/message',
      payload,
      'Impossible d’analyser l’urgence du message.'
    );
  }

  async predictCompliance(payload: {
    carePlanId: string;
    patientId: string;
    daysSinceLastMessage: number;
    missedAppointments: number;
    recentMessages: string[];
    missedHomeVisits: number;
  }): Promise<AiCompliancePredictionResponse> {
    return this.post<AiCompliancePredictionResponse>(
      '/ai/compliance/predict',
      payload,
      'Impossible de prédire la conformité du patient.'
    );
  }

  async generatePatientSummary(payload: {
    patientId: string;
    patientName: string;
    age: number;
    conditions: string;
    medications: string;
    recentIssues: string;
  }): Promise<AiSummaryResponse> {
    return this.post<AiSummaryResponse>(
      '/ai/summary/generate',
      payload,
      'Impossible de générer le résumé patient.'
    );
  }

  async sendChatbotMessage(payload: {
    sessionId: string;
    patientId: string;
    message: string;
  }): Promise<AiChatbotResponse> {
    return this.post<AiChatbotResponse>(
      '/ai/chatbot/message',
      payload,
      'Impossible d’envoyer le message au chatbot IA.'
    );
  }

  async getInAppNotifications(): Promise<InAppNotificationItem[]> {
    const headers = this.buildAuthHeaders();
    try {
      return await firstValueFrom(
        this.http.get<InAppNotificationItem[]>(`${ApiConfig.backendBaseUrl}/api/v1/notifications`, { headers })
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de charger les notifications.'));
    }
  }

  async markNotificationAsRead(notificationId: number): Promise<void> {
    const headers = this.buildAuthHeaders();
    try {
      await firstValueFrom(
        this.http.patch<void>(`${ApiConfig.backendBaseUrl}/api/v1/notifications/${notificationId}/read`, {}, { headers })
      );
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, 'Impossible de marquer la notification comme lue.'));
    }
  }

  private async get<T>(path: string, fallback: string): Promise<T> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(this.http.get<T>(`${ClinicalCareService.API_BASE_URL}${path}`, { headers }));
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, fallback));
    }
  }

  private async post<T>(path: string, body: unknown, fallback: string): Promise<T> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(this.http.post<T>(`${ClinicalCareService.API_BASE_URL}${path}`, body, { headers }));
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, fallback));
    }
  }

  private async put<T>(path: string, body: unknown, fallback: string): Promise<T> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(this.http.put<T>(`${ClinicalCareService.API_BASE_URL}${path}`, body, { headers }));
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, fallback));
    }
  }

  private async patch<T>(path: string, body: unknown, fallback: string): Promise<T> {
    try {
      const headers = this.buildAuthHeaders();
      return await firstValueFrom(this.http.patch<T>(`${ClinicalCareService.API_BASE_URL}${path}`, body, { headers }));
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, fallback));
    }
  }

  private async delete(path: string, fallback: string): Promise<void> {
    try {
      const headers = this.buildAuthHeaders();
      await firstValueFrom(this.http.delete<void>(`${ClinicalCareService.API_BASE_URL}${path}`, { headers }));
    } catch (error) {
      throw new Error(this.extractErrorMessage(error, fallback));
    }
  }

  private buildAuthHeaders(): HttpHeaders {
    const token = this.authService.session?.accessToken?.trim();
    if (!token) {
      throw new Error('Session invalide: token manquant.');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
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
