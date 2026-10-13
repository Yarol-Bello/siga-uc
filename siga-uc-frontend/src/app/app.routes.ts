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

  // Rutas del Administrador (con layout)
  {
    path: 'admin',
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
      // Aquí agregaremos más rutas del admin después:
      // { path: 'alumnos', loadComponent: () => ... },
      // { path: 'personal', loadComponent: () => ... },
      // etc.
    ],
  },

  // Ruta comodín
  {
    path: '**',
    redirectTo: 'login',
  },
];
