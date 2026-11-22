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
| `cambiar-password` | `CambiarPasswordComponent` | `authGuard` | Auth |
| `admin` | `AdminLayoutComponent` | `authGuard`, `roleGuard(['ADMIN'])` | Admin |
| `admin` (hijo `''`) | `DashboardComponent` | hereda | Admin |
| `admin/alumnos` | `AdminAlumnosComponent` | hereda | Admin |
| `admin/personal` | `AdminPersonalComponent` | hereda | Admin |
| `admin/carga-curricular` | `AdminCargaCurricularComponent` | hereda | Admin |
| `admin/horarios` | `AdminHorariosComponent` | hereda | Admin |
| `admin/asistencia-qr` | `AdminAsistenciaQrComponent` | hereda | Admin |
| `admin/tesoreria` | `AdminTesoreriaComponent` (wrapper) | hereda | Admin |
| `admin/caja` | `AdminCajaComponent` (wrapper) | hereda | Admin |
| `admin/siagie` | `AdminSiagieComponent` | hereda | Admin |
| `admin/reportes` | `AdminReportesComponent` | hereda | Admin |
| `admin/auditoria` | `AdminAuditoriaComponent` | hereda | Admin |
| `docente` | `DocenteLayoutComponent` | `authGuard`, `roleGuard(['DOCENTE'])` | Docente |
| `docente/horario` | `DocenteHorarioComponent` | hereda | Docente |
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
| `secretaria/horarios` | `SecretariaHorariosComponent` | hereda | Secretaría |
| `en-construccion` | `EnConstruccionComponent` | `authGuard` | Simple |
| `**` | redirect `/login` | — | — |

Todas las rutas usan `loadComponent` (lazy loading).

## 3. Guards e interceptor

### `authGuard`
- Llama `authService.isAuthenticated()`.
- Decodifica el payload del JWT con `atob` y compara `exp`.
- Si expiró, limpia sesión y redirige a `/login?returnUrl=...`.
- Si el token está corrupto, devuelve `false` (sin logout explícito).
- Si `requiere_cambio_password` es `TRUE` y la ruta no es `/cambiar-password`, redirige allí.

### `roleGuard(['ROL'])`
- Si no está autenticado → `/login`.
- Si `requiere_cambio_password` es `TRUE` → `/cambiar-password`.
- Si el rol no está permitido → dashboard del rol real:
  - DOCENTE → `/docente`
  - ESTUDIANTE → `/estudiante`
  - SECRETARIA → `/secretaria`
  - otro → `/login`

### `authInterceptor`
- Lee `siga_uc_token`.
- Si existe, clona la petición con `Authorization: Bearer`.
- Si recibe `403` con `errors.codigo = "CAMBIO_PASSWORD_REQUERIDO"`, marca el flag en el usuario
  local y redirige a `/cambiar-password`.
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
| `cambiarPassword(data)` | `PUT /auth/cambiar-password` |
| `requiereCambioPassword()` | Lee el flag del usuario actual |
| `marcarPasswordCambiada()` | Pone el flag en `false` y actualiza `localStorage` |
| `establecerRequiereCambioPassword(valor)` | Actualiza el flag en signal + `localStorage` |
| `getDashboardUrl()` | Devuelve `/admin`, `/secretaria`, `/docente` o `/estudiante` |

`ConfiguracionService`:

| Método / propiedad | Efecto |
|---|---|
| `anioLectivo` | Signal con el año lectivo activo; fallback `new Date().getFullYear()` |
| `cargar()` | `GET /api/configuracion`; se ejecuta en `provideAppInitializer` antes de renderizar las vistas |

> El año lectivo no se define en `environment.ts` ni en componentes: se obtiene del backend al
> iniciar la app. Cambiarlo en 2027 solo requiere actualizar `ANIO_LECTIVO` y reiniciar el API.

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

