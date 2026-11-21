# 03 — Estructura y Mapa de Clases

> Conteo verificado el 21/11/2026: **72 archivos JS backend**, **118 archivos frontend
> (49 TypeScript)**, **14 routers**, **14 controladores**, **19 servicios** y **15 DAOs**.

## 1. Backend

### 1.1 Punto de entrada y configuración

| Archivo | Responsabilidad |
|---|---|
| `src/app.js` | Crea Express, registra middlewares globales, 14 routers, health check, 404 y error handler; arranca en `0.0.0.0:PORT`; prueba BD y correo |
| `src/config/env.js` | Carga `.env`, valida `DB_*`, `JWT_SECRET` y `ANIO_LECTIVO`, exporta configuración centralizada |
| `src/config/academico.js` | Expone `getAnioLectivo()` desde `ANIO_LECTIVO` |
| `src/config/database.js` | Pool `pg` (`max=20`), helper `query`, `getClient` transaccional, `testConnection` |
| `src/middlewares/authMiddleware.js` | `verificarAutenticacion` (Bearer/JWT, estado y bloqueo por cambio de contraseña) y `verificarRol(...roles)` |
| `src/utils/response.js` | `success`, `error`, `validationError`, `unauthorized`, `forbidden`, `notFound` |

### 1.2 Routers (14)

| Router | Prefijo | Endpoints | Rol de escritura |
|---|---|---|---|
| `authRoutes.js` | `/api/auth` | 9 | ADMIN para reset por DNI |
| `configuracionRoutes.js` | `/api/configuracion` | 1 | Público (solo lectura) |
| `academicoRoutes.js` | `/api` | 7 | Solo lectura |
| `alumnoRoutes.js` | `/api/alumnos` | 6 | ADMIN/SECRETARIA |
| `personalRoutes.js` | `/api/personal` | 8 | ADMIN |
| `cargaCurricularRoutes.js` | `/api/carga-curricular` | 9 | ADMIN |
| `asistenciaRoutes.js` | `/api/asistencias` | 9 | ADMIN/DOCENTE o ADMIN/SECRETARIA |
| `calificacionRoutes.js` | `/api/calificaciones` | 6 | ADMIN/DOCENTE |
| `tesoreriaRoutes.js` | `/api/tesoreria` | 13 | ADMIN/SECRETARIA; becas ADMIN |
| `cajaRoutes.js` | `/api/caja` | 9 | ADMIN/SECRETARIA |
| `reporteRoutes.js` | `/api/reportes` | 7 | Solo lectura con roles |
| `auditoriaRoutes.js` | `/api/auditoria` | 7 | Cierre de acta: ADMIN; PDF de acta: ADMIN/DOCENTE |
| `siagieRoutes.js` | `/api/siagie` | 1 | ADMIN |
| `notificacionRoutes.js` | `/api/notificaciones` | 8 | ADMIN/DOCENTE; masivo ADMIN |

### 1.3 Controladores (14)

