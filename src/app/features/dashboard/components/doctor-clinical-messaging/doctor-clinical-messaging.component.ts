import { Component, OnDestroy, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import {
  ClinicalSentimentAnalysis,
  ClinicalCareService,
  ClinicalSentimentHistoryItem,
  ClinicalMessageAttachment,
  ClinicalMessageItem,
  ClinicalMessageTemplate,
  InAppNotificationItem,
  SentimentSeverity
} from '../../../../core/services/clinical-care.service';
import {
  DoctorAppointmentItem,
  DoctorAppointmentsService,
  VideoCallStatusResponse
} from '../../../../core/services/doctor-appointments.service';

type MessageContext = 'RECHUTE' | 'CRAVING' | 'MOTIVATION' | 'DETRESSE' | 'INFO';

interface ChatPatientItem {
  patientId: number;
  patientName: string;
  appointmentCount: number;
  lastAppointmentDateTime: string;
  lastReason: string;
  avatarUrl?: string | null;
}

interface ChatMessageGroup {
  mine: boolean;
  senderName: string;
  senderAvatar?: string | null;
  items: ClinicalMessageItem[];
}

interface SmartTemplateSuggestion {
  context: MessageContext;
  value: string;
}

interface PendingVideoCallRequest {
  appointmentId: number;
  requestedAt: string;
  reason: string;
}

interface ActiveVideoCallState {
  roomId: string;
  scheduledAt: string;
  appointmentId: number;
}

@Component({
  selector: 'app-doctor-clinical-messaging',
  templateUrl: './doctor-clinical-messaging.component.html',
  styleUrl: './doctor-clinical-messaging.component.css',
  standalone: false
})
export class DoctorClinicalMessagingComponent implements OnInit, OnDestroy {
  searchTerm = '';
  draftMessage = '';
  selectedTemplate: ClinicalMessageTemplate = 'GENERAL';
  selectedAttachment: File | null = null;
  isUploadingAttachment = false;
  pushEnabled = false;
  unreadNotificationCount = 0;
  latestPushPreview = '';

  readonly responseTemplates: Record<MessageContext, string[]> = {
    RECHUTE: [
      'Merci de votre honnêteté. Nous allons travailler ensemble pour comprendre ce qui s’est passé.',
      'Merci de me l’avoir dit. Nous allons reprendre étape par étape, sans jugement.'
    ],
    CRAVING: [
      'Essayez une technique de distraction pendant 10 minutes puis revenez vers moi.',
      'Prenez une respiration profonde, changez d’environnement 10 minutes et hydratez-vous.'
    ],
    DETRESSE: [
      'Je suis avec vous. Décrivez ce que vous ressentez maintenant pour avancer ensemble.',
      'Merci de partager cela. Nous allons stabiliser la situation en priorité.'
    ],
    MOTIVATION: [
      'Excellent progrès, continuez ainsi 👏',
      'Bravo pour vos efforts constants, vous êtes sur une belle dynamique.'
    ],
    INFO: [
      'Merci pour votre message. Pouvez-vous me donner un peu plus de détails ?',
      'Bien reçu. Je reste disponible pour ajuster votre plan si nécessaire.'
    ]
  };

  isLoading = false;
  isPatientsLoading = false;
  isSending = false;
  errorMessage = '';
  successMessage = '';

  patients: ChatPatientItem[] = [];
  selectedPatientId: number | null = null;
  thread: ClinicalMessageItem[] = [];
  sentimentHistory: ClinicalSentimentHistoryItem[] = [];
  notifications: InAppNotificationItem[] = [];
  pendingVideoCall: PendingVideoCallRequest | null = null;
  activeVideoCall: ActiveVideoCallState | null = null;
  videoCallStatusLabel = '';
  proposedVideoCallDateTimeLocal = '';
  acceptVideoCallDateTimeLocal = '';
  videoCallDecisionNote = '';

  private refreshTimer: number | null = null;
  private notificationTimer: number | null = null;
  private isDestroyed = false;

  constructor(
    private readonly clinicalCareService: ClinicalCareService,
    private readonly doctorAppointmentsService: DoctorAppointmentsService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone
  ) {}

  ngOnInit(): void {
    void this.loadAcceptedPatients();
    void this.refreshPushNotifications();
    this.refreshTimer = window.setInterval(() => {
      void this.loadThread(true);
    }, 6000);

    this.notificationTimer = window.setInterval(() => {
      if (this.pushEnabled) {
        void this.refreshPushNotifications(true);
      }
    }, 12000);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.notificationTimer !== null) {
      window.clearInterval(this.notificationTimer);
      this.notificationTimer = null;
    }
  }

  private runInAngular(fn: () => void): void {
    if (this.isDestroyed) {
      return;
    }
    this.ngZone.run(() => {
      try {
        fn();
      } catch (err) {
        console.error('Error in runInAngular callback:', err);
      } finally {
        setTimeout(() => {
          if (!this.isDestroyed) {
            this.cdr?.detectChanges();
          }
        }, 0);
      }
    });
  }

  private safeParseDate(dateStr: string | undefined | null): Date {
    if (!dateStr) return new Date(0);
    const isoStr = dateStr.includes(' ') && !dateStr.includes('T') 
      ? dateStr.replace(' ', 'T') 
      : dateStr;
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  get selectedPatient(): ChatPatientItem | null {
    if (this.selectedPatientId === null) {
      return null;
    }
    return this.patients.find((item) => item.patientId === this.selectedPatientId) ?? null;
  }

  get filteredPatients(): ChatPatientItem[] {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      return this.patients;
    }

    return this.patients.filter((item) => {
      return item.patientName.toLowerCase().includes(query)
        || item.lastReason.toLowerCase().includes(query);
    });
  }

  get groupedThread(): ChatMessageGroup[] {
    const groups: ChatMessageGroup[] = [];

    for (const item of this.thread) {
      const mine = this.isMine(item);
      const senderName = mine ? 'Doctor' : (item.patientName || this.selectedPatient?.patientName || 'Patient');
      const senderAvatar = null;
      const previous = groups[groups.length - 1];

      if (!previous || previous.mine !== mine) {
        groups.push({
          mine,
          senderName,
          senderAvatar,
          items: [item]
        });
      } else {
        previous.items.push(item);
      }
    }

    return groups;
  }

  get detectedContext(): MessageContext {
    return this.detectContext(this.draftMessage);
  }

  get suggestedReplies(): string[] {
    return this.responseTemplates[this.detectedContext] ?? this.responseTemplates.INFO;
  }

  get smartSuggestions(): SmartTemplateSuggestion[] {
    return this.suggestedReplies.map((value) => ({
      context: this.detectedContext,
      value
    }));
  }

  get latestSentimentHistory(): ClinicalSentimentHistoryItem[] {
    return [...this.sentimentHistory]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }

  get highSentimentCount(): number {
    return this.sentimentHistory.filter((item) => item.severity === 'HIGH').length;
  }

  get sentimentTrendLabel(): string {
    const items = this.latestSentimentHistory;
    if (items.length === 0) {
      return 'Aucune donnée';
    }

    const current = items[0];
    if (current.severity === 'HIGH') {
      return 'Vigilance élevée';
    }
    if (current.severity === 'MEDIUM') {
      return 'Vigilance modérée';
    }
    return 'État stable';
  }

  async loadAcceptedPatients(): Promise<void> {
    this.runInAngular(() => {
      this.isPatientsLoading = true;
      this.errorMessage = '';
    });

    try {
      const appointments = await this.doctorAppointmentsService.getDoctorAppointments();
      this.runInAngular(() => {
        this.patients = this.buildAcceptedPatients(appointments || []);

        if (this.patients.length === 0) {
          this.selectedPatientId = null;
          this.thread = [];
          this.sentimentHistory = [];
        } else {
          const hasSelected = this.selectedPatientId !== null
            && this.patients.some((item) => item.patientId === this.selectedPatientId);

          if (!hasSelected) {
            this.selectedPatientId = this.patients[0].patientId;
          }
        }
      });
      
      if (this.patients.length > 0) {
        await this.loadThread(true);
      }
    } catch (error) {
      this.runInAngular(() => {
        this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les patients avec RDV accepté.';
      });
    } finally {
      this.runInAngular(() => {
        this.isPatientsLoading = false;
      });
    }
  }

  async selectPatient(patientId: number): Promise<void> {
    if (this.selectedPatientId === patientId) {
      return;
    }
    this.selectedPatientId = patientId;
    await this.loadThread();
  }

  async loadThread(silent = false): Promise<void> {
    const patientId = this.selectedPatientId;
    if (patientId === null) {
      this.runInAngular(() => {
        if (!silent) {
          this.errorMessage = 'Sélectionnez un patient pour ouvrir la messagerie.';
        }
        this.thread = [];
        this.sentimentHistory = [];
      });
      return;
    }

    if (!silent) {
      this.runInAngular(() => {
        this.isLoading = true;
        this.errorMessage = '';
      });
    }

    try {
      const [thread, history, appointments] = await Promise.all([
        this.clinicalCareService.getThread({ patientId }),
        this.clinicalCareService.getSentimentHistory(patientId),
        this.doctorAppointmentsService.getDoctorAppointments()
      ]);
      const pendingVideoCall = this.resolvePendingVideoCallRequest(patientId, appointments);
      const candidateActiveVideoCall = this.resolveActiveVideoCall(patientId, appointments);
      const activeVideoCall = await this.resolveConfirmedActiveVideoCall(candidateActiveVideoCall);
      
      this.runInAngular(() => {
        this.thread = thread;
        this.sentimentHistory = history;
        this.pendingVideoCall = pendingVideoCall;
        this.activeVideoCall = activeVideoCall;
        this.videoCallStatusLabel = this.activeVideoCall
          ? 'En direct'
          : (candidateActiveVideoCall ? 'Terminé' : 'Aucun appel actif');
      });
    } catch (error) {
      if (!silent) {
        this.runInAngular(() => {
          this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger la conversation.';
        });
      }
    } finally {
      if (!silent) {
        this.runInAngular(() => {
          this.isLoading = false;
        });
      }
    }
  }

  async acceptPendingVideoCall(): Promise<void> {
    if (!this.pendingVideoCall) {
      return;
    }
    this.isSending = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const iso = this.acceptVideoCallDateTimeLocal
        ? this.toIsoFromDatetimeLocal(this.acceptVideoCallDateTimeLocal)
        : null;
      await this.doctorAppointmentsService.acceptVideoCallRequest(
        this.pendingVideoCall.appointmentId,
        iso ?? undefined
      );
      this.acceptVideoCallDateTimeLocal = '';
      await this.loadThread();
      this.successMessage = 'Demande d\'appel vidéo acceptée — appel activé pour le patient.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible d\'accepter la demande d\'appel vidéo.';
    } finally {
      this.isSending = false;
    }
  }

  async rejectPendingVideoCall(): Promise<void> {
    if (!this.pendingVideoCall) {
      return;
    }
    this.isSending = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.doctorAppointmentsService.rejectVideoCallRequest(
        this.pendingVideoCall.appointmentId,
        this.videoCallDecisionNote.trim() || undefined
      );
      this.videoCallDecisionNote = '';
      await this.loadThread();
      this.successMessage = 'Demande d’appel vidéo rejetée.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de rejeter la demande d’appel vidéo.';
    } finally {
      this.isSending = false;
    }
  }

  async proposeAlternativeVideoCall(): Promise<void> {
    if (!this.pendingVideoCall) {
      return;
    }
    const localValue = this.proposedVideoCallDateTimeLocal.trim();
    if (!localValue) {
      this.errorMessage = 'Choisissez une date/heure pour proposer un autre créneau.';
      return;
    }
    const iso = this.toIsoFromDatetimeLocal(localValue);
    if (!iso) {
      this.errorMessage = 'Date/heure invalide.';
      return;
    }

    this.isSending = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.doctorAppointmentsService.proposeVideoCallAlternative(
        this.pendingVideoCall.appointmentId,
        iso,
        this.videoCallDecisionNote.trim() || undefined
      );
      this.proposedVideoCallDateTimeLocal = '';
      this.videoCallDecisionNote = '';
      await this.loadThread();
      this.successMessage = 'Nouveau créneau proposé (appel non activé).';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de proposer un autre créneau.';
    } finally {
      this.isSending = false;
    }
  }

  async sendMessage(): Promise<void> {
    const patientId = this.selectedPatientId;
    const content = this.draftMessage.trim();

    if (patientId === null) {
      this.errorMessage = 'Sélectionnez un patient pour envoyer un message.';
      return;
    }

    if (!content && !this.selectedAttachment) {
      this.errorMessage = 'Le message est vide.';
      return;
    }

    this.isSending = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      let attachmentPayload: ClinicalMessageAttachment | undefined;
      if (this.selectedAttachment) {
        this.isUploadingAttachment = true;
        attachmentPayload = await this.clinicalCareService.uploadMessageAttachment(this.selectedAttachment, patientId);
      }

      await this.clinicalCareService.sendMessage({
        patientId,
        templateType: this.selectedTemplate,
        content: content || 'Document médical joint.',
        attachment: attachmentPayload
      });
      this.draftMessage = '';
      this.selectedAttachment = null;
      await this.loadThread();
      this.successMessage = 'Message envoyé ✔️';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible d’envoyer le message.';
    } finally {
      this.isSending = false;
      this.isUploadingAttachment = false;
    }
  }

  useSuggestion(value: string): void {
    this.draftMessage = value;
  }

  applyTemplateSuggestion(suggestion: SmartTemplateSuggestion): void {
    this.selectedTemplate = this.mapContextToTemplate(suggestion.context);
    this.draftMessage = suggestion.value;
    this.successMessage = 'Modèle appliqué, vous pouvez modifier avant envoi.';
  }

  onAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (!file) {
      return;
    }
    this.selectedAttachment = file;
    this.successMessage = `Pièce jointe prête: ${file.name}`;
    input.value = '';
  }

  removeAttachment(): void {
    this.selectedAttachment = null;
  }

  togglePushNotifications(): void {
    this.pushEnabled = !this.pushEnabled;
    if (this.pushEnabled) {
      this.successMessage = 'Notifications push activées.';
      void this.refreshPushNotifications();
    } else {
      this.successMessage = 'Notifications push désactivées.';
    }
  }

  async refreshPushNotifications(silent = false): Promise<void> {
    try {
      const notifications = await this.clinicalCareService.getInAppNotifications();
      this.notifications = notifications;
      this.unreadNotificationCount = notifications.filter((item) => !item.read).length;
      if (this.pushEnabled && this.unreadNotificationCount > 0) {
        const latest = notifications.find((item) => !item.read) ?? notifications[0];
        this.latestPushPreview = latest ? `${latest.title}: ${latest.content}` : '';
      }
      if (!silent && this.pushEnabled && this.unreadNotificationCount === 0) {
        this.latestPushPreview = 'Aucune nouvelle notification.';
      }
    } catch {
      if (!silent) {
        this.latestPushPreview = 'Notifications indisponibles.';
      }
    }
  }

  async markAllPushNotificationsAsRead(): Promise<void> {
    const unread = this.notifications.filter((item) => !item.read);
    if (unread.length === 0) {
      return;
    }

    for (const notification of unread) {
      try {
        await this.clinicalCareService.markNotificationAsRead(notification.id);
      } catch {
        break;
      }
    }

    await this.refreshPushNotifications(true);
    this.successMessage = 'Notifications marquées comme lues.';
  }

  patientInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  formatTime(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) {
      return '';
    }
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  canSend(): boolean {
    return !this.isSending && (this.draftMessage.trim().length > 0 || !!this.selectedAttachment);
  }

  isMine(message: ClinicalMessageItem): boolean {
    return (message.senderRole || '').toUpperCase() === 'DOCTOR';
  }

  contextBadgeLabel(message: ClinicalMessageItem): string {
    const context = this.resolveMessageContext(message);
    if (context === 'RECHUTE') return 'Rechute';
    if (context === 'CRAVING') return 'Craving';
    if (context === 'DETRESSE') return 'Détresse';
    if (context === 'MOTIVATION') return 'Motivation';
    return 'Info';
  }

  contextBadgeClass(message: ClinicalMessageItem): string {
    const context = this.resolveMessageContext(message);
    return `ctx-${context.toLowerCase()}`;
  }

  sentIndicator(message: ClinicalMessageItem): string {
    if (this.isMine(message)) {
      return message.readAt ? 'ri-check-double-line' : 'ri-check-line';
    }
    return '';
  }

  sentIndicatorLabel(message: ClinicalMessageItem): string {
    if (!this.isMine(message)) {
      return '';
    }
    return message.readAt ? 'Lu' : 'Envoyé';
  }

  patientMessageAnalysis(message: ClinicalMessageItem): ClinicalSentimentAnalysis | null {
    if (this.isMine(message)) {
      return null;
    }
    return message.sentimentAnalysis ?? null;
  }

  severityClass(severity: SentimentSeverity): string {
    if (severity === 'HIGH') return 'sev-high';
    if (severity === 'MEDIUM') return 'sev-medium';
    return 'sev-low';
  }

  severityEmoji(severity: SentimentSeverity): string {
    if (severity === 'HIGH') return 'ri-alert-line';
    if (severity === 'MEDIUM') return 'ri-error-warning-line';
    return 'ri-checkbox-circle-line';
  }

  formatSentimentScore(score: number | null | undefined): string {
    if (typeof score !== 'number' || Number.isNaN(score)) {
      return '0.00';
    }
    return score.toFixed(2);
  }

  sentimentBarWidth(score: number | null | undefined): number {
    if (typeof score !== 'number' || Number.isNaN(score)) {
      return 0;
    }
    const bounded = Math.max(0, Math.min(1, score));
    return Math.round(bounded * 100);
  }

  emotionLabel(emotion: string | null | undefined): string {
    const normalized = (emotion || '').toUpperCase();
    if (normalized === 'CRAVING') return 'CRAVING';
    if (normalized === 'STRESS') return 'STRESS';
    if (normalized === 'MOTIVATION') return 'MOTIVATION';
    return 'NORMAL';
  }

  attachmentUrl(path: string): string {
    if (!path) {
      return '#';
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `http://localhost:8080${path}`;
  }

  private mapContextToTemplate(context: MessageContext): ClinicalMessageTemplate {
    if (context === 'RECHUTE' || context === 'CRAVING' || context === 'MOTIVATION' || context === 'DETRESSE') {
      return context;
    }
    return 'INFO';
  }

  private detectContext(raw: string): MessageContext {
    const text = raw.toLowerCase();
    if (this.containsAny(text, ['rechute', 'j ai repris', 'j\'ai repris', 'relapse', 'consommé', 'consomme'])) {
      return 'RECHUTE';
    }
    if (this.containsAny(text, ['craving', 'envie forte', 'tentation', 'manque', 'envie de consommer'])) {
      return 'CRAVING';
    }
    if (this.containsAny(text, ['motivé', 'motivation', 'fier', 'progrès', 'progress'])) {
      return 'MOTIVATION';
    }
    if (this.containsAny(text, ['détresse', 'detresse', 'angoisse', 'panic', 'déprime', 'deprime', 'triste'])) {
      return 'DETRESSE';
    }
    return 'INFO';
  }

  private resolveMessageContext(message: ClinicalMessageItem): MessageContext {
    const template = (message.templateType || '').toUpperCase();
    if (template === 'RECHUTE' || template === 'RELAPSE') {
      return 'RECHUTE';
    }
    if (template === 'CRAVING') {
      return 'CRAVING';
    }
    if (template === 'MOTIVATION') {
      return 'MOTIVATION';
    }
    if (template === 'DETRESSE') {
      return 'DETRESSE';
    }
    if (template === 'INFO' || template === 'GENERAL') {
      return 'INFO';
    }
    if (template.startsWith('VIDEO_CALL_')) {
      return 'INFO';
    }
    return this.detectContext(message.content || '');
  }

  private containsAny(value: string, keywords: string[]): boolean {
    return keywords.some((keyword) => value.includes(keyword));
  }

  private buildAcceptedPatients(appointments: DoctorAppointmentItem[]): ChatPatientItem[] {
    const acceptedAppointments = appointments.filter((item) => item.status === 'ACCEPTED');
    const grouped = new Map<number, ChatPatientItem>();

    for (const item of acceptedAppointments) {
      const existing = grouped.get(item.patientId);
      if (!existing) {
        grouped.set(item.patientId, {
          patientId: item.patientId,
          patientName: item.patientName,
          appointmentCount: 1,
          lastAppointmentDateTime: item.appointmentDateTime,
          lastReason: item.reason || 'Conversation disponible',
          avatarUrl: null
        });
        continue;
      }

      existing.appointmentCount += 1;
      const dateCurrent = this.safeParseDate(item.appointmentDateTime).getTime();
      const dateExisting = this.safeParseDate(existing.lastAppointmentDateTime).getTime();
      if (dateCurrent > dateExisting) {
        existing.lastAppointmentDateTime = item.appointmentDateTime;
        existing.lastReason = item.reason || existing.lastReason;
      }
    }

    return Array.from(grouped.values()).sort((a, b) => {
      const dateA = this.safeParseDate(a.lastAppointmentDateTime).getTime();
      const dateB = this.safeParseDate(b.lastAppointmentDateTime).getTime();
      return dateB - dateA;
    });
  }

  private resolvePendingVideoCallRequest(patientId: number, appointments: DoctorAppointmentItem[]): PendingVideoCallRequest | null {
    // Use visitType=VIDEO + status=PENDING only — no fragile text matching
    const pending = appointments
      .filter((item) => item.patientId === patientId)
      .filter((item) => item.status === 'PENDING')
      .filter((item) => item.visitType === 'VIDEO');

    if (pending.length === 0) {
      return null;
    }

    const latest = pending.sort((a, b) => {
      const dateA = this.safeParseDate(a.createdAt).getTime();
      const dateB = this.safeParseDate(b.createdAt).getTime();
      return dateB - dateA;
    })[0];
    // Strip backend-injected prefix for clean display
    const cleanReason = (latest.reason || '').replace(/^Demande d['']appel vid[eé]o\s*:\s*/i, '').trim();
    return {
      appointmentId: latest.id,
      requestedAt: latest.appointmentDateTime,
      reason: cleanReason
    };
  }

  private resolveActiveVideoCall(patientId: number, appointments: DoctorAppointmentItem[]): ActiveVideoCallState | null {
    const now = new Date();
    const videoAppt = appointments
      .filter((item) => item.patientId === patientId)
      .filter((item) => item.status === 'ACCEPTED')
      .filter((item) => item.visitType === 'VIDEO')
      .filter((item) => !!(item as any).videoCallEnabled)
      .filter((item) => !!(item as any).videoCallRoomId)
      .filter((item) => {
        const scheduled = new Date((item as any).videoCallScheduledAt);
        if (isNaN(scheduled.getTime())) return false;
        const start = new Date(scheduled.getTime() - 5 * 60 * 1000);
        const end = new Date(scheduled.getTime() + 60 * 60 * 1000);
        return now >= start && now <= end;
      });

    if (videoAppt.length === 0) return null;
    const appt = videoAppt[0] as any;
    return {
      roomId: appt.videoCallRoomId,
      scheduledAt: appt.videoCallScheduledAt,
      appointmentId: appt.id
    };
  }

  private async resolveConfirmedActiveVideoCall(candidate: ActiveVideoCallState | null): Promise<ActiveVideoCallState | null> {
    if (!candidate) {
      return null;
    }
    try {
      const status: VideoCallStatusResponse = await this.doctorAppointmentsService.getVideoCallStatus(candidate.appointmentId);
      if (status.active !== true) {
        return null;
      }
      const roomId = (status.roomId || '').trim();
      if (!roomId) {
        return null;
      }
      return {
        appointmentId: candidate.appointmentId,
        roomId,
        scheduledAt: status.scheduledAt || candidate.scheduledAt
      };
    } catch {
      return null;
    }
  }

  joinActiveVideoCall(): void {
    const roomId = this.activeVideoCall?.roomId;
    if (!roomId) return;
    window.open(`https://meet.jit.si/${roomId}`, '_blank', 'noopener,noreferrer');
  }

  getVideoCallLabel(templateType: string | null | undefined): string {
    const t = (templateType || '').toUpperCase();
    if (t === 'VIDEO_CALL_REQUEST') return 'Demande d\'appel vidéo';
    if (t === 'VIDEO_CALL_ACCEPTED') return 'Appel vidéo accepté';
    if (t === 'VIDEO_CALL_REJECTED') return 'Appel vidéo rejeté';
    if (t === 'VIDEO_CALL_SCHEDULED') return 'Nouveau créneau proposé';
    return 'Vidéo';
  }

  private toIsoFromDatetimeLocal(value: string): string | null {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) {
      return null;
    }
    return dt.toISOString();
  }
}
