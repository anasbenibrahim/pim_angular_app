import { Component, OnInit } from '@angular/core';
import {
  CarePlanCreatePayload,
  CarePlanItemPayload,
  CarePlanItemRecord,
  ClinicalMedicalReport,
  ClinicalCareService
} from '../../../../core/services/clinical-care.service';
import {
  DoctorAppointmentItem,
  DoctorAppointmentsService,
  DoctorAppointmentVisitType
} from '../../../../core/services/doctor-appointments.service';

type WorkspaceView = 'cards' | 'plan' | 'report';

interface AcceptedPatientCard {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  acceptedCount: number;
  latestAppointmentAt?: string;
  appointments: DoctorAppointmentItem[];
}

interface PlanTaskDraft {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
}

interface PlanAppointmentDraft {
  appointmentDateTime: string;
  visitType: DoctorAppointmentVisitType;
  reason: string;
  notes: string;
  patientPhone: string;
}

@Component({
  selector: 'app-doctor-clinical-workspace',
  templateUrl: './doctor-clinical-workspace.component.html',
  styleUrl: './doctor-clinical-workspace.component.css',
  standalone: false
})
export class DoctorClinicalWorkspaceComponent implements OnInit {
  activeView: WorkspaceView = 'cards';
  acceptedPatients: AcceptedPatientCard[] = [];
  selectedPatient: AcceptedPatientCard | null = null;
  patientCarePlans: CarePlanItemRecord[] = [];
  selectedPlanId: number | null = null;
  medicalReport: ClinicalMedicalReport | null = null;

  isLoading = false;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  planTitle = '';
  planStartDate = '';
  planEndDate = '';
  taskDrafts: PlanTaskDraft[] = [];
  appointmentDrafts: PlanAppointmentDraft[] = [];

  showTaskModal = false;
  taskTitle = '';
  taskDescription = '';
  taskStartAt = '';
  taskEndAt = '';

  showAppointmentModal = false;
  appointmentDateTime = '';
  appointmentVisitType: DoctorAppointmentVisitType = 'CABINET';
  appointmentReason = '';
  appointmentNotes = '';
  appointmentPatientPhone = '';

  showConsultationNotesModal = false;
  notesAppointmentId: number | null = null;
  notesConsultationSummary = '';
  notesBehavioralPrescription = '';
  notesFollowUpDate = '';

  constructor(
    private readonly clinicalCareService: ClinicalCareService,
    private readonly doctorAppointmentsService: DoctorAppointmentsService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadAcceptedPatients();
  }

  get hasPlanEntries(): boolean {
    return this.taskDrafts.length > 0 || this.appointmentDrafts.length > 0;
  }

  get selectedPatientAppointments(): DoctorAppointmentItem[] {
    return this.selectedPatient?.appointments ?? [];
  }

  get isEditingPlan(): boolean {
    return this.selectedPlanId !== null;
  }

  async refreshPatients(): Promise<void> {
    await this.loadAcceptedPatients();
  }

  async openPlanBuilder(patient: AcceptedPatientCard): Promise<void> {
    this.selectedPatient = patient;
    this.activeView = 'plan';
    this.medicalReport = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.resetPlanForm();
    await this.loadPatientCarePlans(patient.id);
  }

  async openReport(patient: AcceptedPatientCard): Promise<void> {
    this.selectedPatient = patient;
    this.activeView = 'report';
    this.errorMessage = '';
    this.successMessage = '';
    this.isLoading = true;

    try {
      await this.reloadReportData(patient.id);
    } catch (error) {
      this.medicalReport = null;
      this.patientCarePlans = [];
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger le rapport patient.';
    } finally {
      this.isLoading = false;
    }
  }

