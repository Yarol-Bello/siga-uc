/**
 * Servicio de UI compartida - SIGA-UC
 * Maneja el estado global de la interfaz (sidebar abierto/cerrado, etc.)
 */

import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UiService {
  /**
   * Estado del sidebar. En desktop siempre visible (ignorado).
   * En móvil controla si está abierto o cerrado.
   */
  private readonly _sidebarAbierto = signal(false);

  /** Lectura pública del estado */
  readonly sidebarAbierto = this._sidebarAbierto.asReadonly();

  /** Abrir el sidebar (móvil) */
  abrirSidebar(): void {
    this._sidebarAbierto.set(true);
  }

  /** Cerrar el sidebar (móvil) */
  cerrarSidebar(): void {
    this._sidebarAbierto.set(false);
  }

  /** Alternar estado */
  toggleSidebar(): void {
    this._sidebarAbierto.update((v) => !v);
  }
}