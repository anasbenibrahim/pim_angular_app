import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService, VolunteerSignupAdminItem, VolunteerSignupStatus } from '../../../../core/services/admin.service';

type VolunteerStatusFilter = 'ALL' | VolunteerSignupStatus;
type ToastKind = 'success' | 'error' | 'info';

interface ToastMessage {
  kind: ToastKind;
  text: string;
}

interface VolunteerRequestViewModel {
  id: number;
  name: string;
  email: string;
  age: number;
  cin: string;
  phone: string | null;
  aiMatch: number;
  note: string;
  status: VolunteerSignupStatus;
  statusLabel: string;
  recommendation: string;
  createdAtLabel: string;
  processedAtLabel: string;
  faceImageUrl: string | null;
  cinFrontImageUrl: string | null;
  cinBackImageUrl: string | null;
}

@Component({
  selector: 'app-volunteers-validation',
  templateUrl: './volunteers-validation.component.html',
  styleUrl: './volunteers-validation.component.css',
  imports: [CommonModule, FormsModule],
  standalone: true
})
export class VolunteersValidationComponent implements OnInit, OnDestroy {
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly backendBaseUrl: string;
  private isDestroyed = false;

  readonly statusFilterOptions: ReadonlyArray<{ value: VolunteerStatusFilter; label: string }> = [
    { value: 'ALL', label: 'Tous les statuts' },
    { value: 'PENDING', label: 'En attente' },
    { value: 'APPROVED', label: 'Approuvées' },
    { value: 'REJECTED', label: 'Rejetées' },
    { value: 'ERROR', label: 'Erreurs' }
  ];

  isLoading = false;
  isActionLoading = false;
  errorMessage = '';
  successMessage = '';
  toast: ToastMessage | null = null;
  lastUpdated = '';
  statusFilter: VolunteerStatusFilter = 'ALL';
  showRejectModal = false;
  showDeleteModal = false;
  rejectReasonDraft =
    'Dossier refusé: merci de vérifier la qualité des photos et la concordance identité/CIN.';

  selectedVolunteerId: number | null = null;
  allVolunteers: VolunteerRequestViewModel[] = [];

  constructor(
    private readonly adminService: AdminService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.backendBaseUrl = this.adminService.getBackendBaseUrl();
  }

