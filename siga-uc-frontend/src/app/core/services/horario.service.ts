import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PeriodoClase {
  id_periodo: number;
  anio_lectivo: number;
  nombre: string;
  orden: number;
  hora_inicio: string;
  hora_fin: string;
  tipo: 'CLASE' | 'RECREO' | 'ALMUERZO';
  activo: boolean;
}

export interface HorarioBloque {
  id_horario: number;
  id_carga: number;
  id_grado: number;
  id_curso: number;
  id_personal: number;
  anio_lectivo: number;
  dia_semana: string;
  id_periodo: number;
  aula: string | null;
  estado: 'BORRADOR' | 'PUBLICADO';
  periodo_nombre: string;
  periodo_orden: number;
  hora_inicio: string;
  hora_fin: string;
  periodo_tipo: string;
  nombre_grado: string;
  seccion: string;
  nivel: string;
  nombre_curso: string;
  area_academica: string;
  docente_nombre: string;
}

export interface ListadoHorarios {
  anio: number;
  dias_clase: string[];
  periodos: PeriodoClase[];
  bloques: HorarioBloque[];
  resumen: {
    total: number;
    publicados: number;
    borradores: number;
  };
}

export interface MiHorario {
  anio: number;
  dias_clase: string[];
  alcance: 'DOCENTE' | 'ESTUDIANTE';
  id_personal?: number;
  docente?: string;
  id_alumno?: number;
  id_grado?: number;
  grado?: string;
  seccion?: string;
  nivel?: string;
  publicado: boolean;
  periodos: PeriodoClase[];
  bloques: HorarioBloque[];
}

export interface GradoHorario {
  id_grado: number;
  nombre_grado: string;
  seccion: string;
  nivel: string;
  anio_lectivo: number;
}

export interface CargaHorario {
  id_carga: number;
  id_grado: number;
  id_curso: number;
  id_personal: number;
  anio_lectivo: number;
  horas_asignadas: number | null;
  nombre_grado: string;
  seccion: string;
  nombre_curso: string;
  area_academica: string;
  docente_nombre_completo: string;
}

export interface ResultadoGeneracion {
  anio: number;
  id_grado: number | null;
  seed: number;
  intentos: number;
  generados: number;
  reemplazados: number;
  parcial: boolean;
  por_grado: Array<{
    id_grado: number;
    nombre_grado: string;
    seccion: string;
    requeridas: number;
    colocadas: number;
    faltan: number;
  }>;
  sin_ubicar: Array<{
    id_carga: number;
    id_grado: number;
    nombre_grado: string;
    seccion: string;
    id_curso: number;
    nombre_curso: string;
    id_personal: number;
    docente_nombre: string;
    requeridas: number;
    colocadas: number;
    faltan: number;
    motivo: string;
  }>;
  advertencias: string[];
  publicado: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class HorarioService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/horarios`;

  listar(
    anio: number,
    idGrado?: number | null,
    idPersonal?: number | null,
    estado?: string | null,
  ): Observable<any> {
    let params = new HttpParams().set('anio', String(anio));
    if (idGrado) params = params.set('id_grado', String(idGrado));
    if (idPersonal) params = params.set('id_personal', String(idPersonal));
    if (estado) params = params.set('estado', estado);
    return this.http.get<any>(this.API, { params });
  }

  miHorario(): Observable<any> {
    return this.http.get<any>(`${this.API}/mi-horario`);
  }

  crearBloque(payload: any): Observable<any> {
    return this.http.post<any>(this.API, payload);
  }

  actualizarBloque(id: number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.API}/${id}`, payload);
  }

  eliminarBloque(id: number, confirmar = false): Observable<any> {
    return this.http.delete<any>(`${this.API}/${id}`, {
      body: { confirmar },
    });
  }

  generar(payload: any): Observable<any> {
    return this.http.post<any>(`${this.API}/generar`, payload);
  }

  publicar(payload: any): Observable<any> {
    return this.http.post<any>(`${this.API}/publicar`, payload);
  }

  despublicar(payload: any): Observable<any> {
    return this.http.post<any>(`${this.API}/despublicar`, payload);
  }

  listarPeriodos(anio: number): Observable<any> {
    return this.http.get<any>(`${this.API}/periodos`, {
      params: new HttpParams().set('anio', String(anio)),
    });
  }

  crearPeriodo(payload: any): Observable<any> {
    return this.http.post<any>(`${this.API}/periodos`, payload);
  }

  actualizarPeriodo(id: number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.API}/periodos/${id}`, payload);
  }

  eliminarPeriodo(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API}/periodos/${id}`);
  }

  listarGrados(anio: number): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/grados`, {
      params: new HttpParams().set('anio', String(anio)),
    });
  }

  listarCargas(anio: number, idGrado: number): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/carga-curricular`, {
      params: new HttpParams()
        .set('anio', String(anio))
        .set('id_grado', String(idGrado)),
    });
  }
}
