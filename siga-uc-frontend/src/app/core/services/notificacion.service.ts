import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Notificacion {
  id_notificacion: number;
  asunto: string;
  cuerpo: string;
  leido: boolean;
  fecha_envio: string;
  remitente_nombre: string | null;
  remitente_correo: string | null;
}

/**
 * Servicio de Notificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Injectable({
  providedIn: 'root',
})
export class NotificacionService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/notificaciones`;

  // Signal reactivo con el total de no leídas
  private noLeidasSignal = signal<number>(0);
  public noLeidas = this.noLeidasSignal.asReadonly();

  /**
   * Obtener todas las notificaciones del usuario autenticado
   */
  listar(): Observable<any> {
    return this.http.get<any>(this.API_URL);
  }

  /**
   * Contar notificaciones no leídas
   */
  contarNoLeidas(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/no-leidas`).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.noLeidasSignal.set(res.data.no_leidas || 0);
        }
      }),
    );
  }

  /**
   * Marcar una notificación como leída
   */
  marcarLeida(id: number): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/${id}/leer`, {}).pipe(
      tap(() => {
        const actual = this.noLeidasSignal();
        if (actual > 0) {
          this.noLeidasSignal.set(actual - 1);
        }
      }),
    );
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  marcarTodasLeidas(): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/leer-todas`, {}).pipe(
      tap(() => {
        this.noLeidasSignal.set(0);
      }),
    );
  }

  /**
   * Actualizar el contador manualmente
   */
  actualizarContador(): void {
    this.contarNoLeidas().subscribe();
  }
}
