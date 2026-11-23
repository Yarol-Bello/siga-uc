import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InstitucionPublica {
  nombre_institucion: string;
  nombre_corto: string | null;
  logo_url: string | null;
  moneda: string;
  simbolo_moneda: string;
  zona_horaria: string;
  locale: string;
}

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

  private institucionState = signal<InstitucionPublica | null>(null);
  readonly institucion = this.institucionState.asReadonly();
  readonly nombreInstitucion = computed(
    () => this.institucionState()?.nombre_institucion || 'SIGA-UC'
  );
  readonly nombreCorto = computed(
    () => this.institucionState()?.nombre_corto || this.nombreInstitucion()
  );
  readonly moneda = computed(() => this.institucionState()?.moneda || 'PEN');
  readonly simboloMoneda = computed(
    () => this.institucionState()?.simbolo_moneda || 'S/'
  );
  readonly zonaHoraria = computed(
    () => this.institucionState()?.zona_horaria || 'America/Lima'
  );

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

      const institucion = response?.data?.institucion;
      if (institucion?.nombre_institucion) {
        this.institucionState.set(institucion as InstitucionPublica);
      } else {
        this.institucionState.set(null);
      }
    } catch (error) {
      console.warn(
        '⚠️ No se pudo cargar la configuración; se usa el año calendario actual.',
        error
      );
    }
  }

  /**
   * Alias explícito para recargar después de guardar ajustes.
   */
  async recargar(): Promise<void> {
    await this.cargar();
  }
}
