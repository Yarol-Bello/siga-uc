import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ResultadoPromocion =
  | 'PROMOVIDO'
  | 'REPITENTE'
  | 'EGRESADO'
  | 'RETIRADO'
  | 'PENDIENTE';

export type EstadoPromocion =
  | 'PREVISUALIZADA'
  | 'CONFIRMADA'
  | 'ANULADA'
  | 'ERROR';

export interface PoliticaPromocion {
  id_politica: number;
  anio_origen: number;
  anio_destino: number | null;
  nombre: string;
  activo: boolean;
  requiere_actas_cerradas: boolean;
  requiere_notas_finales: boolean;
  umbral_asistencia: number | null;
  criterio_academico: Record<string, any>;
  permite_override: boolean;
  creado_por: number | null;
  creado_por_nombre?: string | null;
  fecha_creacion: string;
}

export interface BloqueoPromocion {
  codigo: string;
  mensaje: string;
  detalle?: unknown;
}

export interface AlumnoPromocion {
  id_alumno_origen: number;
  id_usuario: number;
  dni: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  fecha_nacimiento: string;
  id_apoderado: number | null;
  codigo_estudiante: string | null;
  estado_matricula: string;
  condicion: string;
  id_grado_origen: number;
  nombre_grado: string;
  nivel: string;
  seccion: string;
  orden: number;
  fecha_retiro: string | null;
  motivo_retiro: string | null;
  colegio_destino: string | null;
  id_grado_destino: number | null;
  resultado_sugerido: ResultadoPromocion;
  resultado_final: ResultadoPromocion;
  es_override: boolean;
  motivo: string | null;
  ya_confirmada: boolean;
  id_promocion: number | null;
  id_alumno_destino_promocion: number | null;
  actas: {
    requeridas: number[];
    cerradas: number[];
    faltantes: number[];
    global_cerrada: boolean;
  };
  notas: {
    bimestre: number;
    requeridas: number;
    registradas: number;
    faltantes: string[];
    cursos: string[];
  };
  asistencia: {
    total: number;
    presentes: number;
    tardanzas: number;
    faltas: number;
    porcentaje: number | null;
    umbral: number | null;
    cumple: boolean;
  };
  deuda: { monto: number; pensiones: number; pretickets: number };
  becas: Array<{
    id_beca: number;
    tipo: string;
    porcentaje_descuento: number;
    monto_descuento: number | null;
    fecha_fin: string | null;
  }>;
  bloqueos: BloqueoPromocion[];
  advertencias: BloqueoPromocion[];
  bloqueado: boolean;
}

export interface PreviewPromocion {
  anio_origen: number;
  anio_destino: number;
  id_politica: number;
  politica: PoliticaPromocion;
  id_grado: number | null;
  incluir_retirados: boolean;
  destino: {
    nombre: string;
    tiene_matricula: boolean;
    concepto_matricula: { id_concepto: number; monto: number } | null;
    grados: Array<{
      id_grado: number;
      nombre_grado: string;
      nivel: string;
      seccion: string;
      orden: number;
    }>;
  };
  resumen: {
    total: number;
    por_resultado: Record<ResultadoPromocion, number>;
    bloqueados: number;
    overrides: number;
    ya_confirmadas: number;
    retirados_omitidos: number;
  };
  alumnos: AlumnoPromocion[];
  advertencias: BloqueoPromocion[];
  bloqueos: BloqueoPromocion[];
  preview_hash: string;
}

export interface DecisionPromocion {
  id_alumno_origen: number;
  resultado: ResultadoPromocion;
  id_grado_destino?: number | null;
  motivo?: string;
  es_override?: boolean;
}

export interface ResultadoConfirmacionPromocion {
  anio_origen: number;
  anio_destino: number;
  ya_confirmada: boolean;
  creados: number;
  promociones: Array<{
    id_promocion: number;
    id_alumno_origen: number;
    id_alumno_destino: number | null;
    resultado: ResultadoPromocion;
    id_grado_destino?: number | null;
  }>;
  conteos: Record<string, number>;
  resumen: PreviewPromocion['resumen'];
  preview_hash: string;
}