| Controlador | Métodos | Notas |
|---|---|---|
| `authController.js` | `login`, `perfil`, `verify`, `logout`, `resetPassword`, `solicitarRecuperacion`, `validarToken`, `restablecerPassword`, `cambiarPassword` | `validationResult` en login y cambio de contraseña; recuperación delega a `recuperacionService` |
| `configuracionController.js` | `obtener` | Devuelve el año lectivo activo |
| `academicoController.js` | `listarGrados`, `obtenerGrado`, `listarCursos`, `obtenerCurso`, `listarCompetencias`, `listarEscalaCalificacion`, `listarHorariosPorGrado` | Solo lectura |
| `alumnoController.js` | `listar`, `obtener`, `buscarPorDni`, `crear`, `actualizar`, `retirar` | Filtros por `id_grado`, estado, búsqueda y año |
| `personalController.js` | `listar`, `obtener`, `listarRoles`, `crear`, `actualizar`, `cesar`, `reactivar`, `resetPassword` | Roles excluyen ESTUDIANTE |
| `cargaCurricularController.js` | `listar`, `obtener`, `listarPorGrado`, `listarPorDocente`, `crear`, `actualizar`, `eliminar`, `asignarTutor`, `getTutor` | `listarPorDocente` usa el año lectivo configurado |
| `asistenciaController.js` | `obtenerPorCursoFecha`, `obtenerPorAlumno`, `obtenerResumenPorAlumno`, `registrar`, `registrarMasivo`, `listarAsistenciaPersonal`, `buscarPersonalPorDni`, `registrarAsistenciaPersonal`, `obtenerResumenAsistenciaPersonal` | Personal y alumnos separados |
| `calificacionController.js` | `obtenerPorAlumnoCurso`, `obtenerPorCursoGrado`, `registrar`, `registrarMasivo`, `calcularNotaFinal`, `obtenerNotasFinales` | `calcularNotaFinal` expone el cálculo |
| `tesoreriaController.js` | `listarConceptos`, `listarPreTickets`, `obtenerPreTicket`, `crearPreTicket`, `listarPagos`, `obtenerPago`, `getBoletaPdf`, `registrarPago`, `listarPensionesAlumno`, `generarPensionesMes`, `listarBecas`, `aplicarBeca`, `getEstadisticas` | Inyecta `id_usuario` del token; PDF de boleta |
| `cajaController.js` | `obtenerCajaAbierta`, `listarCajas`, `listarAperturas`, `obtenerApertura`, `aperturar`, `listarMovimientos`, `registrarEgreso`, `cerrar`, `listarCierres` | Inyecta usuario de apertura/egreso/cierre |
| `reporteController.js` | `getDashboard`, `getAlumnosRiesgo`, `getCuadroMerito`, `getLibreta`, `getLibretaPdf`, `getResumenAsistencia`, `getAuditoriaDocentes` | KPIs, reportes y PDF de libreta |
| `auditoriaController.js` | `listarBitacora`, `obtenerBitacora`, `listarModulos`, `listarActas`, `getActaPdf`, `cerrarActa`, `getEstadisticas` | Inyecta `cerrado_por`; PDF de acta |
| `siagieController.js` | `generarExcel` | Valida archivo/parámetros, borra temporal y descarga |
| `notificacionController.js` | `listar`, `obtener`, `contarNoLeidas`, `crear`, `crearMasivo`, `marcarLeida`, `marcarTodasLeidas`, `eliminar` | Siempre limita al usuario autenticado |

### 1.4 Servicios (19)

