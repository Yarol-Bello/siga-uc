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
}
