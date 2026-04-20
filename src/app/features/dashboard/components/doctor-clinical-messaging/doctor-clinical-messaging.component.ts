import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  ClinicalCareService,
  ClinicalMessageAttachment,
  ClinicalMessageItem,
  ClinicalMessageTemplate,
  InAppNotificationItem
} from '../../../../core/services/clinical-care.service';
import { DoctorAppointmentItem, DoctorAppointmentsService } from '../../../../core/services/doctor-appointments.service';

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
  notifications: InAppNotificationItem[] = [];

  private refreshTimer: number | null = null;
  private notificationTimer: number | null = null;

  constructor(
    private readonly clinicalCareService: ClinicalCareService,
    private readonly doctorAppointmentsService: DoctorAppointmentsService
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
    if (this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.notificationTimer !== null) {
      window.clearInterval(this.notificationTimer);
      this.notificationTimer = null;
    }
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

  async loadAcceptedPatients(): Promise<void> {
    this.isPatientsLoading = true;
    this.errorMessage = '';

    try {
      const appointments = await this.doctorAppointmentsService.getDoctorAppointments();
      this.patients = this.buildAcceptedPatients(appointments);

      if (this.patients.length === 0) {
        this.selectedPatientId = null;
        this.thread = [];
        return;
      }

      const hasSelected = this.selectedPatientId !== null
        && this.patients.some((item) => item.patientId === this.selectedPatientId);

      if (!hasSelected) {
        this.selectedPatientId = this.patients[0].patientId;
      }

      await this.loadThread(true);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les patients avec RDV accepté.';
    } finally {
      this.isPatientsLoading = false;
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
      if (!silent) {
        this.errorMessage = 'Sélectionnez un patient pour ouvrir la messagerie.';
      }
      this.thread = [];
      return;
    }

    if (!silent) {
      this.isLoading = true;
      this.errorMessage = '';
    }

    try {
      this.thread = await this.clinicalCareService.getThread({ patientId });
    } catch (error) {
      if (!silent) {
        this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger la conversation.';
      }
    } finally {
      if (!silent) {
        this.isLoading = false;
      }
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
    if (context === 'RECHUTE') return '🔴 Rechute';
    if (context === 'CRAVING') return '⚠️ Craving';
    if (context === 'DETRESSE') return '😟 Détresse';
    if (context === 'MOTIVATION') return '🟢 Motivation';
    return '❓ Info';
  }

  contextBadgeClass(message: ClinicalMessageItem): string {
    const context = this.resolveMessageContext(message);
    return `ctx-${context.toLowerCase()}`;
  }

  sentIndicator(message: ClinicalMessageItem): string {
    if (this.isMine(message)) {
      return message.readAt ? '👁️' : '✔️';
    }
    return '';
  }

  sentIndicatorLabel(message: ClinicalMessageItem): string {
    if (!this.isMine(message)) {
      return '';
    }
    return message.readAt ? 'Lu' : 'Envoyé';
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
      if (new Date(item.appointmentDateTime).getTime() > new Date(existing.lastAppointmentDateTime).getTime()) {
        existing.lastAppointmentDateTime = item.appointmentDateTime;
        existing.lastReason = item.reason || existing.lastReason;
      }
    }

    return Array.from(grouped.values()).sort((a, b) => {
      return new Date(b.lastAppointmentDateTime).getTime() - new Date(a.lastAppointmentDateTime).getTime();
    });
  }
}
