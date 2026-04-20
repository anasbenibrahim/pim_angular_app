import { Component, OnInit } from '@angular/core';
import { AdminService, DoctorSignupAdminItem, DoctorSignupStatus } from '../../../../core/services/admin.service';

type DoctorStatusFilter = 'ALL' | DoctorSignupStatus;

@Component({
  selector: 'app-doctors-validation',
  templateUrl: './doctors-validation.component.html',
  styleUrl: './doctors-validation.component.css',
  standalone: false
})
export class DoctorsValidationComponent implements OnInit {
  isLoading = false;
  isActionLoading = false;
  errorMessage = '';
  successMessage = '';
  statusFilter: DoctorStatusFilter = 'ALL';
  rejectReason = 'Dossier incomplet: merci de compléter les justificatifs demandés.';
  selectedRequestId: number | null = null;

  readonly statusOptions: Array<{ value: DoctorStatusFilter; label: string }> = [
    { value: 'ALL', label: 'Tous les statuts' },
    { value: 'PENDING', label: 'En attente' },
    { value: 'APPROVED', label: 'Approuvées' },
    { value: 'REJECTED', label: 'Rejetées' },
    { value: 'ERROR', label: 'Erreurs' }
  ];

  requests: DoctorSignupAdminItem[] = [];

  constructor(private readonly adminService: AdminService) {}

  async ngOnInit(): Promise<void> {
    await this.loadRequests();
  }

  get filteredRequests(): DoctorSignupAdminItem[] {
    if (this.statusFilter === 'ALL') {
      return this.requests;
    }
    return this.requests.filter((item) => item.status === this.statusFilter);
  }

  get selectedRequest(): DoctorSignupAdminItem | null {
    if (this.filteredRequests.length === 0) {
      return null;
    }
    return this.filteredRequests.find((item) => item.signupRequestId === this.selectedRequestId) ?? this.filteredRequests[0];
  }

  selectRequest(id: number): void {
    this.selectedRequestId = id;
    this.errorMessage = '';
    this.successMessage = '';
  }

  setStatusFilter(filter: DoctorStatusFilter): void {
    this.statusFilter = filter;
    this.errorMessage = '';
    this.successMessage = '';
    if (this.selectedRequest) {
      this.selectedRequestId = this.selectedRequest.signupRequestId;
    }
  }

  async refresh(): Promise<void> {
    await this.loadRequests();
  }

  async approveSelected(): Promise<void> {
    const selected = this.selectedRequest;
    if (!selected || selected.status !== 'PENDING') {
      return;
    }

    this.isActionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const message = await this.adminService.approveDoctorSignup(selected.signupRequestId, {
        reason: 'Approuvé manuellement depuis le dashboard admin'
      });
      this.successMessage = message;
      await this.refresh();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec de validation du doctor.';
    } finally {
      this.isActionLoading = false;
    }
  }

  async rejectSelected(): Promise<void> {
    const selected = this.selectedRequest;
    if (!selected || selected.status !== 'PENDING') {
      return;
    }

    this.isActionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const message = await this.adminService.rejectDoctorSignup(selected.signupRequestId, {
        reason: this.rejectReason.trim() || 'Rejet manuel depuis le dashboard admin'
      });
      this.successMessage = message;
      await this.refresh();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec du rejet du doctor.';
    } finally {
      this.isActionLoading = false;
    }
  }

  async deleteSelected(): Promise<void> {
    const selected = this.selectedRequest;
    if (!selected) {
      return;
    }

    this.isActionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const message = await this.adminService.deleteDoctorSignup(selected.signupRequestId);
      this.successMessage = message;
      await this.refresh();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec de suppression de la demande.';
    } finally {
      this.isActionLoading = false;
    }
  }

  statusLabel(status: DoctorSignupStatus): string {
    if (status === 'PENDING') return 'En attente';
    if (status === 'APPROVED') return 'Approuvée';
    if (status === 'REJECTED') return 'Rejetée';
    return 'Erreur';
  }

  statusClass(status: DoctorSignupStatus): string {
    if (status === 'PENDING') return 'status status-pending';
    if (status === 'APPROVED') return 'status status-approved';
    if (status === 'REJECTED') return 'status status-rejected';
    return 'status status-error';
  }

  resolveDiplomaUrl(path: string): string | null {
    return this.adminService.resolveMediaUrl(path);
  }

  private async loadRequests(showLoader = true): Promise<void> {
    if (showLoader) {
      this.isLoading = true;
    }
    this.errorMessage = '';

    try {
      const all = await this.adminService.getDoctorSignups();
      this.requests = all;
      const selected = this.selectedRequest;
      this.selectedRequestId = selected?.signupRequestId ?? this.filteredRequests[0]?.signupRequestId ?? null;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les demandes doctor.';
    } finally {
      this.isLoading = false;
    }
  }
}
