# 09 — Frontend: UI, Rutas y Navegación

**Framework:** Angular 21.2 standalone · **UI:** Bootstrap 5.3 + FontAwesome 7 · **QR:** `qrcode`
**Estado:** signals · **HTTP:** `HttpClient` + interceptor JWT

---

## 1. Arranque de la SPA

```text
index.html
  <app-root>
    App
      <router-outlet>
        /login o layout del rol
```

- `main.ts` importa `zone.js` primero y hace `bootstrapApplication(App, appConfig)`.
- `app.config.ts` registra router, HttpClient y el interceptor.
- `app.html` solo contiene `<router-outlet>`.
- `index.html` conserva el título `SigaUcFrontend` (pendiente de personalizar).

## 2. Rutas

| Ruta | Componente | Guard | Layout |
|---|---|---|---|
| `''` | redirect `/login` | — | — |
| `login` | `LoginComponent` | — | Auth |
| `reset-password` | `ResetPasswordComponent` | — | Auth |
| `admin` | `AdminLayoutComponent` | `authGuard`, `roleGuard(['ADMIN'])` | Admin |
| `admin` (hijo `''`) | `DashboardComponent` | hereda | Admin |
| `admin/alumnos` | `AdminAlumnosComponent` | hereda | Admin |
| `admin/personal` | `AdminPersonalComponent` | hereda | Admin |
| `admin/carga-curricular` | `AdminCargaCurricularComponent` | hereda | Admin |
| `admin/asistencia-qr` | `AdminAsistenciaQrComponent` | hereda | Admin |
| `admin/tesoreria` | `AdminTesoreriaComponent` (wrapper) | hereda | Admin |
| `admin/caja` | `AdminCajaComponent` (wrapper) | hereda | Admin |
| `admin/siagie` | `AdminSiagieComponent` | hereda | Admin |
| `admin/reportes` | `AdminReportesComponent` | hereda | Admin |
| `admin/auditoria` | `AdminAuditoriaComponent` | hereda | Admin |
| `docente` | `DocenteLayoutComponent` | `authGuard`, `roleGuard(['DOCENTE'])` | Docente |
| `docente/notas` | `DocenteNotasComponent` | hereda | Docente |
| `docente/asistencia` | `DocenteAsistenciaComponent` | hereda | Docente |
| `docente/ficha-estudiante` | `DocenteFichaComponent` | hereda | Docente |
| `docente/reportes` | `DocenteReportesComponent` | hereda | Docente |
| `estudiante` | `EstudianteLayoutComponent` | `authGuard`, `roleGuard(['ESTUDIANTE'])` | Estudiante |
| `estudiante/asistencia` | `EstudianteAsistenciaComponent` | hereda | Estudiante |
| `estudiante/horario` | `EstudianteHorarioComponent` | hereda | Estudiante |
| `secretaria` | `SecretariaLayoutComponent` | `authGuard`, `roleGuard(['SECRETARIA'])` | Secretaría |
| `secretaria/padron` | `SecretariaPadronComponent` (wrapper) | hereda | Secretaría |
| `secretaria/tesoreria` | `SecretariaTesoreriaComponent` | hereda | Secretaría |
| `secretaria/caja` | `SecretariaCajaComponent` | hereda | Secretaría |
| `secretaria/asistencia-qr` | `SecretariaAsistenciaQrComponent` (wrapper) | hereda | Secretaría |
| `en-construccion` | `EnConstruccionComponent` | `authGuard` | Simple |
| `**` | redirect `/login` | — | — |

Todas las rutas usan `loadComponent` (lazy loading).

## 3. Guards e interceptor

### `authGuard`
- Llama `authService.isAuthenticated()`.
- Decodifica el payload del JWT con `atob` y compara `exp`.
- Si expiró, limpia sesión y redirige a `/login?returnUrl=...`.
- Si el token está corrupto, devuelve `false` (sin logout explícito).

