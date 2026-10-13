import { Routes } from '@angular/router';

/**
 * Rutas principales de SIGA-UC
 * Sistema Integrado de Gestión Académica
 */
export const routes: Routes = [
  // Ruta por defecto: redirige al login
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },

  // Ruta del Login (pública)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  // Rutas por rol (se implementarán después)
  // { path: 'admin', loadChildren: ... },
  // { path: 'docente', loadChildren: ... },
  // { path: 'estudiante', loadChildren: ... },
  // { path: 'secretaria', loadChildren: ... },

  // Ruta comodín: si no coincide con nada, redirige al login
  {
    path: '**',
    redirectTo: 'login',
  },
];