| Servicio | Métodos principales | Reglas que concentra |
|---|---|---|
| `authService.js` | `login`, `verificarToken`, `getPerfil`, `resetPassword`, `cambiarPassword` | Usuario activo, bcrypt, JWT, info adicional por rol, QR en perfil, cambio de contraseña con verificación de la actual |
| `configuracionService.js` | `obtenerConfiguracion` | Año lectivo activo desde `ANIO_LECTIVO` |
| `academicoService.js` | `listarGrados`, `obtenerGrado`, `listarCursos`, `obtenerCurso`, `listarCompetencias`, `listarEscalaCalificacion`, `listarHorariosPorGrado` | 404 si no existe; agrega tutor/competencias |
| `alumnoService.js` | `listar`, `obtener`, `buscarPorDni`, `crear`, `actualizar`, `retirar` | DNI único, campos obligatorios, no retirar dos veces |
| `personalService.js` | `listar`, `obtener`, `listarRoles`, `crear`, `actualizar`, `cesar`, `reactivar`, `resetPassword` | DNI de 8, cese con motivo, no cesar dos veces |
| `cargaCurricularService.js` | `listar`, `obtener`, `listarPorGrado`, `listarPorDocente`, `getTutor`, `crear`, `actualizar`, `eliminar`, `asignarTutor` | Campos obligatorios y 404 |
| `asistenciaService.js` | `obtenerPorCursoFecha`, `obtenerPorAlumno`, `obtenerResumenPorAlumno`, `registrar`, `registrarMasivo`, `listarAsistenciaPersonal`, `buscarPersonalPorDni`, `registrarAsistenciaPersonal`, `obtenerResumenAsistenciaPersonal` | Estados `P/T/F`, personal activo |
| `calificacionService.js` | `obtenerPorAlumnoCurso`, `obtenerPorCursoGrado`, `registrar`, `registrarMasivo`, `calcularYGuardarNotaFinal`, `obtenerNotasFinales` | `AD/A/B/C`, bimestre 1–4, agrupa notas/conclusiones |
| `tesoreriaService.js` | `listarConceptos`, `listarPreTickets`, `obtenerPreTicket`, `crearPreTicket`, `listarPagos`, `obtenerPago`, `registrarPago`, `listarPensionesAlumno`, `generarPensionesMes`, `listarBecas`, `aplicarBeca`, `getEstadisticas` | Alumno/concepto existen, mes 1–12, tipo de concepto |
| `cajaService.js` | `obtenerCajaAbierta`, `listarCajas`, `listarAperturas`, `obtenerApertura`, `aperturar`, `listarMovimientos`, `registrarEgreso`, `cerrar`, `listarCierres` | Montos no negativos, caja abierta |
| `reporteService.js` | `getDashboard`, `getAlumnosRiesgo`, `getCuadroMerito`, `getLibreta`, `getResumenAsistencia`, `getAuditoriaDocentes` | Parámetros obligatorios |
| `libretaPdfService.js` | `generarLibretaPdf` | PDFKit, Helvetica, A4, tabla paginada y pie de página |
| `boletaPdfService.js` | `generarBoletaPdf` | PDFKit, comprobante de pago y datos SUNAT/hash |
| `actaPdfService.js` | `generarActaPdf` | PDFKit, acta landscape, matriz real, watermark para borrador |
| `auditoriaService.js` | `listarBitacora`, `obtenerBitacora`, `listarModulos`, `listarActas`, `cerrarActa`, `getEstadisticas` | Periodo/año/Usuario de cierre |
| `siagieService.js` | `generarExcel` | Detecta encabezados, inyecta notas, guarda archivo, audita exportación |
| `notificacionService.js` | `listar`, `obtener`, `contarNoLeidas`, `crear`, `crearMasivo`, `marcarLeida`, `marcarTodasLeidas`, `eliminar` | Correo no bloqueante, propiedad del destinatario |
| `recuperacionService.js` | `solicitarRecuperacion`, `validarToken`, `restablecerPassword` | Token 32 bytes, 2 h, un uso, no revelar existencia |
| `emailService.js` | `verificarConexion`, `enviarCorreo`, `enviarNotificacion` | Resend; plantilla guindo/dorado |

### 1.5 DAOs (15)