### `roleGuard(['ROL'])`
- Si no está autenticado → `/login`.
- Si el rol no está permitido → dashboard del rol real:
  - DOCENTE → `/docente`
  - ESTUDIANTE → `/estudiante`
  - SECRETARIA → `/secretaria`
  - otro → `/login`

### `authInterceptor`
- Lee `siga_uc_token`.
- Si existe, clona la petición con `Authorization: Bearer`.
- No maneja 401 globalmente; cada componente muestra su error.

## 4. Sesión y modelos

`AuthService`:

| Método | Efecto |
|---|---|
| `login(credentials)` | `POST /auth/login`; guarda token y usuario |
| `logout()` | Borra `localStorage`, signal a `null`, navega a `/login` |
| `getToken()` | Lee token |
| `isAuthenticated()` | Token + expiración |
| `getUsuarioActual()` | Signal actual |
| `tieneRol(roles)` | Compara rol |
| `getPerfil()` | `GET /auth/perfil` |

`Usuario`:

```ts
{
  id_usuario, dni, nombres, apellidos, nombre_completo,
  correo_institucional, telefono?, rol, id_rol,
  requiere_cambio_password, info_adicional?
}
```

`info_adicional`:
- ESTUDIANTE: `{ id_alumno, codigo_estudiante, id_grado, nombre_grado, seccion, estado_matricula }`.
- DOCENTE/SECRETARIA: `{ id_personal, especialidad, cargo, fecha_ingreso }`.

## 5. Layouts

Cada layout contiene:

```html
<app-sidebar-...></app-sidebar-...>
<div class="main">
  <app-header titulo="..." subtitulo="..."></app-header>
  <router-outlet></router-outlet>
</div>
```

### Header

| Elemento | Comportamiento |
|---|---|
| Título/subtítulo | `@Input` desde el layout |
| Campanita | Badge `noLeidas`; polling 30 s |
| Buzón | Modal con lista, detalle y “marcar todas” |
| Carné | Modal con QR generado desde `codigo_qr`; botón imprimir |
| Usuario | Iniciales y nombre |
| Logout | Confirmación + `authService.logout()` |

### Sidebars

#### ADMIN (`sidebar.component.ts`)
| Ítem | Ruta |
|---|---|
| Resumen Ejecutivo | `/admin` |
| Padrón de Alumnos | `/admin/alumnos` |
| Personal & Usuarios | `/admin/personal` |
| Control Asistencia QR | `/admin/asistencia-qr` |
| Carga Curricular | `/admin/carga-curricular` |
| Tesorería y Pensiones | `/admin/tesoreria` |
| Cuadre de Caja | `/admin/caja` |
| Exportación SIAGIE | `/admin/siagie` |
| Reportes y Libretas | `/admin/reportes` |
| Auditoría y Actas | `/admin/auditoria` |

#### DOCENTE
| Ítem | Ruta |
|---|---|
| Mis Cursos y Horarios | `/docente` |
| Control de Asistencia | `/docente/asistencia` |
| Registro de Notas | `/docente/notas` |
| Ficha del Estudiante | `/docente/ficha-estudiante` |
| Reportes de Aula | `/docente/reportes` |

#### ESTUDIANTE
| Ítem | Ruta |
|---|---|
| Mis Cursos y Notas | `/estudiante` |
| Mi Asistencia | `/estudiante/asistencia` |
| Horario de Clases | `/estudiante/horario` |

#### SECRETARIA
| Ítem | Ruta |
|---|---|
| Panel de Tesorería | `/secretaria` |
| Padrón de Alumnos | `/secretaria/padron` |
| Tesorería y Pensiones | `/secretaria/tesoreria` |
| Cuadre de Caja | `/secretaria/caja` |
| Control Asistencia QR | `/secretaria/asistencia-qr` |

> El sidebar ADMIN declara `roles` en cada ítem, pero no filtra en el template; el acceso real
> lo impone la ruta. Secretaría usa su propio sidebar.

## 6. Matriz componente → endpoints

