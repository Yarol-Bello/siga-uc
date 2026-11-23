import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InstitucionConfig {
  id_configuracion: number;
  nombre_institucion: string;
  nombre_corto: string | null;
  ruc: string | null;
  direccion: string | null;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  pais: string | null;
  telefono: string | null;
  correo_contacto: string | null;
  sitio_web: string | null;
  logo_url: string | null;
  moneda: string;
  simbolo_moneda: string;
  zona_horaria: string;
  locale: string;
  nombre_remitente: string | null;
  texto_boleta: string | null;
  texto_libreta: string | null;
  texto_acta: string | null;
  texto_pie: string | null;
  serie_boleta: string | null;
  numero_boleta_inicial: number | null;
  actualizado_por: number | null;
  actualizado_en: string;
}

export interface ConfiguracionAnio {
  anio: number;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  dias_clase: string[];
  hora_inicio_jornada: string | null;
  hora_fin_jornada: string | null;
  duracion_min_bloque: number;
  max_bloques_curso_dia: number;
  horas_default_carga: number;
  politica_inicio_pension: string;
  mes_inicio_pension: number | null;
  version: number;
  actualizado_por: number | null;
  actualizado_en: string;
}

export interface ConfiguracionAdmin {
  anio_lectivo: number;
  institucion: InstitucionConfig;
  anios: ConfiguracionAnio[];
}

export interface Tarifa {
  id_concepto: number;
  nombre: string;
  monto_base: string;
  tipo: string;
  mes: number | null;
  anio_lectivo: number;
  nivel: string | null;
  id_grado: number | null;
  activo: boolean;
  descripcion: string | null;
  orden: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  nombre_grado: string | null;
  seccion: string | null;
  grado_nivel: string | null;
  pretickets: number;
  pagos: number;
  pensiones: number;
}

export interface ImpactoTarifa {
  alumnos_afectados: number;
  pensiones_pendientes: number;
  pretickets_pendientes: number;
  pagos_realizados: number;
}

export interface PreviewTarifa {
  modo: string;
  actual: Tarifa | null;
  propuesta: {
    nombre: string;
    monto_base: number;
    tipo: string;
    mes: number | null;
    anio_lectivo: number;
    nivel: string | null;
    id_grado: number | null;
    activo: boolean;
    descripcion: string | null;
    orden: number;
    vigente_desde: string;
    vigente_hasta: string | null;
  };
  impacto: ImpactoTarifa;
  advertencias: Array<{ codigo: string; mensaje: string }>;
  preview_hash: string;
}

export interface TipoBeca {
  id_tipo_beca: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  alcance: 'MATRICULA' | 'PENSION' | 'AMBOS';
  modalidad: 'PORCENTAJE' | 'MONTO_FIJO';
  valor_default: number;
  tope_monto: number | null;
  permite_combinacion: boolean;
  grupo_exclusividad: string | null;
  prioridad: number;
  requiere_evidencia: boolean;
  requiere_aprobacion: boolean;
  activo: boolean;
  orden: number;
  total_becas?: number;
}

export interface Beca {
  id_beca: number;
  id_alumno: number;
  id_tipo_beca: number;
  tipo: string;
  porcentaje_descuento: number;
  monto_descuento: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  activo: boolean;
  alcance: 'MATRICULA' | 'PENSION' | 'AMBOS';
  modalidad: 'PORCENTAJE' | 'MONTO_FIJO';
  valor: number;
  monto_maximo: number | null;
  estado: 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'ANULADA';
  motivo: string | null;
  evidencia: any;
  prioridad: number;
  dni: string;
  nombres: string;
  apellidos: string;
  alumno_nombre: string;
  anio_lectivo: number;
  id_grado: number;
  tipo_nombre?: string;
  tipo_codigo?: string;
}

export interface PreviewBeca {
  descuento: number;
  monto_final: number;
  aplicaciones: Array<{
    id_beca: number;
    tipo: string;
    tipo_codigo: string;
    tipo_nombre: string;
    modalidad: string;
    valor: number;
    monto_aplicado: number;
    porcentaje_aplicado: number | null;
  }>;
}

interface RespuestaApi<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * Servicio de administración de configuración (Fase 1 / H74).
 * No se usa en el arranque público; solo en la pantalla de ajustes.
 */
@Injectable({
  providedIn: 'root',
})
export class ConfiguracionAdminService {
  private http = inject(HttpClient);

  obtener(): Observable<RespuestaApi<ConfiguracionAdmin>> {
    return this.http.get<RespuestaApi<ConfiguracionAdmin>>(
      `${environment.apiUrl}/configuracion/admin`
    );
  }

