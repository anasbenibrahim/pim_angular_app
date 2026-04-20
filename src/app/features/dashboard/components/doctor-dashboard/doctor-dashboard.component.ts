import { Component, OnInit } from '@angular/core';
import {
  DoctorAppointmentItem,
  DoctorAppointmentsService,
  DoctorAppointmentStatus,
  DoctorAppointmentVisitType
} from '../../../../core/services/doctor-appointments.service';

type AppointmentStatusFilter = 'ALL' | DoctorAppointmentStatus;

interface CalendarDayCell {
  dayNumber: number | null;
  dateKey: string | null;
  appointmentCount: number;
  appointmentEntries: string[];
  remainingEntries: number;
  isToday: boolean;
}

interface StatsChartBar {
  key: 'patients' | 'accepted' | 'pending' | 'rejected' | 'total';
  label: string;
  value: number;
  height: number;
}

@Component({
  selector: 'app-doctor-dashboard',
  templateUrl: './doctor-dashboard.component.html',
  styleUrl: './doctor-dashboard.component.css',
  standalone: false
})
export class DoctorDashboardComponent implements OnInit {
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  statusFilter: AppointmentStatusFilter = 'PENDING';
  searchTerm = '';
  selectedAppointmentId: number | null = null;
  rejectReason = 'Merci de modifier la date ou l\'heure du rendez-vous et de soumettre une nouvelle demande.';

  readonly statusOptions: Array<{ value: AppointmentStatusFilter; label: string }> = [
    { value: 'PENDING', label: 'En attente' },
    { value: 'ACCEPTED', label: 'Acceptés' },
    { value: 'REJECTED', label: 'Rejetés' },
    { value: 'ALL', label: 'Tous' }
  ];

  appointments: DoctorAppointmentItem[] = [];
  currentCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  readonly weekDayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  private readonly processingIds = new Set<number>();

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

  get pendingCount(): number {
    return this.appointments.filter((item) => item.status === 'PENDING').length;
  }

  get acceptedCount(): number {
    return this.appointments.filter((item) => item.status === 'ACCEPTED').length;
  }