export interface PromocionRegistro {
  id_promocion: number;
  id_alumno_origen: number;
  id_alumno_destino: number | null;
  anio_origen: number;
  anio_destino: number | null;
  id_grado_origen: number;
  id_grado_destino: number | null;
  estado: EstadoPromocion;
  resultado: ResultadoPromocion;
  es_override: boolean;
  motivo: string | null;
  id_usuario: number | null;
  fecha_creacion: string;
  fecha_confirmacion: string | null;
  metadata: Record<string, any>;
  alumno_origen_dni: string;
  alumno_origen_nombre: string;
  alumno_destino_dni: string | null;
  alumno_destino_nombre: string | null;
  grado_origen_nombre: string;
  grado_origen_seccion: string;
  grado_destino_nombre: string | null;
  grado_destino_seccion: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class PromocionService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/promociones`;

  private _politicas = signal<PoliticaPromocion[]>([]);
  private _promociones = signal<PromocionRegistro[]>([]);
  private _cargando = signal(false);
  private _error = signal<string | null>(null);

  readonly politicas = this._politicas.asReadonly();
  readonly promociones = this._promociones.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();

  async cargarPoliticas(filtros: Record<string, any> = {}): Promise<void> {
    this._cargando.set(true);
    this._error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.API}/politicas`, {
          params: this.crearParams(filtros),
        }),
      );
      this._politicas.set(response?.data || []);
    } catch (error: any) {
      this._cargando.set(false);
      this._error.set(this.mensajeError(error));
      throw error;
    }
    this._cargando.set(false);
  }

  async crearPolitica(payload: Record<string, any>): Promise<PoliticaPromocion> {
    const response = await firstValueFrom(
      this.http.post<any>(`${this.API}/politicas`, payload),
    );
    return response?.data;
  }

  async actualizarPolitica(
    id: number,
    payload: Record<string, any>,
  ): Promise<PoliticaPromocion> {
    const response = await firstValueFrom(
      this.http.put<any>(`${this.API}/politicas/${id}`, payload),
    );
    return response?.data;
  }

  async listarGrados(anio: number): Promise<any[]> {
    const response = await firstValueFrom(
      this.http.get<any>(`${environment.apiUrl}/grados`, {
        params: new HttpParams().set('anio', String(anio)),
      }),
    );
    return response?.data || [];
  }

  async previsualizar(payload: {
    anio_origen: number;
    anio_destino: number;
    id_politica: number;
    id_grado?: number | null;
    incluir_retirados?: boolean;
    decisiones?: DecisionPromocion[];
  }): Promise<PreviewPromocion> {
    const response = await firstValueFrom(
      this.http.post<any>(`${this.API}/preview`, payload),
    );
    return response?.data;
  }

  async confirmar(payload: {
    anio_origen: number;
    anio_destino: number;
    id_politica: number;
    id_grado?: number | null;
    incluir_retirados?: boolean;
    decisiones?: DecisionPromocion[];
    copiar_becas?: boolean;
    preview_hash: string;
    confirmar: boolean;
  }): Promise<ResultadoConfirmacionPromocion> {
    const response = await firstValueFrom(
      this.http.post<any>(`${this.API}/confirmar`, payload),
    );
    return response?.data;
  }

  async cargarPromociones(filtros: Record<string, any> = {}): Promise<void> {
    this._error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.get<any>(this.API, {
          params: this.crearParams(filtros),
        }),
      );
      this._promociones.set(response?.data || []);
    } catch (error: any) {
      this._error.set(this.mensajeError(error));
      throw error;
    }
  }

  async anular(
    id: number,
    motivo: string,
  ): Promise<Record<string, any>> {
    const response = await firstValueFrom(
      this.http.put<any>(`${this.API}/${id}/anular`, { motivo }),
    );
    return response?.data;
  }

  mensajeError(error: any): string {
    const detalle = error?.error?.errors;
    if (Array.isArray(detalle) && detalle.length > 0) {
      return detalle.join(' ');
    }
    if (detalle?.codigo === 'PROMOCIONES_NO_APLICADAS') {
      return (
        error?.error?.message ||
        'La base de datos no tiene aplicadas las tablas de promoción (H73).'
      );
    }
    return (
      error?.error?.message ||
      error?.message ||
      'No se pudo completar la operación.'
    );
  }

  private crearParams(filtros: Record<string, any>): HttpParams {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return params;
  }
}
