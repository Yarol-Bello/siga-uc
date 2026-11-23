import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SetupEstado {
  requiere_setup: boolean;
  setup_disponible: boolean;
  setup_completado: boolean;
  token_configurado: boolean;
  anio_lectivo_sugerido?: number;
  mensaje?: string;
}

interface RespuestaApi<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface SetupPayload {
  token: string;
  institucion: {
    nombre_institucion: string;
    nombre_corto?: string;
    ruc?: string;
    direccion?: string;
    distrito?: string;
    provincia?: string;
    departamento?: string;
    telefono?: string;
    correo_contacto?: string;
    sitio_web?: string;
    logo_url?: string;
  };
  anio_lectivo: number;
  fecha_inicio: string;
  fecha_fin: string;
  niveles: string[];
  admin: {
    dni: string;
    nombres: string;
    apellidos: string;
    correo: string;
    telefono?: string;
    password: string;
    confirmar_password: string;
  };
}

@Injectable({ providedIn: 'root' })
export class SetupService {
  private http = inject(HttpClient);

  estado(): Observable<RespuestaApi<SetupEstado>> {
    return this.http.get<RespuestaApi<SetupEstado>>(
      `${environment.apiUrl}/setup/status`
    );
  }

  inicializar(payload: SetupPayload): Observable<RespuestaApi<any>> {
    return this.http.post<RespuestaApi<any>>(
      `${environment.apiUrl}/setup/inicializar`,
      payload
    );
  }
}
