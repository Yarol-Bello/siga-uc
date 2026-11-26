import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, timeout } from 'rxjs';
import { SetupService } from '../services/setup.service';

/**
 * Si el sistema aún no tiene administrador, cualquier intento de entrar
 * al login se redirige al asistente /setup.
 */
export const loginSetupGuard: CanActivateFn = () => {
  const setup = inject(SetupService);
  const router = inject(Router);

  return setup.estado().pipe(
    timeout(1500),
    map((respuesta) =>
      respuesta?.data?.requiere_setup && respuesta.data.setup_disponible
        ? router.createUrlTree(['/setup'])
        : true,
    ),
    catchError(() => of(true)),
  );
};

/**
 * /setup solo está disponible mientras la primera configuración esté
 * pendiente. Si ya se completó, vuelve al login.
 */
export const setupGuard: CanActivateFn = () => {
  const setup = inject(SetupService);
  const router = inject(Router);

  return setup.estado().pipe(
    map((respuesta) =>
      respuesta?.data?.requiere_setup
        ? true
        : router.createUrlTree(['/login']),
    ),
    catchError(() => of(true)),
  );
};
