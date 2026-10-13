import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, Usuario } from '../models/usuario.model';

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

  /**
   * Login del usuario
   */
  login(credentials: LoginRequest): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/login`, credentials).pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.guardarSesion(response.data.token, response.data.usuario);
        }
      }),
      catchError((error) => {
        console.error('❌ Error en login:', error);
        return throwError(() => error);
      })
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
