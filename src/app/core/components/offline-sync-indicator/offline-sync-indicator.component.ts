import { Component, OnInit, OnDestroy } from '@angular/core';
import { OfflineSyncService, OfflineRequest } from '../../services/offline-sync.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-offline-sync-indicator',
  templateUrl: './offline-sync-indicator.component.html',
  styleUrls: ['./offline-sync-indicator.component.css'],
  standalone: false
})
export class OfflineSyncIndicatorComponent implements OnInit, OnDestroy {
  isOnline: boolean = true;
  isSyncing: boolean = false;
  syncProgress: { completed: number; total: number } = { completed: 0, total: 0 };
  pendingRequests: OfflineRequest[] = [];
  showQueue: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(private offlineSyncService: OfflineSyncService) {}

  ngOnInit(): void {
    // Écouter l'état de la connexion
    this.offlineSyncService.isOnline$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isOnline => {
        this.isOnline = isOnline;
        console.log('[SyncIndicator] État connexion:', isOnline);
      });

    // Écouter l'état de la synchronisation
    this.offlineSyncService.isSyncing$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isSyncing => {
        this.isSyncing = isSyncing;
        if (isSyncing) {
          this.showQueue = true;
        }
      });

    // Écouter la progression de la synchronisation
    this.offlineSyncService.syncProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        this.syncProgress = progress;
      });

    // Écouter la queue de requêtes
    this.offlineSyncService.syncQueue$
      .pipe(takeUntil(this.destroy$))
      .subscribe(queue => {
        this.pendingRequests = queue.filter(req => !req.synced);
      });

    // Écouter les requêtes synchonisées avec succès
    this.offlineSyncService.syncCompleted
      .pipe(takeUntil(this.destroy$))
      .subscribe(request => {
        console.log('[SyncIndicator] Requête synchonisée:', request.url);
      });

    // Écouter les requêtes échouées
    this.offlineSyncService.syncFailed
      .pipe(takeUntil(this.destroy$))
      .subscribe(request => {
        console.error('[SyncIndicator] Requête échouée (max retries):', request.url);
      });
  }

  /**
   * Nettoyer les ressources
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Obtenir le pourcentage de synchro
   */
  get syncPercentage(): number {
    if (this.syncProgress.total === 0) return 0;
    return Math.round((this.syncProgress.completed / this.syncProgress.total) * 100);
  }

  /**
   * Basculer l'affichage de la queue
   */
  toggleQueue(): void {
    this.showQueue = !this.showQueue;
  }

  /**
   * Retirer une requête de la queue
   */
  removeFromQueue(requestId: string): void {
    this.offlineSyncService.removeFromQueue(requestId);
  }

  /**
   * Vider la queue complète
   */
  clearQueue(): void {
    if (confirm('Êtes-vous sûr de vouloir vider la queue?')) {
      this.offlineSyncService.clearQueue();
      this.showQueue = false;
    }
  }

  /**
   * Forcer la synchronisation manuelle
   */
  forceSync(): void {
    if (this.isOnline && this.pendingRequests.length > 0) {
      this.offlineSyncService.sync();
    }
  }

  /**
   * Formater l'URL pour affichage
   */
  formatUrl(url: string): string {
    return url.replace(/^https?:\/\/[^\/]+/, '');
  }

  /**
   * Obtenir l'icône HTTP
   */
  getMethodIcon(method: string): string {
    const icons: Record<string, string> = {
      'GET': '📤',
      'POST': '➕',
      'PUT': '✏️',
      'PATCH': '🔧',
      'DELETE': '🗑️'
    };
    return icons[method.toUpperCase()] || '❓';
  }

  /**
   * TrackBy function pour optimiser ngFor
   */
  trackByRequestId(index: number, request: OfflineRequest): string {
    return request.id;
  }
}
