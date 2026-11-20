import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard de autenticación
 * Verifica que el usuario esté logueado antes de acceder a una ruta protegida
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificar si el usuario está autenticado
  if (!authService.isAuthenticated()) {
    // Redirigir al login con la URL de retorno
    console.warn('🔒 Acceso denegado: usuario no autenticado. Redirigiendo a /login...');
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Si tiene una contraseña temporal, solo puede acceder al cambio de contraseña
  const rutaDestino = state.url.split('?')[0];
  if (
    authService.requiereCambioPassword() &&
    !rutaDestino.startsWith('/cambiar-password')
  ) {
    console.warn('🔐 Cambio de contraseña obligatorio. Redirigiendo a /cambiar-password...');
    router.navigate(['/cambiar-password']);
    return false;
  }

  return true;
};