  async ngOnInit(): Promise<void> {
    await this.loadRequests();
    this.refreshTimer = setInterval(() => {
      if (this.isActionLoading) {
        return;
      }
      void this.loadRequests(false, true);
    }, 10000);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  get volunteers(): VolunteerRequestViewModel[] {
    if (this.statusFilter === 'ALL') {
      return this.allVolunteers;
    }
    return this.allVolunteers.filter((volunteer) => volunteer.status === this.statusFilter);
  }

  get selectedVolunteer(): VolunteerRequestViewModel | null {
    const visible = this.volunteers;
    if (visible.length === 0) {
      return null;
    }

    return visible.find((volunteer) => volunteer.id === this.selectedVolunteerId) ?? visible[0];
  }

  get totalRequests(): number {
    return this.allVolunteers.length;
  }

  get pendingCount(): number {
    return this.countByStatus('PENDING');
  }

  get approvedCount(): number {
    return this.countByStatus('APPROVED');
  }

  get rejectedCount(): number {
    return this.countByStatus('REJECTED');
  }

  get errorCount(): number {
    return this.countByStatus('ERROR');
  }

  selectVolunteer(id: number): void {
    this.safeUiUpdate(() => {
      this.selectedVolunteerId = id;
      this.successMessage = '';
      this.errorMessage = '';
    });
  }

  setStatusFilter(filter: VolunteerStatusFilter): void {
    this.safeUiUpdate(() => {
      this.statusFilter = filter;
      if (this.selectedVolunteer && this.selectedVolunteerId !== this.selectedVolunteer.id) {
        this.selectedVolunteerId = this.selectedVolunteer.id;
      }
      if (!this.selectedVolunteer) {
        this.selectedVolunteerId = null;
      }
      this.successMessage = '';
      this.errorMessage = '';
    });
  }

  async refreshManually(): Promise<void> {
    await this.loadRequests();
    this.showToast('success', 'Demandes volontaires synchronisées.');
  }

  async approveSelected(): Promise<void> {
    const selected = this.selectedVolunteer;
    if (!selected || selected.status !== 'PENDING') {
      return;
    }

    this.safeUiUpdate(() => {
      this.errorMessage = '';
      this.successMessage = '';
      this.isActionLoading = true;
    });

    try {
      await this.adminService.approveVolunteerSignup(selected.id, {
        score: selected.aiMatch,
        reason: 'Approuvé manuellement depuis le dashboard admin'
      });
      this.safeUiUpdate(() => {
        this.successMessage = `Demande de ${selected.name} approuvée. Email d'accès envoyé au volontaire.`;
        this.showToast('success', this.successMessage);
      });
      await this.loadRequests(false, true);
    } catch (error) {
      this.safeUiUpdate(() => {
        this.errorMessage =
          error instanceof Error ? error.message : 'Échec de validation du volontaire.';
        this.showToast('error', this.errorMessage);
      });
    } finally {
      this.safeUiUpdate(() => {
        this.isActionLoading = false;
      });
    }
  }

  rejectSelected(): void {
    const selected = this.selectedVolunteer;
    if (!selected || selected.status !== 'PENDING') {
      return;
    }
    this.safeUiUpdate(() => {
      this.errorMessage = '';
      this.successMessage = '';
      this.rejectReasonDraft =
        'Dossier refusé: merci de vérifier la qualité des photos et la concordance identité/CIN.';
      this.showRejectModal = true;
    });
  }

  closeRejectModal(): void {
    this.safeUiUpdate(() => {
      this.showRejectModal = false;
    });
  }

  deleteSelected(): void {
    const selected = this.selectedVolunteer;
    if (!selected) {
      return;
    }
    this.safeUiUpdate(() => {
      this.errorMessage = '';
      this.successMessage = '';
      this.showDeleteModal = true;
    });
  }

  closeDeleteModal(): void {
    this.safeUiUpdate(() => {
      this.showDeleteModal = false;
    });
  }

  async confirmRejectSelected(): Promise<void> {
    const selected = this.selectedVolunteer;
    if (!selected || selected.status !== 'PENDING') {
      this.closeRejectModal();
      return;
    }
    const reason = this.rejectReasonDraft.trim() || 'Rejet manuel depuis le dashboard admin';

    this.safeUiUpdate(() => {
      this.errorMessage = '';
      this.successMessage = '';
      this.isActionLoading = true;
    });

    try {
      await this.adminService.rejectVolunteerSignup(selected.id, {
        score: selected.aiMatch,
        reason
      });
      this.safeUiUpdate(() => {
        this.showRejectModal = false;
        this.showDeleteModal = false;
        this.successMessage = `Demande de ${selected.name} rejetée. Email de refus envoyé.`;
        this.showToast('success', this.successMessage);
      });
      await this.loadRequests(false, true);
    } catch (error) {
      this.safeUiUpdate(() => {
        this.errorMessage =
          error instanceof Error ? error.message : 'Échec du rejet du volontaire.';
        this.showToast('error', this.errorMessage);
      });
    } finally {
      this.safeUiUpdate(() => {
        this.isActionLoading = false;
      });
    }
  }

  reviewSelected(): void {
    const selected = this.selectedVolunteer;
    if (!selected) {
      return;
    }
    this.safeUiUpdate(() => {
      this.successMessage = `Révision de ${selected.name}: vérifiez les photos (visage + CIN recto/verso) et les informations du formulaire.`;
      this.errorMessage = '';
      this.showToast('info', `Révision de ${selected.name}: vérifiez le dossier.`);
    });
  }

  async confirmDeleteSelected(): Promise<void> {
    const selected = this.selectedVolunteer;
    if (!selected) {
      this.closeDeleteModal();
      return;
    }

    this.safeUiUpdate(() => {
      this.errorMessage = '';
      this.successMessage = '';
      this.isActionLoading = true;
    });

    try {
      await this.adminService.deleteVolunteerSignup(selected.id);
      this.safeUiUpdate(() => {
        this.showDeleteModal = false;
        this.successMessage = `Demande de ${selected.name} supprimée.`;
        this.showToast('success', this.successMessage);
      });
      await this.loadRequests(false, true);
    } catch (error) {
      this.safeUiUpdate(() => {
        this.errorMessage =
          error instanceof Error ? error.message : 'Échec de suppression de la demande.';
        this.showToast('error', this.errorMessage);
      });
    } finally {
      this.safeUiUpdate(() => {
        this.isActionLoading = false;
      });
    }
  }

  trackByVolunteerId(_: number, volunteer: VolunteerRequestViewModel): number {
    return volunteer.id;
  }

  statusBadgeClass(status: VolunteerSignupStatus): string {
    switch (status) {
      case 'APPROVED':
        return 'status-approved';
      case 'REJECTED':
        return 'status-rejected';
      case 'ERROR':
        return 'status-error';
      default:
        return 'status-pending';
    }
  }

  private async loadRequests(showLoader = true, silent = false): Promise<void> {
    if (showLoader) {
      this.safeUiUpdate(() => {
        this.isLoading = true;
      });
    }
    if (!silent) {
      this.safeUiUpdate(() => {
        this.errorMessage = '';
      });
    }

    try {
      const response = await this.adminService.getVolunteerSignups();
      this.safeUiUpdate(() => {
        this.allVolunteers = response.map((item) => this.toViewModel(item));

        const selectedStillExists =
          this.selectedVolunteerId !== null && this.allVolunteers.some((v) => v.id === this.selectedVolunteerId);
        if (!selectedStillExists) {
          this.selectedVolunteerId = this.volunteers[0]?.id ?? null;
        } else if (!this.selectedVolunteer) {
          this.selectedVolunteerId = this.volunteers[0]?.id ?? null;
        }

        this.lastUpdated = new Date().toLocaleTimeString('fr-FR');
      });
    } catch (error) {
      if (!silent) {
        this.safeUiUpdate(() => {
          this.errorMessage =
            error instanceof Error
              ? error.message
              : 'Impossible de charger les demandes volontaires.';
        });
      }
    } finally {
      this.safeUiUpdate(() => {
        this.isLoading = false;
      });
    }
  }

  private toViewModel(item: VolunteerSignupAdminItem): VolunteerRequestViewModel {
    const aiMatch = this.normalizeScore(item.facialScore);
    return {
      id: item.signupRequestId,
      name: `${item.prenom} ${item.nom}`.trim(),
      email: item.email,
      age: item.age,
      cin: item.cin,
      phone: item.phone,
      aiMatch,
      note:
        item.decisionReason && item.decisionReason.trim() !== ''
          ? item.decisionReason
          : item.status === 'PENDING'
            ? 'Documents soumis, en attente de décision.'
            : 'Aucune note disponible.',
      status: item.status,
      statusLabel: this.mapStatusLabel(item.status),
      recommendation: this.buildRecommendation(aiMatch),
      createdAtLabel: this.formatDate(item.createdAt),
      processedAtLabel: this.formatDate(item.processedAt),
      faceImageUrl: this.resolveImageUrl(item.faceImageUrl),
      cinFrontImageUrl: this.resolveImageUrl(item.cinFrontImageUrl),
      cinBackImageUrl: this.resolveImageUrl(item.cinBackImageUrl)
    };
  }

  private mapStatusLabel(status: VolunteerSignupStatus): string {
    if (status === 'PENDING') {
      return 'En attente';
    }
    if (status === 'APPROVED') {
      return 'Approuvée';
    }
    if (status === 'REJECTED') {
      return 'Rejetée';
    }
    return 'Erreur';
  }

  private buildRecommendation(score: number): string {
    if (score >= 85) {
      return 'Approuver';
    }
    if (score >= 70) {
      return 'Examiner avant décision';
    }
    return 'Rejet recommandé';
  }

  private normalizeScore(score: number | null): number {
    if (score === null || Number.isNaN(score)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private resolveImageUrl(path: string | null): string | null {
    if (!path || path.trim() === '') {
      return null;
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${this.backendBaseUrl}${path}`;
  }

  private formatDate(iso: string | null): string {
    if (!iso || iso.trim() === '') {
      return '-';
    }
    const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private countByStatus(status: VolunteerSignupStatus): number {
    return this.allVolunteers.filter((volunteer) => volunteer.status === status).length;
  }

  private safeUiUpdate(action: () => void): void {
    if (this.isDestroyed) {
      return;
    }
    this.ngZone.run(() => {
      if (this.isDestroyed) {
        return;
      }
      action();
      this.cdr.detectChanges();
    });
  }

  closeToast(): void {
    this.safeUiUpdate(() => {
      this.toast = null;
    });
  }

  private showToast(kind: ToastKind, text: string): void {
    if (!text || text.trim() === '') {
      return;
    }
    this.safeUiUpdate(() => {
      this.toast = { kind, text };
      if (this.toastTimer) {
        clearTimeout(this.toastTimer);
        this.toastTimer = null;
      }
      this.toastTimer = setTimeout(() => {
        this.safeUiUpdate(() => {
          this.toast = null;
        });
      }, 3000);
    });
  }
}
