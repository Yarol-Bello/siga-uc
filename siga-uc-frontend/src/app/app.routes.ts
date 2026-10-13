import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  // ADMIN
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
    ],
  },

  // DOCENTE
  {
    path: 'docente',
    canActivate: [authGuard, roleGuard(['DOCENTE'])],
    loadComponent: () =>
      import('./features/docente/layout/docente-layout.component').then(
        (m) => m.DocenteLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/docente/dashboard/docente-dashboard.component').then(
            (m) => m.DocenteDashboardComponent,
          ),
      },
    ],
  },

  // ESTUDIANTE
  {
    path: 'estudiante',
    canActivate: [authGuard, roleGuard(['ESTUDIANTE'])],
    loadComponent: () =>
      import('./features/estudiante/layout/estudiante-layout.component').then(
        (m) => m.EstudianteLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/estudiante/dashboard/estudiante-dashboard.component').then(
            (m) => m.EstudianteDashboardComponent,
          ),
      },
    ],
  },

  // EN CONSTRUCCIÓN
  {
    path: 'en-construccion',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/en-construccion/en-construccion.component').then(
        (m) => m.EnConstruccionComponent,
      ),
  },

  // SECRETARÍA
  {
    path: 'secretaria',
    canActivate: [authGuard, roleGuard(['SECRETARIA'])],
    loadComponent: () =>
      import('./features/secretaria/layout/secretaria-layout.component').then(
        (m) => m.SecretariaLayoutComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/secretaria/dashboard/secretaria-dashboard.component').then(
            (m) => m.SecretariaDashboardComponent,
          ),
      },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