| Componente | Endpoints consumidos |
|---|---|
| `LoginComponent` | `POST /auth/login`, `POST /auth/recuperar-password` |
| `ResetPasswordComponent` | `GET /auth/validar-token/:token`, `POST /auth/restablecer-password` |
| `HeaderComponent` | `GET /notificaciones/no-leidas`, `GET /notificaciones`, `PUT /:id/leer`, `PUT /leer-todas`, `GET /auth/perfil` |
| `DashboardComponent` | `GET /reportes/dashboard` |
| `AdminAlumnosComponent` | `GET /alumnos`, `GET /grados`, `POST /alumnos`, `PUT /alumnos/:id`, `PUT /alumnos/:id/retirar`, `PUT /auth/reset-password` |
| `AdminPersonalComponent` | `GET /personal`, `GET /personal/roles`, `POST /personal`, `PUT /personal/:id`, `PUT /:id/cesar`, `PUT /:id/reactivar`, `PUT /:id/reset-password` |
| `AdminCargaCurricularComponent` | `GET /grados`, `GET /cursos`, `GET /personal?id_rol=2`, `GET /carga-curricular/grado/:id`, `GET /.../tutor`, `POST /carga-curricular`, `PUT /:id`, `DELETE /:id`, `POST /tutor` |
| `AdminAsistenciaQrComponent` | `GET /asistencias/personal/todos`, `/resumen`, `/dni/:dni`, `POST /personal/marcar` |
| `AdminSiagieComponent` | `GET /grados`, `GET /reportes/auditoria-docentes/:id`, `POST /siagie/generar-excel`, `GET /personal/:id`, `POST /notificaciones` |
| `AdminReportesComponent` | `GET /grados`, `GET /alumnos`, `GET /reportes/cuadro-merito/:id`, `/alumnos-riesgo/:id`, `/libreta/:id` |
| `AdminAuditoriaComponent` | `GET /auditoria`, `/actas`, `/modulos`, `/estadisticas`, `POST /actas/cerrar` |
| `DocenteDashboardComponent` | `GET /carga-curricular/docente/:id` |
| `DocenteNotasComponent` | `GET /carga-curricular/docente/:id`, `GET /calificaciones/curso/:id/grado/:id`, `POST /calificaciones/masivo` |
| `DocenteAsistenciaComponent` | `GET /carga-curricular/docente/:id`, `GET /asistencias/curso/:id/fecha/:fecha`, `POST /asistencias/masivo` |
| `DocenteFichaComponent` | `GET /alumnos/dni/:dni`, `GET /asistencias/alumno/:id`, `/resumen`, `GET /calificaciones/notas-finales/alumno/:id` |
| `DocenteReportesComponent` | `GET /carga-curricular/docente/:id`, `GET /calificaciones/curso/:id/grado/:id`, `GET /notificaciones`, `PUT /notificaciones/:id/leer`, `PUT /leer-todas` |
| `EstudianteDashboardComponent` | `GET /calificaciones/notas-finales/alumno/:id` |
| `EstudianteAsistenciaComponent` | `GET /asistencias/alumno/:id/resumen`, `GET /asistencias/alumno/:id?id_curso=` |
| `EstudianteHorarioComponent` | `GET /horarios/grado/:id` |
| `SecretariaDashboardComponent` | `GET /tesoreria/estadisticas`, `GET /tesoreria/pre-tickets?estado=PENDIENTE` |
| `SecretariaTesoreriaComponent` | `GET /alumnos`, `GET /tesoreria/pensiones/alumno/:id` (N+1), `GET /tesoreria/pre-tickets`, `POST /tesoreria/pagos` |
| `SecretariaCajaComponent` | `GET /caja/actual`, `GET /caja/movimientos/:id`, `POST /caja/aperturar`, `POST /caja/egresos`, `POST /caja/cerrar` |

## 7. Patrones de implementación

### 7.1 Modal

```html
@if (modalAbierto()) {
  <div class="modal-overlay" (click)="cerrarModal()">
    <div class="modal-content" (click)="$event.stopPropagation()">
      ...
    </div>
  </div>
}
```

