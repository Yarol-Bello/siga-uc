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

      {
        path: 'personal',
        loadComponent: () =>
          import('./features/admin/personal/admin-personal.component').then(
            (m) => m.AdminPersonalComponent,
          ),
      },

      {
        path: 'carga-curricular',
        loadComponent: () =>
          import('./features/admin/carga-curricular/admin-carga-curricular.component').then(
            (m) => m.AdminCargaCurricularComponent,
          ),
      },
      {
        path: 'asistencia-qr',
        loadComponent: () =>
          import('./features/admin/asistencia-qr/admin-asistencia-qr.component').then(
            (m) => m.AdminAsistenciaQrComponent,
          ),
      },

      {
        path: 'siagie',
        loadComponent: () =>
          import('./features/admin/siagie/admin-siagie.component').then(
            (m) => m.AdminSiagieComponent,
          ),
      },
      {
        path: 'auditoria',
        loadComponent: () =>
          import('./features/admin/auditoria/admin-auditoria.component').then(
            (m) => m.AdminAuditoriaComponent,
          ),
      },
      {
        path: 'tesoreria',
        loadComponent: () =>
          import('./features/admin/tesoreria/admin-tesoreria.component').then(
            (m) => m.AdminTesoreriaComponent,
          ),
      },
      {
        path: 'caja',
        loadComponent: () =>
          import('./features/admin/caja/admin-caja.component').then((m) => m.AdminCajaComponent),
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

      {
        path: 'asistencia',
        loadComponent: () =>
          import('./features/estudiante/asistencia/estudiante-asistencia.component').then(
            (m) => m.EstudianteAsistenciaComponent,
          ),
      },
      {
        path: 'horario',
        loadComponent: () =>
          import('./features/estudiante/horario/estudiante-horario.component').then(
            (m) => m.EstudianteHorarioComponent,
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
      {
        path: 'asistencia-qr',
        loadComponent: () =>
          import('./features/secretaria/asistencia-qr/secretaria-asistencia-qr.component').then(
            (m) => m.SecretariaAsistenciaQrComponent,
          ),
      },
      // 👇 AGREGAR ESTA LÍNEA
      {
        path: 'padron',
        loadComponent: () =>
          import('./features/secretaria/padron/secretaria-padron.component').then(
            (m) => m.SecretariaPadronComponent,
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