  actualizarInstitucion(
    payload: Partial<InstitucionConfig> & { motivo: string }
  ): Observable<
    RespuestaApi<{ institucion: InstitucionConfig; sin_cambios: boolean }>
  > {
    return this.http.put<
      RespuestaApi<{ institucion: InstitucionConfig; sin_cambios: boolean }>
    >(`${environment.apiUrl}/configuracion/institucional`, payload);
  }

  listarTarifas(
    anio: number,
    opciones: { tipo?: string; incluirInactivos?: boolean } = {}
  ): Observable<RespuestaApi<Tarifa[]>> {
    const params: Record<string, string> = { anio: String(anio) };
    if (opciones.tipo) params['tipo'] = opciones.tipo;
    if (opciones.incluirInactivos) params['incluir_inactivos'] = '1';
    return this.http.get<RespuestaApi<Tarifa[]>>(
      `${environment.apiUrl}/configuracion/tarifas`,
      { params }
    );
  }

  previewTarifa(payload: any): Observable<RespuestaApi<PreviewTarifa>> {
    return this.http.post<RespuestaApi<PreviewTarifa>>(
      `${environment.apiUrl}/configuracion/tarifas/preview`,
      payload
    );
  }

  crearTarifa(payload: any): Observable<RespuestaApi<Tarifa>> {
    return this.http.post<RespuestaApi<Tarifa>>(
      `${environment.apiUrl}/configuracion/tarifas`,
      payload
    );
  }

  actualizarTarifa(id: number, payload: any): Observable<RespuestaApi<Tarifa>> {
    return this.http.put<RespuestaApi<Tarifa>>(
      `${environment.apiUrl}/configuracion/tarifas/${id}`,
      payload
    );
  }

  programarVersionTarifa(
    id: number,
    payload: any
  ): Observable<RespuestaApi<{ anterior: Tarifa; nueva: Tarifa }>> {
    return this.http.post<RespuestaApi<{ anterior: Tarifa; nueva: Tarifa }>>(
      `${environment.apiUrl}/configuracion/tarifas/${id}/version`,
      payload
    );
  }

  desactivarTarifa(
    id: number,
    motivo: string
  ): Observable<RespuestaApi<Tarifa>> {
    return this.http.put<RespuestaApi<Tarifa>>(
      `${environment.apiUrl}/configuracion/tarifas/${id}/desactivar`,
      { motivo }
    );
  }

  listarGrados(anio: number): Observable<RespuestaApi<any[]>> {
    return this.http.get<RespuestaApi<any[]>>(`${environment.apiUrl}/grados`, {
      params: { anio: String(anio) },
    });
  }

  listarAreas(incluirInactivas = true): Observable<RespuestaApi<any[]>> {
    return this.http.get<RespuestaApi<any[]>>(
      `${environment.apiUrl}/configuracion/academico/areas`,
      { params: { incluir_inactivas: incluirInactivas ? '1' : '0' } }
    );
  }

  crearArea(payload: any): Observable<RespuestaApi<any>> {
    return this.http.post<RespuestaApi<any>>(
      `${environment.apiUrl}/configuracion/academico/areas`,
      payload
    );
  }

  actualizarArea(id: number, payload: any): Observable<RespuestaApi<any>> {
    return this.http.put<RespuestaApi<any>>(
      `${environment.apiUrl}/configuracion/academico/areas/${id}`,
      payload
    );
  }

  eliminarArea(id: number, motivo: string): Observable<RespuestaApi<any>> {
    return this.http.delete<RespuestaApi<any>>(
      `${environment.apiUrl}/configuracion/academico/areas/${id}`,
      { body: { motivo } }
    );
  }

  listarCursosAdmin(incluirInactivos = true): Observable<RespuestaApi<any[]>> {
    return this.http.get<RespuestaApi<any[]>>(
      `${environment.apiUrl}/configuracion/academico/cursos`,
      { params: { incluir_inactivos: incluirInactivos ? '1' : '0' } }
    );
  }

  crearCurso(payload: any): Observable<RespuestaApi<any>> {
    return this.http.post<RespuestaApi<any>>(
      `${environment.apiUrl}/configuracion/academico/cursos`,
      payload
    );
  }

  actualizarCurso(id: number, payload: any): Observable<RespuestaApi<any>> {
    return this.http.put<RespuestaApi<any>>(
      `${environment.apiUrl}/configuracion/academico/cursos/${id}`,
      payload
    );
  }

  eliminarCurso(id: number, motivo: string): Observable<RespuestaApi<any>> {
    return this.http.delete<RespuestaApi<any>>(
      `${environment.apiUrl}/configuracion/academico/cursos/${id}`,
      { body: { motivo } }
    );
  }

  listarCompetenciasAdmin(
    idCurso: number,
    incluirInactivas = true
  ): Observable<RespuestaApi<any[]>> {
    return this.http.get<RespuestaApi<any[]>>(
      `${environment.apiUrl}/configuracion/academico/cursos/${idCurso}/competencias`,
      { params: { incluir_inactivas: incluirInactivas ? '1' : '0' } }
    );
  }