  get acceptedRate(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.acceptedCount / this.totalCount) * 100);
  }

  get pendingRate(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.pendingCount / this.totalCount) * 100);
  }

  get rejectedRate(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.rejectedCount / this.totalCount) * 100);
  }

  get uniquePatientsCount(): number {
    return new Set(this.appointments.map((item) => item.patientId)).size;
  }

  get statsChartBars(): StatsChartBar[] {
    const raw = [
      { key: 'patients' as const, label: 'Patients', value: this.uniquePatientsCount },
      { key: 'accepted' as const, label: 'Acceptés', value: this.acceptedCount },
      { key: 'pending' as const, label: 'En attente', value: this.pendingCount },
      { key: 'rejected' as const, label: 'Rejetés', value: this.rejectedCount },
      { key: 'total' as const, label: 'Total', value: this.totalCount }
    ];

    const maxValue = Math.max(1, ...raw.map((item) => item.value));

    return raw.map((item) => ({
      ...item,
      height: Math.max(8, Math.round((item.value / maxValue) * 100))
    }));
  }

  get calendarMonthLabel(): string {
    return new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric'
    }).format(this.currentCalendarMonth);
  }

  get calendarWeeks(): CalendarDayCell[][] {
    const year = this.currentCalendarMonth.getFullYear();
    const month = this.currentCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const entriesByDate = this.getAppointmentDateEntries();
    const today = new Date();
    const todayKey = this.toDateKey(today);

    const cells: CalendarDayCell[] = [];
    for (let index = 0; index < totalCells; index++) {
      const dayNumber = index - startOffset + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cells.push({
          dayNumber: null,
          dateKey: null,
          appointmentCount: 0,
          appointmentEntries: [],
          remainingEntries: 0,
          isToday: false
        });
        continue;
      }

      const date = new Date(year, month, dayNumber);
      const dateKey = this.toDateKey(date);
      const entriesForDate = entriesByDate.get(dateKey) ?? [];
      cells.push({
        dayNumber,
        dateKey,
        appointmentCount: entriesForDate.length,
        appointmentEntries: entriesForDate.slice(0, 2),
        remainingEntries: Math.max(0, entriesForDate.length - 2),
        isToday: dateKey === todayKey
      });
    }

    const weeks: CalendarDayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }

  previousCalendarMonth(): void {
    this.currentCalendarMonth = new Date(
      this.currentCalendarMonth.getFullYear(),
      this.currentCalendarMonth.getMonth() - 1,
      1
    );
  }

  nextCalendarMonth(): void {
    this.currentCalendarMonth = new Date(
      this.currentCalendarMonth.getFullYear(),
      this.currentCalendarMonth.getMonth() + 1,
      1
    );
  }

  get rejectedCount(): number {
    return this.appointments.filter((item) => item.status === 'REJECTED').length;
  }

  statusLabel(status: DoctorAppointmentStatus): string {
    if (status === 'PENDING') return 'En attente';
    if (status === 'ACCEPTED') return 'Accepté';
    return 'Rejeté';
  }

  statusClass(status: DoctorAppointmentStatus): string {
    if (status === 'PENDING') return 'status status-pending';
    if (status === 'ACCEPTED') return 'status status-accepted';
    return 'status status-rejected';
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

  formatShortDate(value: string): string {
    return this.formatDateTimeValue(value, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatShortTime(value: string): string {
    return this.formatDateTimeValue(value, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  selectAppointment(id: number): void {
    this.selectedAppointmentId = id;
    this.errorMessage = '';
    this.successMessage = '';
  }

  setStatusFilter(filter: AppointmentStatusFilter): void {
    this.statusFilter = filter;
    this.errorMessage = '';
    this.successMessage = '';
    this.ensureSelection();
  }

  onSearchChanged(): void {
    this.ensureSelection();
  }

  async refresh(): Promise<void> {
    await this.loadAppointments();
  }

  async acceptSelected(): Promise<void> {
    const selected = this.selectedAppointment;
    if (!selected) {
      return;
    }
    await this.handleDecision(selected, 'ACCEPTED');
  }

  async rejectSelected(): Promise<void> {
    const selected = this.selectedAppointment;
    if (!selected) {
      return;
    }
    await this.handleDecision(selected, 'REJECTED');
  }

  isProcessing(appointmentId: number): boolean {
    return this.processingIds.has(appointmentId);
  }

  private async loadAppointments(showLoader = true): Promise<void> {
    if (showLoader) {
      this.isLoading = true;
    }
    this.errorMessage = '';

    try {
      const items = await this.doctorAppointmentsService.getDoctorAppointments();
      this.appointments = items.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      this.ensureSelection();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les rendez-vous.';
    } finally {
      this.isLoading = false;
    }
  }

  private async handleDecision(
    appointment: DoctorAppointmentItem,
    status: Extract<DoctorAppointmentStatus, 'ACCEPTED' | 'REJECTED'>
  ): Promise<void> {
    if (appointment.status !== 'PENDING' || this.processingIds.has(appointment.id)) {
      return;
    }

    this.processingIds.add(appointment.id);
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const updated =
        status === 'ACCEPTED'
          ? await this.doctorAppointmentsService.acceptAppointment(appointment.id)
          : await this.doctorAppointmentsService.rejectAppointment(appointment.id, {
              reason: this.rejectReason.trim() || undefined
            });

      this.upsertAppointment(updated);
      const patientName = updated.patientName?.trim() || 'le patient';
      this.successMessage =
        status === 'ACCEPTED'
          ? `Rendez-vous accepté. Un email de confirmation a été envoyé à ${patientName}.`
          : `Rendez-vous rejeté. Un email de refus a été envoyé à ${patientName}.`;
      this.ensureSelection();

      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Action impossible pour ce rendez-vous.';
    } finally {
      this.processingIds.delete(appointment.id);
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
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
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

  private getAppointmentDateEntries(): Map<string, string[]> {
    const entriesByDate = new Map<string, Array<{ timestamp: number; label: string }>>();

    for (const appointment of this.appointments) {
      if (appointment.status !== 'ACCEPTED') {
        continue;
      }

      const parsed = new Date(appointment.appointmentDateTime);
      if (Number.isNaN(parsed.getTime())) {
        continue;
      }

      const key = this.toDateKey(parsed);
      const patientName = appointment.patientName?.trim() || 'Patient';
      const time = this.formatShortTime(appointment.appointmentDateTime);
      const current = entriesByDate.get(key) ?? [];

      current.push({
        timestamp: parsed.getTime(),
        label: `${patientName} (${time})`
      });
      entriesByDate.set(key, current);
    }

    const result = new Map<string, string[]>();
    for (const [key, entries] of entriesByDate.entries()) {
      result.set(
        key,
        [...entries]
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((entry) => entry.label)
      );
    }

    return result;
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