> Los listados de alumnos y bitácora usan el paginador compartido
> `shared/components/pagination` (inputs `page`, `totalPages`, `total`, `pageSize`; output
> `pageChange`), con botones redondos “Anterior/Siguiente”, texto “Mostrando X–Y de Z” y
> opacidad reducida al llegar a los extremos. Al aplicar filtros o búsqueda se vuelve a la
> página 1.

> El Admin tiene un modal **"Nueva Notificación"** en el dashboard con cinco destinatarios,
> en este orden: TODOS, PERSONAL, ROL, GRADO y ALUMNO.
>
> - **PERSONAL** no envía `id`: el backend resuelve ADMIN + DOCENTE + SECRETARIA activos.
> - **ROL** muestra un select cargado una sola vez desde `GET /api/personal/roles`
>   (excluye ESTUDIANTE) y envía `{ tipo: "ROL", id: id_rol }`. Sin rol seleccionado
>   bloquea con error inline.
> - **ALUMNO** se busca por DNI, nombres o apellidos con autocompletado (`debounce`
>   300 ms, máximo 10 resultados).
> - Al cambiar de tipo se limpia la selección anterior y los mensajes.
> - El resumen real muestra `"N destinatarios, X correos enviados, Y fallidos."`.
>
> El receptor lo ve en la campanita; no hay WebSockets, se actualiza al abrir o por
> polling.

> En **Personal & Usuarios**, el selector de roles (alta, edición y filtro superior)
> solo muestra ADMIN, DOCENTE y SECRETARIA; ESTUDIANTE se filtra al cargar los roles.
> El campo **“Especialidad (solo docentes)”** aparece únicamente cuando el rol es
> DOCENTE y se limpia al cambiar a otro rol. La lista muestra especialidad + cargo para
> docentes y cargo (o nombre del rol) para ADMIN/SECRETARIA, nunca “Sin especialidad”.
> El modal de cese de un no docente muestra rol y cargo, sin “Especialidad: Sin
> especificar”. El carné y el QR no cambian.

### Sidebars

#### ADMIN (`sidebar.component.ts`)
| Ítem | Ruta |
|---|---|
| Resumen Ejecutivo | `/admin` |
| Padrón de Alumnos | `/admin/alumnos` |
| Personal & Usuarios | `/admin/personal` |
| Control Asistencia QR | `/admin/asistencia-qr` |
| Carga Curricular | `/admin/carga-curricular` |
| Horarios | `/admin/horarios` |
| Tesorería y Pensiones | `/admin/tesoreria` |
| Cuadre de Caja | `/admin/caja` |
| Exportación SIAGIE | `/admin/siagie` |
| Reportes y Libretas | `/admin/reportes` |
| Auditoría y Actas | `/admin/auditoria` |

#### DOCENTE
| Ítem | Ruta |
|---|---|
| Mis Cursos y Horarios | `/docente` |
| Mi Horario | `/docente/horario` |
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

> El sidebar del estudiante muestra `info_adicional.nombre_grado` real; ya no usa “3ro de
> Secundaria” fijo (H57).

#### SECRETARIA
| Ítem | Ruta |
|---|---|
| Panel de Tesorería | `/secretaria` |
| Padrón de Alumnos | `/secretaria/padron` |
| Tesorería y Pensiones | `/secretaria/tesoreria` |
| Cuadre de Caja | `/secretaria/caja` |
| Control Asistencia QR | `/secretaria/asistencia-qr` |
| Horarios | `/secretaria/horarios` |

> El sidebar ADMIN declara `roles` en cada ítem, pero no filtra en el template; el acceso real
> lo impone la ruta. Secretaría usa su propio sidebar.

## 6. Matriz componente → endpoints