  crearCompetencia(idCurso: number, payload: any): Observable<RespuestaApi<any>> {
    return this.http.post<RespuestaApi<any>>(
      `${environment.apiUrl}/configuracion/academico/cursos/${idCurso}/competencias`,
      payload
    );
  }

  actualizarCompetencia(
    id: number,
    payload: any
  ): Observable<RespuestaApi<any>> {
    return this.http.put<RespuestaApi<any>>(
      `${environment.apiUrl}/configuracion/academico/competencias/${id}`,
      payload
    );
  }

  eliminarCompetencia(
    id: number,
    motivo: string
  ): Observable<RespuestaApi<any>> {
    return this.http.delete<RespuestaApi<any>>(
      `${environment.apiUrl}/configuracion/academico/competencias/${id}`,
      { body: { motivo } }
    );
  }

  obtenerHorarioAnio(anio: number): Observable<RespuestaApi<any>> {
    return this.http.get<RespuestaApi<any>>(
      `${environment.apiUrl}/configuracion/horarios/${anio}`
    );
  }

  actualizarHorarioAnio(
    anio: number,
    payload: any
  ): Observable<RespuestaApi<any>> {
    return this.http.put<RespuestaApi<any>>(
      `${environment.apiUrl}/configuracion/horarios/${anio}`,
      payload
    );
  }

  listarTiposBeca(
    incluirInactivos = true
  ): Observable<RespuestaApi<TipoBeca[]>> {
    return this.http.get<RespuestaApi<TipoBeca[]>>(
      `${environment.apiUrl}/configuracion/becas/tipos`,
      { params: { incluir_inactivos: incluirInactivos ? '1' : '0' } }
    );
  }

  crearTipoBeca(payload: any): Observable<RespuestaApi<TipoBeca>> {
    return this.http.post<RespuestaApi<TipoBeca>>(
      `${environment.apiUrl}/configuracion/becas/tipos`,
      payload
    );
  }

  actualizarTipoBeca(
    id: number,
    payload: any
  ): Observable<RespuestaApi<TipoBeca>> {
    return this.http.put<RespuestaApi<TipoBeca>>(
      `${environment.apiUrl}/configuracion/becas/tipos/${id}`,
      payload
    );
  }

  listarBecas(
    anio: number,
    filtros: { estado?: string; id_tipo_beca?: number; search?: string } = {}
  ): Observable<RespuestaApi<Beca[]>> {
    const params: Record<string, string> = { anio: String(anio) };
    if (filtros.estado) params['estado'] = filtros.estado;
    if (filtros.id_tipo_beca) {
      params['id_tipo_beca'] = String(filtros.id_tipo_beca);
    }
    return this.http.get<RespuestaApi<Beca[]>>(
      `${environment.apiUrl}/configuracion/becas`,
      { params }
    );
  }

  previewBeca(payload: any): Observable<RespuestaApi<PreviewBeca>> {
    return this.http.post<RespuestaApi<PreviewBeca>>(
      `${environment.apiUrl}/configuracion/becas/preview`,
      payload
    );
  }

  crearBeca(payload: any): Observable<RespuestaApi<Beca>> {
    return this.http.post<RespuestaApi<Beca>>(
      `${environment.apiUrl}/configuracion/becas`,
      payload
    );
  }

  actualizarBeca(id: number, payload: any): Observable<RespuestaApi<Beca>> {
    return this.http.put<RespuestaApi<Beca>>(
      `${environment.apiUrl}/configuracion/becas/${id}`,
      payload
    );
  }

  aprobarBeca(id: number, motivo: string): Observable<RespuestaApi<Beca>> {
    return this.http.put<RespuestaApi<Beca>>(
      `${environment.apiUrl}/configuracion/becas/${id}/aprobar`,
      { motivo }
    );
  }

  rechazarBeca(id: number, motivo: string): Observable<RespuestaApi<Beca>> {
    return this.http.put<RespuestaApi<Beca>>(
      `${environment.apiUrl}/configuracion/becas/${id}/rechazar`,
      { motivo }
    );
  }

  anularBeca(id: number, motivo: string): Observable<RespuestaApi<Beca>> {
    return this.http.put<RespuestaApi<Beca>>(
      `${environment.apiUrl}/configuracion/becas/${id}/anular`,
      { motivo }
    );
  }

  listarAlumnos(
    anio: number,
    search = ''
  ): Observable<RespuestaApi<any[]>> {
    const params: Record<string, string> = {
      anio: String(anio),
      page: '1',
      pageSize: '300',
    };
    if (search) params['search'] = search;
    return this.http.get<RespuestaApi<any[]>>(
      `${environment.apiUrl}/alumnos`,
      { params }
    );
  }
}