  async deleteReportAppointment(appointmentId: number): Promise<void> {
    const patient = this.selectedPatient;
    if (!patient) {
      return;
    }
    if (!window.confirm('Supprimer ce rendez-vous ? Cette action supprimera aussi la consultation et les tâches liées à ce rendez-vous.')) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.clinicalCareService.deleteAppointment(appointmentId);
      await this.reloadReportData(patient.id);
      this.successMessage = 'Rendez-vous supprimé avec succès.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de supprimer le rendez-vous.';
    } finally {
      this.isSubmitting = false;
    }
  }

  async deleteReportConsultation(consultationNoteId: number): Promise<void> {
    const patient = this.selectedPatient;
    if (!patient) {
      return;
    }
    if (!window.confirm('Supprimer cette consultation ?')) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.clinicalCareService.deleteConsultationNote(consultationNoteId);
      await this.reloadReportData(patient.id);
      this.successMessage = 'Consultation supprimée avec succès.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de supprimer la consultation.';
    } finally {
      this.isSubmitting = false;
    }
  }

  async deleteReportTask(taskId: number): Promise<void> {
    const patient = this.selectedPatient;
    if (!patient) {
      return;
    }
    if (!window.confirm('Supprimer cette tâche ?')) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.clinicalCareService.deleteTask(taskId);
      await this.reloadReportData(patient.id);
      this.successMessage = 'Tâche supprimée avec succès.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de supprimer la tâche.';
    } finally {
      this.isSubmitting = false;
    }
  }

  async addNotesForAppointment(appointmentId: number, currentSummary?: string | null): Promise<void> {
    this.showConsultationNotesModal = true;
    this.notesAppointmentId = appointmentId;
    this.notesConsultationSummary = (currentSummary ?? '').trim();
    this.notesBehavioralPrescription = '';
    this.notesFollowUpDate = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeConsultationNotesModal(): void {
    this.showConsultationNotesModal = false;
    this.notesAppointmentId = null;
    this.notesConsultationSummary = '';
    this.notesBehavioralPrescription = '';
    this.notesFollowUpDate = '';
  }

  async submitConsultationNotes(): Promise<void> {
    const appointmentId = this.notesAppointmentId;
    if (!appointmentId) {
      this.errorMessage = 'Rendez-vous invalide.';
      return;
    }

    const consultationSummary = this.notesConsultationSummary.trim();
    if (!consultationSummary) {
      this.errorMessage = 'Les notes de consultation sont obligatoires.';
      return;
    }

    const followUpDate = this.notesFollowUpDate.trim();

    if (followUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)) {
      this.errorMessage = 'Format date invalide. Utilisez YYYY-MM-DD.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.clinicalCareService.upsertConsultationNote(appointmentId, {
        consultationSummary,
        behavioralPrescription: this.notesBehavioralPrescription.trim() || undefined,
        followUpDate: followUpDate || undefined
      });

      if (this.selectedPatient) {
        await this.reloadReportData(this.selectedPatient.id);
      }

      this.closeConsultationNotesModal();
      this.successMessage = 'Notes ajoutées avec succès.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible d’ajouter les notes.';
    } finally {
      this.isSubmitting = false;
    }
  }

  backToCards(): void {
    this.activeView = 'cards';
    this.selectedPatient = null;
    this.patientCarePlans = [];
    this.selectedPlanId = null;
    this.medicalReport = null;
    this.closeTaskModal();
    this.closeAppointmentModal();
    this.closeConsultationNotesModal();
    this.errorMessage = '';
    this.successMessage = '';
  }

  startNewPlan(): void {
    this.selectedPlanId = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.resetPlanForm();
  }

  editExistingPlan(plan: CarePlanItemRecord): void {
    this.selectedPlanId = plan.id;
    this.planTitle = plan.title;
    this.planStartDate = plan.weekStartDate;
    this.planEndDate = plan.weekEndDate;
    this.taskDrafts = [];
    this.appointmentDrafts = [];
    this.closeTaskModal();
    this.closeAppointmentModal();
    this.errorMessage = '';
    this.successMessage = 'Ajoutez plusieurs nouvelles tâches ou plusieurs nouveaux rendez-vous à ce plan.';
  }

  openTaskModal(): void {
    this.showTaskModal = true;
    this.errorMessage = '';
  }

  closeTaskModal(): void {
    this.showTaskModal = false;
    this.taskTitle = '';
    this.taskDescription = '';
    this.taskStartAt = '';
    this.taskEndAt = '';
  }

  saveTaskDraft(): void {
    const title = this.taskTitle.trim();
    if (!title) {
      this.errorMessage = 'Le titre de la tâche est obligatoire.';
      return;
    }
    if (!this.taskStartAt || !this.taskEndAt) {
      this.errorMessage = 'Les dates de début et de fin de la tâche sont obligatoires.';
      return;
    }
    if (new Date(this.taskEndAt).getTime() < new Date(this.taskStartAt).getTime()) {
      this.errorMessage = 'La date de fin de la tâche doit être après la date de début.';
      return;
    }

    this.taskDrafts = [
      ...this.taskDrafts,
      {
        title,
        description: this.taskDescription.trim(),
        startAt: this.taskStartAt,
        endAt: this.taskEndAt
      }
    ];

    this.successMessage = 'Tâche ajoutée au plan.';
    this.errorMessage = '';
    this.closeTaskModal();
  }

  removeTaskDraft(index: number): void {
    this.taskDrafts = this.taskDrafts.filter((_, itemIndex) => itemIndex !== index);
  }

  openAppointmentModal(): void {
    this.showAppointmentModal = true;
    this.errorMessage = '';
    this.appointmentPatientPhone = this.selectedPatient?.phone ?? '';
  }

  closeAppointmentModal(): void {
    this.showAppointmentModal = false;
    this.appointmentDateTime = '';
    this.appointmentVisitType = 'CABINET';
    this.appointmentReason = '';
    this.appointmentNotes = '';
    this.appointmentPatientPhone = '';
  }

  saveAppointmentDraft(): void {
    if (!this.appointmentDateTime) {
      this.errorMessage = 'La date du rendez-vous est obligatoire.';
      return;
    }
    if (new Date(this.appointmentDateTime).getTime() <= Date.now()) {
      this.errorMessage = 'Le rendez-vous doit être planifié dans le futur.';
      return;
    }

    const reason = this.appointmentReason.trim();
    if (!reason) {
      this.errorMessage = 'Le motif du rendez-vous est obligatoire.';
      return;
    }

    this.appointmentDrafts = [
      ...this.appointmentDrafts,
      {
        appointmentDateTime: this.appointmentDateTime,
        visitType: this.appointmentVisitType,
        reason,
        notes: this.appointmentNotes.trim(),
        patientPhone: this.appointmentPatientPhone.trim()
      }
    ];

    this.successMessage = 'Rendez-vous ajouté au plan.';
    this.errorMessage = '';
    this.closeAppointmentModal();
  }

  removeAppointmentDraft(index: number): void {
    this.appointmentDrafts = this.appointmentDrafts.filter((_, itemIndex) => itemIndex !== index);
  }

  async submitPersonalizedPlan(): Promise<void> {
    const patient = this.selectedPatient;
    if (!patient) {
      this.errorMessage = 'Choisissez un patient avant de créer le plan de soin.';
      return;
    }

    const title = this.planTitle.trim();
    if (!title || !this.planStartDate || !this.planEndDate) {
      this.errorMessage = 'Le titre, la date début et la date fin du plan sont obligatoires.';
      return;
    }
    if (new Date(this.planEndDate).getTime() < new Date(this.planStartDate).getTime()) {
      this.errorMessage = 'La date fin du plan doit être après la date début.';
      return;
    }
    if (!this.isEditingPlan && !this.hasPlanEntries) {
      this.errorMessage = 'Ajoutez au moins une tâche ou un rendez-vous au plan.';
      return;
    }

    const payload: CarePlanCreatePayload = {
      patientId: patient.id,
      title,
      weekStartDate: this.planStartDate,
      weekEndDate: this.planEndDate,
      items: this.buildCarePlanItems()
    };
    const wasEditing = this.selectedPlanId !== null;
    const editingPlanId = this.selectedPlanId;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      if (editingPlanId) {
        await this.clinicalCareService.updateCarePlan(editingPlanId, payload);
      } else {
        await this.clinicalCareService.createCarePlan(payload);
      }

      await this.persistPlanLinkedEntries(patient.id);

      await this.loadAcceptedPatients();
      await this.loadPatientCarePlans(patient.id);
      const updatedPatient = this.acceptedPatients.find((item) => item.id === patient.id) ?? patient;
      this.selectedPatient = updatedPatient;
      this.resetPlanForm();
      this.successMessage = wasEditing
        ? 'Plan de soin modifié avec succès.'
        : 'Plan de soin personnalisé créé avec succès.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible d’enregistrer le plan de soin.';
    } finally {
      this.isSubmitting = false;
    }
  }

  visitTypeLabel(visitType: DoctorAppointmentVisitType): string {
    return visitType === 'VIDEO' ? 'Téléconsultation' : 'Cabinet';
  }

  sharedVisitTypeLabel(visitType: string | null | undefined): string {
    return (visitType ?? '').toUpperCase() === 'VIDEO' ? 'Téléconsultation' : 'Cabinet';
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return 'Non renseigné';
    }
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  carePlanStatusLabel(status: string | null | undefined): string {
    switch ((status ?? '').toUpperCase()) {
      case 'ACTIVE':
        return 'Actif';
      case 'COMPLETED':
        return 'Terminé';
      case 'DRAFT':
        return 'Brouillon';
      default:
        return status || 'Non renseigné';
    }
  }

  appointmentStatusLabel(status: string | null | undefined): string {
    switch ((status ?? '').toUpperCase()) {
      case 'ACCEPTED':
        return 'Accepté';
      case 'PENDING':
        return 'En attente';
      case 'REJECTED':
        return 'Refusé';
      case 'COMPLETED':
        return 'Terminé';
      case 'CANCELLED':
        return 'Annulé';
      default:
        return status || 'Non renseigné';
    }
  }

  taskStatusLabel(status: string | null | undefined): string {
    switch ((status ?? '').toUpperCase()) {
      case 'COMPLETED':
        return 'Terminée';
      case 'PENDING':
        return 'En cours';
      default:
        return status || 'Non renseigné';
    }
  }

  private async reloadReportData(patientId: number): Promise<void> {
    const [medicalReport, carePlans] = await Promise.all([
      this.clinicalCareService.getDoctorMedicalReport(patientId),
      this.clinicalCareService.getDoctorCarePlans(patientId)
    ]);
    this.medicalReport = medicalReport;
    this.patientCarePlans = carePlans;
  }

  private async loadAcceptedPatients(): Promise<void> {
    this.isLoading = true;

    try {
      const appointments = await this.doctorAppointmentsService.getDoctorAppointments();
      const acceptedAppointments = appointments
        .filter((item) => item.status === 'ACCEPTED')
        .sort((a, b) => new Date(b.appointmentDateTime).getTime() - new Date(a.appointmentDateTime).getTime());

      const grouped = new Map<number, AcceptedPatientCard>();

      for (const appointment of acceptedAppointments) {
        const existing = grouped.get(appointment.patientId);
        if (!existing) {
          grouped.set(appointment.patientId, {
            id: appointment.patientId,
            name: appointment.patientName,
            email: appointment.patientEmail,
            phone: appointment.patientPhone,
            acceptedCount: 1,
            latestAppointmentAt: appointment.appointmentDateTime,
            appointments: [appointment]
          });
          continue;
        }

        existing.acceptedCount += 1;
        existing.appointments.push(appointment);
        if (!existing.phone && appointment.patientPhone) {
          existing.phone = appointment.patientPhone;
        }
        if (
          !existing.latestAppointmentAt ||
          new Date(appointment.appointmentDateTime).getTime() > new Date(existing.latestAppointmentAt).getTime()
        ) {
          existing.latestAppointmentAt = appointment.appointmentDateTime;
        }
      }

      this.acceptedPatients = Array.from(grouped.values()).sort((a, b) => {
        return new Date(b.latestAppointmentAt ?? 0).getTime() - new Date(a.latestAppointmentAt ?? 0).getTime();
      });

      if (this.selectedPatient) {
        this.selectedPatient = this.acceptedPatients.find((item) => item.id === this.selectedPatient?.id) ?? null;
        if (!this.selectedPatient) {
          this.patientCarePlans = [];
          this.selectedPlanId = null;
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les patients acceptés.';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadPatientCarePlans(patientId: number): Promise<void> {
    try {
      this.patientCarePlans = await this.clinicalCareService.getDoctorCarePlans(patientId);
    } catch (error) {
      this.patientCarePlans = [];
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les plans du patient.';
    }
  }

  private async persistPlanLinkedEntries(patientId: number): Promise<void> {
    await Promise.all([
      ...this.taskDrafts.map((task) =>
        this.clinicalCareService.createTask({
          patientId,
          title: task.title,
          description: task.description || undefined,
          reminderAt: task.startAt,
          dueAt: task.endAt
        })
      ),
      ...this.appointmentDrafts.map((appointment) =>
        this.doctorAppointmentsService.createDoctorAssignedAppointment({
          patientId,
          appointmentDateTime: appointment.appointmentDateTime,
          visitType: appointment.visitType,
          reason: appointment.reason,
          notes: appointment.notes || undefined,
          patientPhone: appointment.patientPhone || undefined
        })
      )
    ]);
  }

  private buildCarePlanItems(): CarePlanItemPayload[] {
    return [
      ...this.taskDrafts.map((task) => ({
        itemType: 'TASK' as const,
        title: task.title,
        details: task.description || `Début: ${this.formatDateTime(task.startAt)}`,
        dueAt: task.endAt
      })),
      ...this.appointmentDrafts.map((appointment) => ({
        itemType: 'APPOINTMENT' as const,
        title: `Rendez-vous - ${this.visitTypeLabel(appointment.visitType)}`,
        details: [appointment.reason, appointment.notes].filter(Boolean).join(' · '),
        dueAt: appointment.appointmentDateTime
      }))
    ];
  }

  private resetPlanForm(): void {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 7);

    this.selectedPlanId = null;
    this.planTitle = '';
    this.planStartDate = start.toISOString().slice(0, 10);
    this.planEndDate = end.toISOString().slice(0, 10);
    this.taskDrafts = [];
    this.appointmentDrafts = [];
    this.closeTaskModal();
    this.closeAppointmentModal();
    this.closeConsultationNotesModal();
  }
}
