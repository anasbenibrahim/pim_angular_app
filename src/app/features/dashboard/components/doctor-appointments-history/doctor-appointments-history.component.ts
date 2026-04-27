import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, NgZone, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DoctorAppointmentItem,
  DoctorAppointmentsService,
  DoctorAppointmentStatus,
  DoctorAppointmentVisitType
} from '../../../../core/services/doctor-appointments.service';

type AppointmentStatusFilter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED';

@Component({
  selector: 'app-doctor-appointments-history',
  templateUrl: './doctor-appointments-history.component.html',
  styleUrl: './doctor-appointments-history.component.css',
  imports: [CommonModule, FormsModule],
  standalone: true
})
export class DoctorAppointmentsHistoryComponent implements OnInit, OnDestroy {
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  rejectReason =
    'Merci de modifier la date ou l\'heure du rendez-vous et de soumettre une nouvelle demande.';
  statusFilter: AppointmentStatusFilter = 'ALL';
  searchTerm = '';
  selectedAppointmentId: number | null = null;

  readonly statusOptions: Array<{ value: AppointmentStatusFilter; label: string }> = [
    { value: 'ALL', label: 'Tous' },
    { value: 'PENDING', label: 'En attente' },
    { value: 'ACCEPTED', label: 'Acceptés' },
    { value: 'REJECTED', label: 'Rejetés' }
  ];

  appointments: DoctorAppointmentItem[] = [];

  private readonly processingIds = new Set<number>();
  private isDestroyed = false;

