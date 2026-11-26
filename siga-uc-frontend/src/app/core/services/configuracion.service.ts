import { Injectable, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, retry, throwError, timeout, timer } from 'rxjs';
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
  private title = inject(Title);
  private readonly ANIO_CACHE_KEY = 'siga_uc_anio_lectivo';

  // Fallback inmediato: último año conocido o año calendario actual.
  // No se espera a la API para renderizar el login.
  private anio = signal<number>(
    this.leerAnioCache() ?? new Date().getFullYear()
  );
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
   * Lee el último año lectivo conocido. Evita usar el año calendario cuando
   * el año activo de la institución es distinto y la API aún está despertando.
   */
  private leerAnioCache(): number | null {
    try {
      const valor = Number(localStorage.getItem(this.ANIO_CACHE_KEY));
      return Number.isInteger(valor) && valor >= 2000 && valor <= 2100
        ? valor
        : null;
    } catch {
      return null;
    }
  }

  private guardarAnioCache(anio: number): void {
    try {
      localStorage.setItem(this.ANIO_CACHE_KEY, String(anio));
    } catch {
      // El almacenamiento puede estar bloqueado; el fallback sigue activo.
    }
  }

  private esErrorTransitorio(error: any): boolean {
    const status = Number(error?.status);
    return status === 0 || status === 502 || status === 503 || status === 504;
  }

  /**
   * Cargar la configuración desde el backend.
   * Se invoca en segundo plano; el login no espera esta respuesta.
   */
  async cargar(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http
          .get<any>(`${environment.apiUrl}/configuracion`)
          .pipe(
            timeout(45000),
            retry({
              count: 3,
              delay: (error) =>
                this.esErrorTransitorio(error)
                  ? timer(3000)
                  : throwError(() => error),
            })
          )
      );

      const anio = Number(response?.data?.anio_lectivo);
      if (Number.isInteger(anio) && anio > 0) {
        this.anio.set(anio);
        this.guardarAnioCache(anio);
      }

      const institucion = response?.data?.institucion;
      if (institucion?.nombre_institucion) {
        this.institucionState.set(institucion as InstitucionPublica);
        this.title.setTitle(`${institucion.nombre_institucion} — SIGA-UC`);
      } else {
        this.institucionState.set(null);
      }
    } catch (error) {
      console.warn(
        '⚠️ No se pudo cargar la configuración; se conserva el último año conocido.',
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
