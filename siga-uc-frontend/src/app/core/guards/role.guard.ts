import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard de roles
 * Verifica que el usuario tenga uno de los roles permitidos
 * Uso: { path: 'admin', canActivate: [authGuard, roleGuard(['ADMIN'])] }
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
export const roleGuard = (rolesPermitidos: string[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Si no está autenticado, redirigir al login
    if (!authService.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }

    // Verificar si el usuario tiene uno de los roles permitidos
    if (authService.tieneRol(rolesPermitidos)) {
      return true;
    }

    // Si no tiene el rol, redirigir al dashboard de su rol
    const usuario = authService.getUsuarioActual();
    console.warn(`🚫 Acceso denegado: rol ${usuario?.rol} no autorizado para ${state.url}`);

    // Redirigir al dashboard correspondiente a su rol
    switch (usuario?.rol) {
      case 'DOCENTE':
        router.navigate(['/docente']);
        break;
      case 'ESTUDIANTE':
        router.navigate(['/estudiante']);
        break;
      case 'SECRETARIA':
        router.navigate(['/secretaria']);
        break;
      default:
        router.navigate(['/login']);
    }
    return false;
  };
};