| Componente | Endpoints consumidos |
|---|---|
| `LoginComponent` | `POST /auth/login`, `POST /auth/recuperar-password` |
| `ResetPasswordComponent` | `GET /auth/validar-token/:token`, `POST /auth/restablecer-password` |
| `CambiarPasswordComponent` | `PUT /auth/cambiar-password` |
| `HeaderComponent` | `GET /notificaciones/no-leidas`, `GET /notificaciones`, `PUT /:id/leer`, `PUT /leer-todas`, `GET /auth/perfil` |
| `DashboardComponent` | `GET /reportes/dashboard`, `GET /grados`, `GET /personal/roles`, `GET /alumnos?search=&limit=10&solo_activos=1`, `POST /notificaciones/masivo` |
| `AdminAlumnosComponent` | `GET /alumnos?page=&pageSize=`, `GET /grados`, `POST /alumnos`, `PUT /alumnos/:id`, `PUT /alumnos/:id/retirar`, `PUT /auth/reset-password` |
| `AdminPersonalComponent` | `GET /personal`, `GET /personal/roles`, `POST /personal`, `PUT /personal/:id`, `PUT /:id/cesar`, `PUT /:id/reactivar`, `PUT /:id/reset-password` |
| `AdminCargaCurricularComponent` | `GET /grados`, `GET /cursos`, `GET /personal?id_rol=2`, `GET /carga-curricular/grado/:id`, `GET /.../tutor`, `POST /carga-curricular`, `PUT /:id`, `DELETE /:id`, `POST /tutor` |
| `AdminAsistenciaQrComponent` | `GET /asistencias/personal/todos`, `/resumen`, `/dni/:dni`, `POST /personal/marcar` |
| `AdminSiagieComponent` | `GET /grados`, `GET /reportes/auditoria-docentes/:id`, `POST /siagie/generar-excel`, `GET /personal/:id`, `POST /notificaciones` |
| `AdminReportesComponent` | `GET /grados`, `GET /alumnos`, `GET /reportes/cuadro-merito/:id`, `/alumnos-riesgo/:id`, `/libreta/:id`, `/libreta/:id/pdf`; selector de bimestre 1-4 también en libretas (H51) |
| `AdminAuditoriaComponent` | `GET /auditoria?page=&pageSize=`, `/actas`, `/modulos`, `/estadisticas`, `POST /actas/cerrar`, `POST /actas/:id/reabrir`, `GET /actas/:id/pdf`; tarjeta de cierre, badge global, modal de reapertura (H48) |
| `DocenteDashboardComponent` | `GET /carga-curricular/docente/:id`; botones Asistencia/Notas navegan con `id_curso` e `id_grado` (H53) |
| `DocenteNotasComponent` | `GET /carga-curricular/docente/:id`, `GET /calificaciones/curso/:id/grado/:id`, `POST /calificaciones/masivo`; preselecciona `id_curso`/`id_grado` por query params (H53) |
| `DocenteAsistenciaComponent` | `GET /carga-curricular/docente/:id`, `GET /asistencias/curso/:id/fecha/:fecha`, `POST /asistencias/masivo`; preselecciona `id_curso`/`id_grado` por query params (H53), usa `parseFechaLocal`/`diaSemanaLocal` y muestra el día en español (H61); bloquea observación sin P/T/F con error inline (H60) |
| `DocenteFichaComponent` | `GET /alumnos/dni/:dni`, `GET /asistencias/alumno/:id?anio=`, `/resumen?anio=`, `GET /calificaciones/notas-finales/alumno/:id?anio=`; el historial muestra el día en español que devuelve el backend (H61) y solo el año lectivo elegido (H56) |
| `DocenteReportesComponent` | `GET /carga-curricular/docente/:id`, `GET /calificaciones/curso/:id/grado/:id`, `GET /notificaciones`, `PUT /notificaciones/:id/leer`, `PUT /leer-todas` |
| `EstudianteDashboardComponent` | `GET /calificaciones/notas-finales/alumno/:id?anio=`, `GET /carga-curricular?id_grado=&anio=`; KPI de cursos desde la carga y mensaje neutral sin notas (H57) |
| `EstudianteAsistenciaComponent` | `GET /asistencias/alumno/:id/resumen?anio=`, `GET /asistencias/alumno/:id?id_curso=&anio=`; muestra el año lectivo activo (H56) |
| `EstudianteHorarioComponent` | `GET /horarios/mi-horario` |
| `AdminHorariosComponent` | `GET/POST/PUT/DELETE /horarios`, `/periodos`, `/generar`, `/publicar`, `/despublicar` |
| `SecretariaHorariosComponent` | `GET /horarios`, `GET /horarios/periodos` |
| `DocenteHorarioComponent` | `GET /horarios/mi-horario` |
| `SecretariaDashboardComponent` | `GET /tesoreria/estadisticas`, `GET /tesoreria/pre-tickets?estado=PENDIENTE` |

