import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Servicio de Configuración del Sistema
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Injectable({
  providedIn: 'root',
})
export class ConfiguracionService {
  private http = inject(HttpClient);

  // Fallback inmediato: año calendario actual (nunca queda undefined)
  private anio = signal<number>(new Date().getFullYear());
  readonly anioLectivo = this.anio.asReadonly();

  /**
   * Cargar la configuración desde el backend.
   * Se invoca en el app initializer, antes de renderizar las vistas.
   */
  async cargar(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${environment.apiUrl}/configuracion`)
      );

      const anio = Number(response?.data?.anio_lectivo);
      if (Number.isInteger(anio) && anio > 0) {
        this.anio.set(anio);
      }
    } catch (error) {
      console.warn(
        '⚠️ No se pudo cargar la configuración; se usa el año calendario actual.',
        error
      );
    }
  }
}
