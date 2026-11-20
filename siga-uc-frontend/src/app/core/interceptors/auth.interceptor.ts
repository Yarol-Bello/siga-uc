import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor HTTP que agrega el token JWT a todas las peticiones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // Si hay token, clonar la petición y agregar el header Authorization
  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // El backend exige cambiar la contraseña antes de continuar
      if (
        error.status === 403 &&
        error.error?.errors?.codigo === 'CAMBIO_PASSWORD_REQUERIDO'
      ) {
        authService.establecerRequiereCambioPassword(true);

        if (!router.url.startsWith('/cambiar-password')) {
          router.navigate(['/cambiar-password']);
        }
      }

      return throwError(() => error);
    })
  );
};
