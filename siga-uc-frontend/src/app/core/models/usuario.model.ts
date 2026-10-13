/**
 * Modelos de Usuario y Autenticación
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

export type Rol = 'ADMIN' | 'DOCENTE' | 'SECRETARIA' | 'ESTUDIANTE';

export interface Usuario {
  id_usuario: number;
  dni: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  correo_institucional: string;
  telefono?: string;
  rol: Rol;
  id_rol: number;
  requiere_cambio_password: boolean;
  info_adicional?: any;
}

export interface LoginRequest {
  dni: string;
  password: string;
}

export interface LoginResponse {
  usuario: Usuario;
  token: string;
  expires_in: string;
}
