import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type EstadoAnio = 'PLANIFICADO' | 'ACTIVO' | 'CERRADO';

export interface AnioLectivo {
  anio: number;
  estado: EstadoAnio;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  creado_por: number | null;
  creado_por_nombre: string | null;
  cerrado_por: number | null;
  cerrado_por_nombre: string | null;
  fecha_creacion: string | null;
  fecha_cierre: string | null;
  observacion: string | null;
  grados: number;
  conceptos: number;
  conceptos_matricula: number;
  periodos: number;
  carga: number;
  tutores: number;
  alumnos: number;
  pagos: number;
  notas: number;
  asistencia: number;
  pensiones: number;
  pretickets: number;
  actas: number;
  horarios: number;
}

export interface BloqueoRollover {
  codigo: string;
  mensaje: string;
  detalle?: unknown;
}

export interface DetalleGradoRollover {
  id_grado: number;
  id_grado_destino: number | null;
  nombre_grado: string;
  nivel: string;
  seccion: string;
  orden: number;
  estado: string;
}

export interface DetalleConceptoRollover {
  id_concepto: number;
  nombre: string;
  nombre_origen: string;
  tipo: string;
  mes: number | null;
  monto_base: string;
  estado: string;
}

export interface DetallePeriodoRollover {
  id_periodo: number;
  nombre: string;
  orden: number;
  hora_inicio: string;
  hora_fin: string;
  tipo: string;
  activo: boolean;
  estado: string;
}

export interface DetalleCargaRollover {
  id_carga: number;
  id_grado_destino: number | null;
  nombre_grado: string;
  seccion: string;
  nombre_curso: string;
  area_academica: string;
  docente_nombre: string;
  id_personal: number;
  horas_asignadas: number | null;
  estado: string;
}

export interface DetalleTutorRollover {
  id_tutor: number;
  id_grado_destino: number | null;
  nombre_grado: string;
  seccion: string;
  docente_nombre: string;
  id_personal: number;
  estado: string;
}

export interface PreviewRollover {
  anio_origen: number;
  anio_destino: number;
  incluir_otros: boolean;
  crear_anio: boolean;
  resumen: {
    grados: { total: number; nuevos: number; existentes: number };
    conceptos: {
      total: number;
      nuevos: number;
      existentes: number;
      matricula: number;
      pension: number;
      otros: number;
      omitidos: number;
    };
    periodos: { total: number; nuevos: number; existentes: number };
    carga: { total: number; nuevas: number; existentes: number };
    tutores: {
      total: number;
      nuevos: number;
      existentes: number;
      omitidos: number;
    };
    docentes: { total: number; inactivos: number; sobrecargados: number };
    capacidad_horaria: number;
  };
  detalle: {
    grados: DetalleGradoRollover[];
    conceptos: DetalleConceptoRollover[];
    periodos: DetallePeriodoRollover[];
    carga: DetalleCargaRollover[];
    tutores: DetalleTutorRollover[];
  };
  actividad_destino: Record<string, number>;
  bloqueos: BloqueoRollover[];
  advertencias: string[];
  preview_hash: string;
}

export interface ResultadoRollover {
  anio_origen: number;
  anio_destino: number;
  incluir_otros: boolean;
  anio_creado: boolean;
  estado: EstadoAnio;
  creados: number;
  existentes: number;
  conteos: Record<string, Record<string, number>>;
  preview_hash: string;
}

export interface ResultadoActivacion {
  anio: number;
  estado: EstadoAnio;
  anios_cerrados: number[];
  anterior: number | null;
}

export interface ResultadoReversion {
  anio: number;
  motivo: string;
  anio_origen: number;
  incluir_otros: boolean;
  anio_eliminado: boolean;
  conteos: Record<string, number>;
}

/**
 * Servicio del módulo Años Lectivos y Rollover (H49 / 6.2).
 * Mantiene el catálogo en un signal y expone operaciones HTTP.
 */
@Injectable({
  providedIn: 'root',
})
export class AnioLectivoService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/anios-lectivos`;

  private _anios = signal<AnioLectivo[]>([]);
  private _cargando = signal(false);
  private _error = signal<string | null>(null);

  readonly anios = this._anios.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * Carga el catálogo de años desde el backend.
   */
  async cargar(): Promise<void> {
    this._cargando.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(this.http.get<any>(this.API));
      this._anios.set(response?.data || []);
    } catch (error: any) {
      this._cargando.set(false);
      this._error.set(this.mensajeError(error));
      throw error;
    }

    this._cargando.set(false);
  }

  /**
   * Previsualización de solo lectura.
   */
  async previsualizar(payload: {
    anio_origen: number;
    anio_destino: number;
    incluir_otros?: boolean;
  }): Promise<PreviewRollover> {
    const response = await firstValueFrom(
      this.http.post<any>(`${this.API}/preview`, payload),
    );
    return response?.data;
  }

  /**
   * Confirmación transaccional del rollover.
   */
  async confirmar(payload: {
    anio_origen: number;
    anio_destino: number;
    preview_hash: string;
    confirmar: boolean;
    incluir_otros?: boolean;
  }): Promise<ResultadoRollover> {
    const response = await firstValueFrom(
      this.http.post<any>(`${this.API}/rollover`, payload),
    );
    return response?.data;
  }

  /**
   * Activación auditada del año. El backend actualiza su caché.
   */
  async activar(anio: number): Promise<ResultadoActivacion> {
    const response = await firstValueFrom(
      this.http.put<any>(`${this.API}/${anio}/activar`, { confirmar: true }),
    );
    return response?.data;
  }

  /**
   * Reversión de un rollover sin actividad.
   */
  async revertir(
    anio: number,
    motivo: string,
  ): Promise<ResultadoReversion> {
    const response = await firstValueFrom(
      this.http.delete<any>(`${this.API}/${anio}/rollover`, {
        body: { motivo, confirmar: true },
      }),
    );
    return response?.data;
  }

  /**
   * Mensaje legible de un error HTTP del backend.
   */
  mensajeError(error: any): string {
    const detalle = error?.error?.errors;
    if (Array.isArray(detalle) && detalle.length > 0) {
      return detalle.join(' ');
    }
    if (detalle?.codigo === 'H49_NO_APLICADO') {
      return error?.error?.message || 'La base de datos no tiene aplicada H49.';
    }
    return (
      error?.error?.message ||
      error?.message ||
      'No se pudo completar la operación.'
    );
  }
}