  constructor(
    private readonly doctorAppointmentsService: DoctorAppointmentsService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadAppointments();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
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

  get filteredAppointments(): DoctorAppointmentItem[] {
    const query = this.searchTerm.trim().toLowerCase();

    return this.appointments.filter((appointment) => {
      const matchesStatus = this.statusFilter === 'ALL' || appointment.status === this.statusFilter;
      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        appointment.patientName,
        appointment.patientEmail,
        appointment.patientPhone ?? '',
        appointment.reason,
        appointment.notes ?? '',
        appointment.decisionReason ?? '',
        this.statusLabel(appointment.status),
        this.visitTypeLabel(appointment.visitType),
        this.formatListDateTime(appointment.appointmentDateTime)
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  get selectedAppointment(): DoctorAppointmentItem | null {
    if (this.filteredAppointments.length === 0) {
      return null;
    }
    return this.filteredAppointments.find((item) => item.id === this.selectedAppointmentId) ?? this.filteredAppointments[0];
  }

  get totalCount(): number {
    return this.appointments.length;
  }

  get pendingCount(): number {
    return this.appointments.filter((item) => item.status === 'PENDING').length;
  }

  get acceptedCount(): number {
    return this.appointments.filter((item) => item.status === 'ACCEPTED').length;
  }

  get rejectedCount(): number {
    return this.appointments.filter((item) => item.status === 'REJECTED').length;
  }

  statusLabel(status: DoctorAppointmentStatus): string {
    return status === 'ACCEPTED' ? 'Accepté' : status === 'REJECTED' ? 'Rejeté' : 'En attente';
  }

  statusClass(status: DoctorAppointmentStatus): string {
    if (status === 'ACCEPTED') return 'status status-accepted';
    if (status === 'REJECTED') return 'status status-rejected';
    return 'status status-pending';
  }

  visitTypeLabel(visitType: DoctorAppointmentVisitType): string {
    return visitType === 'VIDEO' ? 'Visio' : 'Cabinet';
  }

  formatListDateTime(value: string): string {
    return this.formatDateTimeValue(value, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateTime(value: string): string {
    return this.formatDateTimeValue(value, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  selectAppointment(id: number): void {
    this.selectedAppointmentId = id;
    this.errorMessage = '';
    this.successMessage = '';
  }

  isProcessing(appointmentId: number): boolean {
    return this.processingIds.has(appointmentId);
  }

  async acceptPending(): Promise<void> {
    const appointment = this.selectedAppointment;
    if (!appointment || appointment.status !== 'PENDING') {
      return;
    }
    await this.handleDecision(appointment, 'ACCEPTED');
  }

  async rejectPending(): Promise<void> {
    const appointment = this.selectedAppointment;
    if (!appointment || appointment.status !== 'PENDING') {
      return;
    }
    await this.handleDecision(appointment, 'REJECTED');
  }

  setStatusFilter(filter: AppointmentStatusFilter): void {
    this.statusFilter = filter;
    this.successMessage = '';
    this.ensureSelection();
  }

  onSearchChanged(): void {
    this.successMessage = '';
    this.ensureSelection();
  }

  async refresh(): Promise<void> {
    await this.loadAppointments();
  }

  private async loadAppointments(showLoader = true): Promise<void> {
    if (showLoader) {
      this.runInAngular(() => {
        this.isLoading = true;
      });
    }
    this.runInAngular(() => {
      this.errorMessage = '';
      this.successMessage = '';
    });

    try {
      const items = await this.doctorAppointmentsService.getDoctorAppointments();
      this.runInAngular(() => {
        this.appointments = (items || []).sort((a, b) => {
          const dateA = this.safeParseDate(a.updatedAt).getTime();
          const dateB = this.safeParseDate(b.updatedAt).getTime();
          return dateB - dateA;
        });
        this.ensureSelection();
      });
    } catch (error) {
      this.runInAngular(() => {
        this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger l’historique des rendez-vous.';
      });
    } finally {
      this.runInAngular(() => {
        this.isLoading = false;
      });
    }
  }

  private ensureSelection(): void {
    const filtered = this.filteredAppointments;
    if (filtered.length === 0) {
      this.selectedAppointmentId = null;
      return;
    }
    const currentExists = filtered.some((item) => item.id === this.selectedAppointmentId);
    if (!currentExists) {
      this.selectedAppointmentId = filtered[0].id;
    }
  }

  private async handleDecision(
    appointment: DoctorAppointmentItem,
    status: Extract<DoctorAppointmentStatus, 'ACCEPTED' | 'REJECTED'>
  ): Promise<void> {
    if (appointment.status !== 'PENDING' || this.processingIds.has(appointment.id)) {
      return;
    }

    this.runInAngular(() => {
      this.processingIds.add(appointment.id);
      this.errorMessage = '';
      this.successMessage = '';
    });

    try {
      const updated =
        status === 'ACCEPTED'
          ? await this.doctorAppointmentsService.acceptAppointment(appointment.id)
          : await this.doctorAppointmentsService.rejectAppointment(appointment.id, {
              reason: this.rejectReason.trim() || undefined
            });

      this.runInAngular(() => {
        this.upsertAppointment(updated);
        const patientName = updated.patientName?.trim() || 'le patient';
        this.successMessage =
          status === 'ACCEPTED'
            ? `Rendez-vous accepté. Une confirmation a été envoyée à ${patientName}.`
            : `Rendez-vous rejeté. Un message a été envoyé à ${patientName}.`;
        this.ensureSelection();
      });
    } catch (error) {
      this.runInAngular(() => {
        this.errorMessage = error instanceof Error ? error.message : 'Action impossible pour ce rendez-vous.';
      });
    } finally {
      this.runInAngular(() => {
        this.processingIds.delete(appointment.id);
      });
    }
  }

  private upsertAppointment(updated: DoctorAppointmentItem): void {
    const existingIndex = this.appointments.findIndex((item) => item.id === updated.id);
    if (existingIndex === -1) {
      this.appointments = [updated, ...this.appointments];
    } else {
      const next = [...this.appointments];
      next[existingIndex] = updated;
      this.appointments = next;
    }

    this.appointments = this.appointments.sort((a, b) => {
      const dateA = this.safeParseDate(a.updatedAt).getTime();
      const dateB = this.safeParseDate(b.updatedAt).getTime();
      return dateB - dateA;
    });
  }

  private formatDateTimeValue(value: string, options: Intl.DateTimeFormatOptions): string {
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return new Intl.DateTimeFormat('fr-FR', options).format(date);
    } catch {
      return value;
    }
  }
}
