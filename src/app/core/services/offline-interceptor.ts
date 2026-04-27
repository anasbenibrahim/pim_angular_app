import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
  HttpResponse
} from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OfflineSyncService } from './offline-sync.service';

@Injectable()
export class OfflineInterceptor implements HttpInterceptor {
  // URLs à ignorer pour la synchro offline (auth, publics endpoints)
  private readonly IGNORE_PATTERNS = [
    '/api/auth',
    '/api/internal',
    '/login',
    '/register'
  ];

  constructor(private offlineSyncService: OfflineSyncService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Si c'est une requête à ignorer, passer directement
    if (this.shouldIgnore(request.url)) {
      return next.handle(request);
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Si erreur réseau (status 0) ET requête non-GET (POST, PUT, DELETE, PATCH)
        if (error.status === 0 && this.shouldQueueRequest(request.method)) {
          console.log('[OfflineInterceptor] Erreur réseau détectée, ajout à la queue offline');

          // Ajouter à la queue offline
          const headers = this.extractHeaders(request);
          this.offlineSyncService.addToQueue(
            request.method,
            request.url,
            request.body,
            headers
          );

          // Retourner une réponse vide (succès) pour ne pas bloquer l'UI
          const response = new HttpResponse({
            status: 202,
            statusText: 'Accepted - Queued for sync',
            body: { offline: true, queued: true }
          });
          return of(response);
        }

        // Autres erreurs, laisser passer
        return throwError(() => error);
      })
    );
  }

  /**
   * Vérifier si l'URL doit être ignorée
   */
  private shouldIgnore(url: string): boolean {
    return this.IGNORE_PATTERNS.some(pattern => url.includes(pattern));
  }

  /**
   * Vérifier si la requête peut être queueée (pas GET)
   */
  private shouldQueueRequest(method: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  }

  /**
   * Extraire les headers pertinents
   */
  private extractHeaders(request: HttpRequest<any>): Record<string, string> {
    const headers: Record<string, string> = {};
    request.headers.keys().forEach(key => {
      const value = request.headers.get(key);
      if (value) {
        headers[key] = value;
      }
    });
    return headers;
  }
}

