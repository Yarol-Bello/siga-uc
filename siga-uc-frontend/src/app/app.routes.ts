import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

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

  // Rutas del Administrador (protegidas + rol ADMIN)
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['ADMIN'])],
    loadComponent: () =>
      import('./features/admin/layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      // Próximamente:
      // { path: 'alumnos', loadComponent: () => ... },
      // { path: 'personal', loadComponent: () => ... },
    ],
  },

  // Ruta temporal para roles sin dashboard
  {
    path: 'en-construccion',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/en-construccion/en-construccion.component').then(
        (m) => m.EnConstruccionComponent,
      ),
  },

  // Ruta comodín
  {
    path: '**',
    redirectTo: 'login',
  },
];