> En **Tesorería**, el detalle de un alumno distingue tres estados:
>
> - Sin pensiones y `Matriculado`: muestra “Este alumno no tiene pensiones generadas.” y
>   el botón **Generar pensiones**. Pide confirmación con
>   “Se generarán las pensiones desde el mes de matrícula hasta diciembre.”, muestra
>   spinner y, al terminar, recarga el padrón y los estados.
> - Sin pensiones y no matriculado: indica que primero debe pagar la matrícula; no
>   muestra el botón de generación.
> - Con pensiones: si todas están pagadas muestra “El alumno está al día.”; si hay
>   pendientes mantiene el flujo de cobro actual.
>
> Los errores de generación se muestran inline dentro del modal.
>
> Con el alumno **Retirado**, el estado general muestra “Retirado” antes de evaluar
> deudas. Las pensiones `ANULADO` se pintan en gris con `×` (“Anulada”), no cuentan como
> pendientes y no aparecen en el selector de cobro (solo se ofrecen `PENDIENTE`). El
> modal de retiro de Admin → Alumnos avisa que se anularán las pensiones y pre-tickets
> pendientes de meses posteriores al retiro, manteniendo la pensión del mes de retiro.
| `SecretariaTesoreriaComponent` | `GET /alumnos`, `GET /tesoreria/pensiones/alumno/:id` (N+1), `GET /tesoreria/pre-tickets`, `POST /tesoreria/pagos`, `POST /tesoreria/pensiones/alumno/:id/generar` |
| `SecretariaCajaComponent` | `GET /caja/actual`, `GET /caja/movimientos/:id`, `POST /caja/aperturar`, `POST /caja/egresos`, `POST /caja/cerrar`, `GET /tesoreria/boletas/:id/pdf` |

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
- **Impresión:** el carné usa `window.print()`; libretas, boletas y actas se descargan como PDF
  real desde el backend (PDFKit) y muestran error inline si fallan.
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
- El año lectivo sí es runtime: `ConfiguracionService` lo obtiene de `GET /api/configuracion`.

## 11. Deuda y mejoras de frontend

1. Extraer servicios por feature (hoy `HttpClient` directo en componentes).
2. Centralizar manejo de errores/401 y refresh de sesión.
3. Reemplazar `alert/confirm` por componentes accesibles.
4. ~~Implementar pantalla de cambio de contraseña obligatorio.~~ ✅ (H18)
5. ~~Añadir paginación real (hoy listas completas).~~ ✅ Parcial (H23): alumnos y bitácora; falta personal, pagos y pre-tickets.
6. Evitar N+1 en tesorería (cargar pensiones en un endpoint agregado).
7. ~~Parametrizar año lectivo y conceptos (hoy hardcodeados).~~ ✅ (H12: `ANIO_LECTIVO` + `GET /api/configuracion`).
8. ~~Añadir “Cerrar acta” con bloqueo real.~~ ✅ (H48: tarjeta de cierre, reapertura, acta global y bloqueo). Nota final automática desde H04.
9. Mejorar responsive del sidebar.
10. Cambiar el título de `index.html` a “SIGA-UC”.
