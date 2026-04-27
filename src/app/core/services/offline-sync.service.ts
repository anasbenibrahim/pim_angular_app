import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Inject } from '@angular/core';

export interface OfflineRequest {
  id: string;
  method: string;
  url: string;
  body: any;
  headers: Record<string, string>;
  timestamp: number;
  retryCount: number;
  synced: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private readonly QUEUE_KEY = 'offline_sync_queue';
  private readonly MAX_RETRIES = 3;
  private isBrowser: boolean;

  private isOnline = new BehaviorSubject<boolean>(this.getInitialOnlineState());
  private syncQueue = new BehaviorSubject<OfflineRequest[]>(this.loadQueue());
  private isSyncing = new BehaviorSubject<boolean>(false);
  private syncProgress = new BehaviorSubject<{ completed: number; total: number }>({ completed: 0, total: 0 });
  private syncCompleted$ = new Subject<OfflineRequest>();
  private syncFailed$ = new Subject<OfflineRequest>();

  public isOnline$: Observable<boolean> = this.isOnline.asObservable();
  public syncQueue$: Observable<OfflineRequest[]> = this.syncQueue.asObservable();
  public isSyncing$: Observable<boolean> = this.isSyncing.asObservable();
  public syncProgress$: Observable<{ completed: number; total: number }> = this.syncProgress.asObservable();
  public syncCompleted: Observable<OfflineRequest> = this.syncCompleted$.asObservable();
  public syncFailed: Observable<OfflineRequest> = this.syncFailed$.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.initNetworkListeners();
    }
  }

  /**
   * Obtenir l'état initial de la connexion
   */
  private getInitialOnlineState(): boolean {
    if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
      return navigator.onLine;
    }
    return true; // Assume online par défaut côté server
  }

  /**
   * Initialiser les listeners réseau
   */
  private initNetworkListeners(): void {
    if (!this.isBrowser) return;
    
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Gérer l'événement online
   */
  private handleOnline(): void {
    console.log('[OfflineSync] Connexion rétablie');
    this.isOnline.next(true);
    this.sync();
  }

  /**
   * Gérer l'événement offline
   */
  private handleOffline(): void {
    console.log('[OfflineSync] Connexion perdue');
    this.isOnline.next(false);
  }

  /**
   * Ajouter une requête à la queue offline
   */
  public addToQueue(method: string, url: string, body: any, headers: Record<string, string> = {}): void {
    const request: OfflineRequest = {
      id: `${Date.now()}_${Math.random()}`,
      method,
      url,
      body,
      headers,
      timestamp: Date.now(),
      retryCount: 0,
      synced: false
    };

    const queue = this.syncQueue.value;
    queue.push(request);
    this.syncQueue.next(queue);
    this.saveQueue(queue);
    console.log(`[OfflineSync] Requête ajoutée à la queue: ${method} ${url}`);
  }

  /**
   * Synchroniser la queue avec le serveur
   */
  public sync(): void {
    if (this.isSyncing.value || !this.isOnline.value) {
      return;
    }

    const queue = this.syncQueue.value.filter(req => !req.synced);
    if (queue.length === 0) {
      return;
    }

    this.isSyncing.next(true);
    this.syncProgress.next({ completed: 0, total: queue.length });

    let completed = 0;
    let failed = 0;

    queue.forEach((request, index) => {
      this.syncRequest(request)
        .then(() => {
          completed++;
          request.synced = true;
          this.syncCompleted$.next(request);
          this.updateProgress(completed, queue.length);
          this.updateQueue();
        })
        .catch((error) => {
          failed++;
          request.retryCount++;
          if (request.retryCount >= this.MAX_RETRIES) {
            this.syncFailed$.next(request);
            console.error(`[OfflineSync] Requête échouée après ${this.MAX_RETRIES} tentatives:`, request);
          } else {
            console.warn(`[OfflineSync] Tentative ${request.retryCount} échouée pour:`, request.url);
          }
          this.updateProgress(completed + failed, queue.length);
          this.updateQueue();
        });
    });
  }

  /**
   * Synchroniser une requête spécifique
   */
  private syncRequest(request: OfflineRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestOptions: any = {
        headers: request.headers
      };

      const httpRequest$ = this.getHttpRequest(request.method, request.url, request.body, requestOptions);

      if (httpRequest$) {
        httpRequest$.subscribe(
          (response) => {
            console.log(`[OfflineSync] Requête synchonisée avec succès: ${request.method} ${request.url}`);
            resolve(response);
          },
          (error: HttpErrorResponse) => {
            console.error(`[OfflineSync] Erreur lors de la sync:`, request.url, error);
            reject(error);
          }
        );
      } else {
        reject(new Error('Unknown HTTP method'));
      }
    });
  }

  /**
   * Retourner la requête HTTP appropriée selon la méthode
   */
  private getHttpRequest(method: string, url: string, body: any, options: any): Observable<any> | null {
    switch (method.toUpperCase()) {
      case 'GET':
        return this.http.get(url, options);
      case 'POST':
        return this.http.post(url, body, options);
      case 'PUT':
        return this.http.put(url, body, options);
      case 'PATCH':
        return this.http.patch(url, body, options);
      case 'DELETE':
        return this.http.delete(url, options);
      default:
        return null;
    }
  }

  /**
   * Mettre à jour la barre de progression
   */
  private updateProgress(completed: number, total: number): void {
    this.syncProgress.next({ completed, total });
    if (completed === total) {
      this.isSyncing.next(false);
    }
  }

  /**
   * Mettre à jour la queue après changements
   */
  private updateQueue(): void {
    const queue = this.syncQueue.value;
    this.syncQueue.next([...queue]);
    this.saveQueue(queue);
  }

  /**
   * Sauvegarder la queue dans localStorage
   */
  private saveQueue(queue: OfflineRequest[]): void {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('[OfflineSync] Erreur lors de la sauvegarde de la queue:', error);
    }
  }

  /**
   * Charger la queue depuis localStorage
   */
  private loadQueue(): OfflineRequest[] {
    try {
      const queue = localStorage.getItem(this.QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('[OfflineSync] Erreur lors du chargement de la queue:', error);
      return [];
    }
  }

  /**
   * Vider la queue
   */
  public clearQueue(): void {
    this.syncQueue.next([]);
    localStorage.removeItem(this.QUEUE_KEY);
  }

  /**
   * Retirer une requête de la queue
   */
  public removeFromQueue(requestId: string): void {
    const queue = this.syncQueue.value.filter(req => req.id !== requestId);
    this.syncQueue.next(queue);
    this.saveQueue(queue);
  }

  /**
   * Obtenir le nombre de requêtes en attente
   */
  public getPendingCount(): number {
    return this.syncQueue.value.filter(req => !req.synced).length;
  }
}
