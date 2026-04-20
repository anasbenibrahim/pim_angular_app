import { Component, OnInit } from '@angular/core';
import {
  DoctorAppointmentItem,
  DoctorAppointmentsService,
  DoctorAppointmentStatus,
  DoctorAppointmentVisitType
} from '../../../../core/services/doctor-appointments.service';

type ProcessedStatusFilter = 'ALL' | 'ACCEPTED' | 'REJECTED';

@Component({
  selector: 'app-doctor-appointments-history',
  templateUrl: './doctor-appointments-history.component.html',
  styleUrl: './doctor-appointments-history.component.css',
  standalone: false
})
export class DoctorAppointmentsHistoryComponent implements OnInit {
  isLoading = false;
  errorMessage = '';
  statusFilter: ProcessedStatusFilter = 'ALL';
  searchTerm = '';
  selectedAppointmentId: number | null = null;

  readonly statusOptions: Array<{ value: ProcessedStatusFilter; label: string }> = [
    { value: 'ALL', label: 'Tous' },
    { value: 'ACCEPTED', label: 'Acceptés' },
    { value: 'REJECTED', label: 'Rejetés' }
  ];

  appointments: DoctorAppointmentItem[] = [];

  constructor(private readonly doctorAppointmentsService: DoctorAppointmentsService) {}

  async ngOnInit(): Promise<void> {
    await this.loadAppointments();
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
  }

  setStatusFilter(filter: ProcessedStatusFilter): void {
    this.statusFilter = filter;
    this.ensureSelection();
  }

  onSearchChanged(): void {
    this.ensureSelection();
  }

  async refresh(): Promise<void> {
    await this.loadAppointments();
  }

  private async loadAppointments(showLoader = true): Promise<void> {
    if (showLoader) {
      this.isLoading = true;
    }
    this.errorMessage = '';

    try {
      const items = await this.doctorAppointmentsService.getDoctorAppointments();
      this.appointments = items
        .filter((item) => item.status === 'ACCEPTED' || item.status === 'REJECTED')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      this.ensureSelection();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger l’historique des rendez-vous.';
    } finally {
      this.isLoading = false;
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