Reglas:
- Nunca renderizar el modal sin `@if`.
- Siempre `stopPropagation()` en el contenido.
- Cerrar al hacer clic fuera (excepto si hay proceso en curso).

### 7.2 Loading y errores

```ts
this.guardando.set(true);
this.http.post(...).subscribe({
  next: (res) => { this.guardando.set(false); ... },
  error: (err) => {
    this.guardando.set(false);  // primero
    this.error.set(err.error?.message || 'Error');
  },
});
```

### 7.3 Números

PostgreSQL devuelve `numeric`, `COUNT(*)`, `SUM()` como string. El frontend debe:

```ts
const total = Number(data.total) || 0;
```

Aparece en dashboard, caja, reportes, SIAGIE y estadísticas.

### 7.4 Señales

- `signal(valor)` para estado local.
- `signal<T | null>(null)` para selecciones.
- `set()` para reemplazar, `update()` para derivar.
- No se usa NgRx ni store global; el estado se comparte por servicios root (`AuthService`,
  `NotificacionService`).

### 7.5 Wrappers

```ts
@Component({
  selector: 'app-admin-caja',
  standalone: true,
  imports: [SecretariaCajaComponent],
  template: `<app-secretaria-caja></app-secretaria-caja>`,
})
export class AdminCajaComponent {}
```

Ventaja: una sola implementación. Riesgo: el componente interno asume endpoints y permisos
del rol original; el backend debe permitir ambos roles.

## 8. Experiencia de usuario

- **Login:** formulario centrado, identidad guindo/dorado, mostrar/ocultar contraseña,
  modal de recuperación.
- **Dashboard Admin:** tarjetas KPI, sin gráficos.
- **Tablas:** badges por estado, acciones a la derecha, sticky en tablas anchas.
- **Formularios:** validación local + mensajes inline; muchos usan `alert()`/`confirm()`.
- **Impresión:** libreta y carné usan `window.print()`.
- **Responsive:** Bootstrap; se intentó un sidebar drawer y se revirtió
  (`Revert "feat(frontend): sidebar responsive..."`). En móvil la navegación puede ser
  incómoda.
- **Accesibilidad:** no se declaran `aria-label`/roles en la mayoría de controles.

## 9. Estilos

- `styles.scss` global + SCSS por componente.
- Paleta: guindo `#800020`, dorado `#D4AF37`, naranja `#B45309`, fondos `#F8FAFC` /
  `#fffbeb`.
- Bootstrap se usa para grid, botones, tablas y modales base; los modales son propios.
- Los estilos de cada feature pueden ser extensos; `angular.json` elevó los budgets por eso.

## 10. Build y entornos

| Entorno | Archivo | `apiUrl` |
|---|---|---|
| Desarrollo | `environment.ts` | `http://localhost:3000/api` |
| Producción | `environment.prod.ts` | `https://siga-uc-api.onrender.com/api` |

- `npm run build` compila y ejecuta `postbuild`, que copia `index.html` a `404.html` para
  fallback SPA en Render.
- `fileReplacements` en `angular.json` cambia el environment en producción.
- No hay variables de entorno inyectadas en runtime; cambiar la URL exige rebuild.

## 11. Deuda y mejoras de frontend

1. Extraer servicios por feature (hoy `HttpClient` directo en componentes).
2. Centralizar manejo de errores/401 y refresh de sesión.
3. Reemplazar `alert/confirm` por componentes accesibles.
4. Implementar pantalla de cambio de contraseña obligatorio.
5. Añadir paginación real (hoy listas completas).
6. Evitar N+1 en tesorería (cargar pensiones en un endpoint agregado).
7. Parametrizar año lectivo y conceptos (hoy hardcodeados).
8. Añadir botón “Calcular notas finales” y “Cerrar acta” con bloqueo real.
9. Mejorar responsive del sidebar.
10. Cambiar el título de `index.html` a “SIGA-UC”.