| DAO | Entidades / operaciones | Consultas destacadas |
|---|---|---|
| `usuarioDao.js` | `usuarios`, `roles`, `alumnos`, `personal`, `credenciales_qr`, `recuperacion_password` | `findByDni`, `findByCorreo`, `findByDniOCorreo`, `findById`, `getCredencialQR`, reset/actualizar password |
| `alumnoDao.js` | `apoderados`, `usuarios`, `alumnos`, `expediente_alumno`, `credenciales_qr` | Listado con filtros, código `EST-XXX`, matrícula transaccional, retiro |
| `personalDao.js` | `usuarios`, `personal`, `credenciales_qr` | Listado con rol, creación transaccional, cese/reactivación, reset |
| `gradoDao.js` | `grados`, `alumnos`, `tutores_grado`, `horarios` | Grados con conteo, tutor, horario ordenado por día/hora |
| `cursoDao.js` | `cursos`, `competencias`, `escala_calificacion` | Listado con conteo de competencias, escala |
| `cargaCurricularDao.js` | `carga_curricular`, `tutores_grado` | Listados por grado/docente, asignación de tutor transaccional |
| `asistenciaDao.js` | `asistencia_alumnos`, `asistencia_personal` | Matriz por curso/fecha, historial, resumen, upserts |
| `calificacionDao.js` | `calificaciones`, `notas_finales_area`, `conclusiones_descriptivas` | Matriz competencia×alumno, upsert, nota final, conclusiones |
| `tesoreriaDao.js` | `conceptos_pago`, `pre_tickets`, `pagos`, `boletas_electronicas`, `pensiones`, `becas` | Pago transaccional, numeración de boleta, generación de pensiones |
| `cajaDao.js` | `cajas`, `aperturas_caja`, `movimientos_caja`, `cierres_caja` | Caja abierta, apertura/egreso/cierre con arqueo |
| `reporteDao.js` | Múltiples tablas | Dashboard, mérito, riesgo, libreta, asistencia, auditoría docente |
| `auditoriaDao.js` | `bitacora_auditoria`, `actas_bimestrales` | Bitácora filtrada (máx. 200), actas, hash MD5 |
| `notificacionDao.js` | `notificaciones` | Listar/contar/marcar/eliminar por destinatario; creación masiva |
| `siagieDao.js` | `alumnos`, `cursos`, `notas_finales_area`, `grados`, `exportaciones_siagie` | Notas por grado/bimestre, grado, registro de exportación |
| `recuperacionDao.js` | `recuperacion_password`, `usuarios` | Crear token (expira en PostgreSQL), validar, marcar usado |

### 1.6 Servicios transversales

| Archivo | Uso |
|---|---|
| `emailService.js` | Resend; `RESEND_API_KEY`, `EMAIL_FROM`; interfaz compatible con la versión Nodemailer |
| `response.js` | Respuestas uniformes |
| `authMiddleware.js` | Seguridad por token/rol |

## 2. Frontend

### 2.1 Núcleo (`src/app/core`)

| Archivo | Tipo | Función |
|---|---|---|
| `guards/auth.guard.ts` | `CanActivateFn` | Exige token vigente; guarda `returnUrl` |
| `guards/role.guard.ts` | Factory `CanActivateFn` | Exige rol; redirige al panel correcto |
| `interceptors/auth.interceptor.ts` | `HttpInterceptorFn` | Añade `Bearer` |
| `models/usuario.model.ts` | Interfaces | `Usuario`, `LoginRequest`, `LoginResponse`, rol tipado |
| `services/auth.service.ts` | Servicio root | Login, logout, token, sesión, perfil, `tieneRol` |
| `services/notificacion.service.ts` | Servicio root | Listar, contar, marcar, señal `noLeidas` |

### 2.2 Layouts y shared

| Componente | Archivo | Rol |
|---|---|---|
| `HeaderComponent` | `shared/components/header` | Campanita, buzón, carné QR, usuario, logout |
| `SidebarComponent` | `shared/components/sidebar` | Menú ADMIN |
| `SidebarDocenteComponent` | `shared/components/sidebar-docente` | Menú DOCENTE |
| `SidebarEstudianteComponent` | `shared/components/sidebar-estudiante` | Menú ESTUDIANTE |
| `SidebarSecretariaComponent` | `shared/components/sidebar-secretaria` | Menú SECRETARIA |
| `AdminLayoutComponent` | `features/admin/layout` | Header + sidebar + router-outlet |
| `DocenteLayoutComponent` | `features/docente/layout` | Ídem |
| `EstudianteLayoutComponent` | `features/estudiante/layout` | Ídem |
| `SecretariaLayoutComponent` | `features/secretaria/layout` | Ídem |

### 2.3 Features y componentes

