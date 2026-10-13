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
      {
        path: 'alumnos',
        loadComponent: () =>
          import('./features/admin/alumnos/admin-alumnos.component').then(
            (m) => m.AdminAlumnosComponent,
          ),
      },

      {
        path: 'reportes',
        loadComponent: () =>
          import('./features/admin/reportes/admin-reportes.component').then(
            (m) => m.AdminReportesComponent,
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
      {
        path: 'notas',
        loadComponent: () =>
          import('./features/docente/notas/docente-notas.component').then(
            (m) => m.DocenteNotasComponent,
          ),
      },
      {
        path: 'asistencia',
        loadComponent: () =>
          import('./features/docente/asistencia/docente-asistencia.component').then(
            (m) => m.DocenteAsistenciaComponent,
          ),
      },
      {
        path: 'ficha-estudiante',
        loadComponent: () =>
          import('./features/docente/ficha-estudiante/docente-ficha.component').then(
            (m) => m.DocenteFichaComponent,
          ),
      },

      {
        path: 'reportes',
        loadComponent: () =>
          import('./features/docente/reportes/docente-reportes.component').then(
            (m) => m.DocenteReportesComponent,
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

  // SECRETARÍA (SIN la ruta de alumnos)
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

      {
        path: 'tesoreria',
        loadComponent: () =>
          import('./features/secretaria/tesoreria/secretaria-tesoreria.component').then(
            (m) => m.SecretariaTesoreriaComponent,
          ),
      },

      {
        path: 'caja',
        loadComponent: () =>
          import('./features/secretaria/caja/secretaria-caja.component').then(
            (m) => m.SecretariaCajaComponent,
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

  { path: '**', redirectTo: 'login' },
];
