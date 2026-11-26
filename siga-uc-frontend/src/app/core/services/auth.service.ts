import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, finalize, retry, timeout, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  CambiarPasswordRequest,
  Usuario,
} from '../models/usuario.model';

/**
 * Servicio de Autenticación
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly API_URL = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'siga_uc_token';
  private readonly USER_KEY = 'siga_uc_user';

  // Signal reactivo con el usuario actual
  private usuarioActual = signal<Usuario | null>(this.getUsuarioFromStorage());
  public usuario = this.usuarioActual.asReadonly();

  // Estado visible mientras Render despierta el backend.
  private esperandoServidorState = signal(false);
  readonly esperandoServidor = this.esperandoServidorState.asReadonly();
  private mensajeConexionState = signal<string | null>(null);
  readonly mensajeConexion = this.mensajeConexionState.asReadonly();

  /**
   * Login del usuario.
   * Si Render está en cold start, muestra un mensaje y reintenta solo ante
   * errores de red o respuestas 502/503/504. Nunca reintenta 401/403.
   */
  login(credentials: LoginRequest): Observable<any> {
    this.esperandoServidorState.set(false);
    this.mensajeConexionState.set(null);

    const aviso = window.setTimeout(() => {
      this.esperandoServidorState.set(true);
      this.mensajeConexionState.set(
        'El servidor está despertando. Esto puede tardar hasta 60 segundos...'
      );
    }, 4000);

    return this.http.post<any>(`${this.API_URL}/login`, credentials).pipe(
      timeout(75000),
      retry({
        count: 2,
        delay: (error, retryCount) => {
          if (!this.esErrorColdStart(error)) {
            return throwError(() => error);
          }
          this.esperandoServidorState.set(true);
          this.mensajeConexionState.set(
            `El servidor está despertando. Reintentando ${retryCount} de 2...`
          );
          return timer(5000);
        },
      }),
      tap((response) => {
        if (response.success && response.data) {
          this.guardarSesion(response.data.token, response.data.usuario);
        }
      }),
      catchError((error) => {
        console.error('❌ Error en login:', error?.status || error?.name);
        if (this.esErrorColdStart(error)) {
          return throwError(
            () =>
              new Error(
                'El servidor no respondió después de varios intentos. Espere un momento y vuelva a intentar.'
              )
          );
        }
        return throwError(() => error);
      }),
      finalize(() => {
        window.clearTimeout(aviso);
        this.esperandoServidorState.set(false);
        this.mensajeConexionState.set(null);
      })
    );
  }

  private esErrorColdStart(error: any): boolean {
    const status = Number(error?.status);
    return (
      status === 0 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      error?.name === 'TimeoutError'
    );
  }

  /**
   * Cerrar sesión
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.usuarioActual.set(null);
    this.router.navigate(['/login']);
  }

  /**
   * Obtener el token JWT
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    // Verificar si el token expiró
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirado = payload.exp * 1000 < Date.now();
      if (expirado) {
        this.logout();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtener el usuario actual
   */
  getUsuarioActual(): Usuario | null {
    return this.usuarioActual();
  }

  /**
   * Verificar si tiene un rol específico
   */
  tieneRol(roles: string[]): boolean {
    const usuario = this.usuarioActual();
    if (!usuario) return false;
    return roles.includes(usuario.rol);
  }

  /**
   * Obtener el perfil desde el backend
   */
  getPerfil(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/perfil`);
  }

  /**
   * Cambiar la contraseña del usuario autenticado
   */
  cambiarPassword(data: CambiarPasswordRequest): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/cambiar-password`, data);
  }

  /**
   * Verificar si el usuario debe cambiar su contraseña
   */
  requiereCambioPassword(): boolean {
    return this.usuarioActual()?.requiere_cambio_password === true;
  }

  /**
   * Marcar la contraseña como actualizada (flag FALSE)
   */
  marcarPasswordCambiada(): void {
    this.establecerRequiereCambioPassword(false);
  }

  /**
   * Actualizar el flag de cambio obligatorio en el usuario actual
   */
  establecerRequiereCambioPassword(valor: boolean): void {
    const usuario = this.usuarioActual();
    if (!usuario) return;

    const actualizado: Usuario = {
      ...usuario,
      requiere_cambio_password: valor,
    };

    localStorage.setItem(this.USER_KEY, JSON.stringify(actualizado));
    this.usuarioActual.set(actualizado);
  }

  /**
   * Ruta del dashboard según el rol actual
   */
  getDashboardUrl(): string {
    switch (this.usuarioActual()?.rol) {
      case 'ADMIN':
        return '/admin';
      case 'DOCENTE':
        return '/docente';
      case 'ESTUDIANTE':
        return '/estudiante';
      case 'SECRETARIA':
        return '/secretaria';
      default:
        return '/login';
    }
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  private guardarSesion(token: string, usuario: Usuario): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(usuario));
    this.usuarioActual.set(usuario);
  }

  private getUsuarioFromStorage(): Usuario | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
}