| Rol | Componente | Ruta | Archivos |
|---|---|---|---|
| Auth | `LoginComponent` | `/login` | ts/html/scss |
| Auth | `ResetPasswordComponent` | `/reset-password` | ts/html/scss |
| Admin | `DashboardComponent` | `/admin` | ts/html/scss |
| Admin | `AdminAlumnosComponent` | `/admin/alumnos` | ts/html/scss |
| Admin | `AdminPersonalComponent` | `/admin/personal` | ts/html/scss |
| Admin | `AdminCargaCurricularComponent` | `/admin/carga-curricular` | ts/html/scss |
| Admin | `AdminAsistenciaQrComponent` | `/admin/asistencia-qr` | ts/html/scss |
| Admin | `AdminTesoreriaComponent` (wrapper) | `/admin/tesoreria` | ts |
| Admin | `AdminCajaComponent` (wrapper) | `/admin/caja` | ts |
| Admin | `AdminSiagieComponent` | `/admin/siagie` | ts/html/scss |
| Admin | `AdminReportesComponent` | `/admin/reportes` | ts/html/scss |
| Admin | `AdminAuditoriaComponent` | `/admin/auditoria` | ts/html/scss |
| Docente | `DocenteDashboardComponent` | `/docente` | ts/html/scss |
| Docente | `DocenteNotasComponent` | `/docente/notas` | ts/html/scss |
| Docente | `DocenteAsistenciaComponent` | `/docente/asistencia` | ts/html/scss |
| Docente | `DocenteFichaComponent` | `/docente/ficha-estudiante` | ts/html/scss |
| Docente | `DocenteReportesComponent` | `/docente/reportes` | ts/html/scss |
| Estudiante | `EstudianteDashboardComponent` | `/estudiante` | ts/html/scss |
| Estudiante | `EstudianteAsistenciaComponent` | `/estudiante/asistencia` | ts/html/scss |
| Estudiante | `EstudianteHorarioComponent` | `/estudiante/horario` | ts/html/scss |
| Secretaría | `SecretariaDashboardComponent` | `/secretaria` | ts/html/scss |
| Secretaría | `SecretariaPadronComponent` (wrapper) | `/secretaria/padron` | ts |
| Secretaría | `SecretariaTesoreriaComponent` | `/secretaria/tesoreria` | ts/html/scss |
| Secretaría | `SecretariaCajaComponent` | `/secretaria/caja` | ts/html/scss |
| Secretaría | `SecretariaAsistenciaQrComponent` (wrapper) | `/secretaria/asistencia-qr` | ts |
| Genérico | `EnConstruccionComponent` | `/en-construccion` | ts/html/scss |

### 2.4 Patrón de componente

Estructura típica de un feature:

```ts
export class XComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  cargando = signal(true);
  error = signal<string | null>(null);
  datos = signal<T[]>([]);

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargando.set(true);
    this.http.get<any>(`${environment.apiUrl}/recurso`).subscribe({
      next: (res) => { if (res.success) this.datos.set(res.data); this.cargando.set(false); },
      error: (err) => { this.cargando.set(false); this.error.set('...'); },
    });
  }
}
```

Convenciones:
- Signals en lugar de propiedades mutables.
- `usuario()` provee `info_adicional.id_personal` o `id_alumno` según rol.
- `Number()` para valores numéricos que llegan como string.
- Modales con `@if` y overlay.
- Loading desactivado primero en errores.

## 3. Inventario de archivos

### 3.1 Backend (`siga-uc-backend/src`)

```text
app.js
config/env.js, config/academico.js, config/database.js
middlewares/authMiddleware.js
utils/response.js, utils/pdfCommon.js
routes/ (14)
controllers/ (14)
services/ (19)
dao/ (15)
```

### 3.2 Frontend (`siga-uc-frontend/src/app`)

```text
app.ts, app.html, app.scss, app.routes.ts, app.config.ts
core/guards (2), core/interceptors (1), core/models (1), core/services (3)
shared/components/header + sidebar + sidebar-docente + sidebar-estudiante + sidebar-secretaria
features/auth (login, reset-password, cambiar-password)
features/admin (dashboard, alumnos, personal, carga-curricular, asistencia-qr,
                 tesoreria, caja, siagie, reportes, auditoria)
features/docente (dashboard, notas, asistencia, ficha-estudiante, reportes)
features/estudiante (dashboard, asistencia, horario)
features/secretaria (dashboard, padron, tesoreria, caja, asistencia-qr)
features/en-construccion
```
