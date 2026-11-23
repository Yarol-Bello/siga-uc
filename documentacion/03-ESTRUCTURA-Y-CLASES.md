# 03 — Estructura y Mapa de Clases

> Conteo verificado el 23/11/2026: **104 archivos JS backend**, **169 archivos frontend
> (72 TypeScript)**, **18 routers**, **18 controladores**, **31 servicios** y **27 DAOs**.

## 1. Backend

### 1.1 Punto de entrada y configuración

| Archivo | Responsabilidad |
|---|---|
| `src/app.js` | Crea Express, registra middlewares globales, 18 routers, health check, 404 y error handler; arranca en `0.0.0.0:PORT`; prueba BD y correo |
| `src/config/env.js` | Carga `.env`, valida `DB_*`, `JWT_SECRET` y `ANIO_LECTIVO`, exporta configuración centralizada |
| `src/config/academico.js` | Expone `getAnioLectivo()` desde `ANIO_LECTIVO` |
| `src/config/database.js` | Pool `pg` (`max=20`), helper `query`, `getClient` transaccional, `testConnection` |
| `src/middlewares/authMiddleware.js` | `verificarAutenticacion` (Bearer/JWT, estado y bloqueo por cambio de contraseña) y `verificarRol(...roles)` |
| `src/utils/response.js` | `success` (con `pagination` opcional), `error`, `validationError`, `unauthorized`, `forbidden`, `notFound` |

### 1.2 Routers (17)

| Router | Prefijo | Endpoints | Rol de escritura |
|---|---|---|---|
| `authRoutes.js` | `/api/auth` | 9 | ADMIN para reset por DNI |
| `configuracionRoutes.js` | `/api/configuracion` | 34 | Público GET; ADMIN/SECRETARÍA lectura; ADMIN escritura |
| `setupRoutes.js` | `/api/setup` | 2 | Público con token; solo mientras no haya ADMIN |
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
| `siagieRoutes.js` | `/api/siagie` | 2 | ADMIN (exportación interna) |
| `notificacionRoutes.js` | `/api/notificaciones` | 8 | ADMIN/DOCENTE; masivo ADMIN |

### 1.3 Controladores (18)

| Controlador | Métodos | Notas |
|---|---|---|
| `authController.js` | `login`, `perfil`, `verify`, `logout`, `resetPassword`, `solicitarRecuperacion`, `validarToken`, `restablecerPassword`, `cambiarPassword` | `validationResult` en login y cambio de contraseña; recuperación delega a `recuperacionService` |
| `configuracionController.js` | `obtenerPublica`, `obtenerAdmin`, `actualizarInstitucional`, tarifas, académico, jornada y becas | H74–H78: configuración, tarifas, catálogo, jornada y becas con motivo/auditoría |
| `setupController.js` | `estado`, `inicializar` | H79: primera configuración con token y transacción única |
| `academicoController.js` | `listarGrados`, `obtenerGrado`, `listarCursos`, `obtenerCurso`, `listarCompetencias`, `listarEscalaCalificacion` | Solo lectura |
| `horarioController.js` | `listarPeriodos`, CRUD de períodos, `listar`, `miHorario`, CRUD de bloques, `generar`, `publicar`, `despublicar` | H47; ADMIN/SECRETARIA/DOCENTE/ESTUDIANTE según ruta |
| `alumnoController.js` | `listar`, `obtener`, `buscarPorDni`, `crear`, `actualizar`, `retirar` | Filtros por `id_grado`, estado, búsqueda, año, `limit`, `solo_activos` y paginación (`page`/`pageSize`) |
| `personalController.js` | `listar`, `obtener`, `listarRoles`, `crear`, `actualizar`, `cesar`, `reactivar`, `resetPassword` | Roles excluyen ESTUDIANTE |
| `cargaCurricularController.js` | `listar`, `obtener`, `listarPorGrado`, `listarPorDocente`, `crear`, `actualizar`, `eliminar`, `asignarTutor`, `getTutor` | `listarPorDocente` usa el año lectivo configurado |
| `asistenciaController.js` | `obtenerPorCursoFecha`, `obtenerPorAlumno`, `obtenerResumenPorAlumno`, `registrar`, `registrarMasivo`, `listarAsistenciaPersonal`, `buscarPersonalPorDni`, `registrarAsistenciaPersonal`, `obtenerResumenAsistenciaPersonal` | Personal y alumnos separados |
| `calificacionController.js` | `obtenerPorAlumnoCurso`, `obtenerPorCursoGrado`, `registrar`, `registrarMasivo`, `calcularNotaFinal`, `obtenerNotasFinales` | `calcularNotaFinal` expone el cálculo |
| `tesoreriaController.js` | `listarConceptos`, `listarPreTickets`, `obtenerPreTicket`, `crearPreTicket`, `listarPagos`, `obtenerPago`, `getBoletaPdf`, `registrarPago`, `listarPensionesAlumno`, `generarPensionesMes`, `listarBecas`, `aplicarBeca`, `getEstadisticas` | Inyecta `id_usuario` del token; PDF de boleta |
| `cajaController.js` | `obtenerCajaAbierta`, `listarCajas`, `listarAperturas`, `obtenerApertura`, `aperturar`, `listarMovimientos`, `registrarEgreso`, `cerrar`, `listarCierres` | Inyecta usuario de apertura/egreso/cierre |
| `reporteController.js` | `getDashboard`, `getAlumnosRiesgo`, `getCuadroMerito`, `getLibreta`, `getLibretaPdf`, `getResumenAsistencia`, `getAuditoriaDocentes` | KPIs, reportes y PDF de libreta |
| `auditoriaController.js` | `listarBitacora`, `obtenerBitacora`, `listarModulos`, `listarActas`, `getActaPdf`, `cerrarActa`, `reabrirActa`, `getEstadisticas` | Inyecta `cerrado_por`; PDF de acta; cierre/reapertura auditados; paginación con `page`/`pageSize` |
| `siagieController.js` | `obtenerResumen`, `exportarInterno` | Valida año/grado/bimestre, audita y descarga el Excel interno |
| `notificacionController.js` | `listar`, `obtener`, `contarNoLeidas`, `crear`, `crearMasivo`, `marcarLeida`, `marcarTodasLeidas`, `eliminar` | Siempre limita al usuario autenticado |

### 1.4 Servicios (31)

| Servicio | Métodos principales | Reglas que concentra |
|---|---|---|
| `authService.js` | `login`, `verificarToken`, `getPerfil`, `resetPassword`, `cambiarPassword` | Usuario activo, bcrypt, JWT, info adicional por rol, QR en perfil, cambio de contraseña con verificación de la actual |
| `configuracionService.js` | `obtenerConfiguracionPublica`, `obtenerConfiguracionAdmin`, `actualizarInstitucion` | H74: institución única, validaciones, motivo, auditoría en transacción, fallback sin migración |
| `conceptoPagoService.js` | `listar`, `obtener`, `preview`, `crear`, `actualizar`, `programarVersion`, `desactivar` | H75: alcance, vigencia, colisiones, impacto y auditoría |
| `configuracionAnioService.js` | `obtener`, `actualizar` | H77: días/jornada/límites, horarios publicados y auditoría |
| `becaService.js` | `listarTipos`, `crearTipo`, `actualizarTipo`, `listarBecas`, `crearBeca`, `actualizarBeca`, `aprobarBeca`, `rechazarBeca`, `anularBeca`, `previewBeca` | H78: estados, evidencia, motivo, aplicación y auditoría |
| `becaCalculator.js` | `calcular`, `aplicarPension`, `aplicarPreticket`, `aplicarPensionesAlumno`, `aplicarPensionesMes` | H78: prioridad, tope, exclusividad, combinación, `EXONERADO` y pagos intactos |
| `setupService.js` | `estadoPublico`, `anunciarTokenSiPendiente`, `inicializar` | H79: token, rate limit, validaciones, transacción y auditoría inicial |
| `academicoService.js` | `listarGrados`, `obtenerGrado`, `listarCursos`, `obtenerCurso`, `listarCompetencias`, `listarEscalaCalificacion` | 404 si no existe; agrega tutor/competencias |
| `horarioService.js` | `listar`, `miHorario`, CRUD de bloques, `generar`, `publicar`, `despublicar` | Alcance por token, conflictos, publicación y auditoría |
| `periodoClaseService.js` | `listar`, `crear`, `actualizar`, `eliminar` | Malla por año, sin solapes |
| `horarioGenerator.js` | `generarHorario` | Algoritmo puro con semilla, sin publicar |
| `alumnoService.js` | `listar`, `obtener`, `buscarPorDni`, `crear`, `actualizar`, `retirar` | DNI único por año, campos obligatorios, no retirar dos veces |
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
| `auditoriaService.js` | `listarBitacora`, `obtenerBitacora`, `listarModulos`, `listarActas`, `cerrarActa`, `reabrirActa`, `getEstadisticas` | Valida bimestre/año/grado; periodo canónico; 404/409; motivo de reapertura |
| `siagieService.js` | `obtenerResumen`, `generarExcelInterno` | Cursos de la carga, notas/conclusiones, workbook con aviso interno y auditoría |
| `notificacionService.js` | `listar`, `obtener`, `contarNoLeidas`, `crear`, `crearMasivo`, `marcarLeida`, `marcarTodasLeidas`, `eliminar` | Correo no bloqueante, propiedad del destinatario; el masivo resuelve TODOS/GRADO/ALUMNO y cuenta correos enviados/fallidos |
| `recuperacionService.js` | `solicitarRecuperacion`, `validarToken`, `restablecerPassword` | Token 32 bytes, 2 h, un uso, no revelar existencia |
| `emailService.js` | `verificarConexion`, `enviarCorreo`, `enviarNotificacion` | Resend; plantilla guindo/dorado |

### 1.5 DAOs (27)

| DAO | Entidades / operaciones | Consultas destacadas |
|---|---|---|
| `usuarioDao.js` | `usuarios`, `roles`, `alumnos`, `personal`, `credenciales_qr`, `recuperacion_password` | `findByDni`, `findByCorreo`, `findByDniOCorreo`, `findById`, `getCredencialQR`, reset/actualizar password |
| `configuracionDao.js` | `configuracion_institucional`, `configuracion_anio`, `anios_lectivos` | Institución única, años, bloqueo `FOR UPDATE` y actualización |
| `configuracionAnioDao.js` | `configuracion_anio`, `periodos_clase` | Lectura/actualización de jornada y validación de períodos |
| `conceptoPagoDao.js` | `conceptos_pago`, `pensiones`, `pre_tickets` | Resolución por grado/nivel/fecha, impacto y versiones |
| `becaDao.js` | `tipos_beca`, `becas`, `aplicaciones_beca`, `pensiones`, `pre_tickets` | Catálogo, aplicables, aplicaciones y recálculo de cargos |
| `setupDao.js` | `configuracion_institucional`, `usuarios`, `roles`, `escala_calificacion`, `anios_lectivos`, `grados`, `cajas`, `personal` | Estado inicial, admin, año, grados y caja |
| `alumnoDao.js` | `apoderados`, `usuarios`, `alumnos`, `expediente_alumno`, `credenciales_qr` | Listado con filtros, búsqueda `unaccent` por DNI/nombre completo, `LIMIT` opcional y `LIMIT/OFFSET` con `contar`; código `EST-XXX`, matrícula transaccional, retiro |
| `personalDao.js` | `usuarios`, `personal`, `credenciales_qr` | Listado con rol, creación transaccional, cese/reactivación, reset |
| `gradoDao.js` | `grados`, `alumnos`, `tutores_grado` | Grados con conteo y tutor |
| `horarioDao.js` | `horarios`, `carga_curricular`, `periodos_clase` | Listados, conflictos, generación y publicación |
| `periodoClaseDao.js` | `periodos_clase` | CRUD y solapes |
| `cursoDao.js` | `cursos`, `competencias`, `escala_calificacion` | Listado con conteo de competencias, escala |
| `cargaCurricularDao.js` | `carga_curricular`, `tutores_grado` | Listados por grado/docente, asignación de tutor transaccional |
| `asistenciaDao.js` | `asistencia_alumnos`, `asistencia_personal` | Matriz por curso/fecha, historial, resumen, upserts |
| `calificacionDao.js` | `calificaciones`, `notas_finales_area`, `conclusiones_descriptivas` | Matriz competencia×alumno, upsert, nota final, conclusiones |
| `tesoreriaDao.js` | `conceptos_pago`, `pre_tickets`, `pagos`, `boletas_electronicas`, `pensiones`, `becas` | Pago transaccional, numeración de boleta, generación de pensiones |
| `cajaDao.js` | `cajas`, `aperturas_caja`, `movimientos_caja`, `cierres_caja` | Caja abierta, apertura/egreso/cierre con arqueo |
| `reporteDao.js` | Múltiples tablas | Dashboard, mérito, riesgo, libreta, asistencia, auditoría docente |
| `auditoriaDao.js` | `bitacora_auditoria`, `actas_bimestrales` | Bitácora filtrada con `COUNT` y `LIMIT/OFFSET` (sin `page` máx. 200); actas con `INSERT ... ON CONFLICT`, reapertura y `actaEstaCerrada` con bloqueo global |
| `notificacionDao.js` | `notificaciones`, `usuarios`, `alumnos`, `grados` | Listar/contar/marcar/eliminar por destinatario; `listarDestinatarios` por TODOS/GRADO/ALUMNO e inserción masiva con `unnest` |
| `siagieDao.js` | `alumnos`, `cursos`, `carga_curricular`, `notas_finales_area`, `conclusiones_descriptivas`, `grados`, `exportaciones_siagie` | Cursos del grado/año, alumnos vigentes, notas, conclusiones y registro de exportación |
| `recuperacionDao.js` | `recuperacion_password`, `usuarios` | Crear token (expira en PostgreSQL), validar, marcar usado |

### 1.6 Servicios transversales

| Archivo | Uso |
|---|---|
| `emailService.js` | Resend; `RESEND_API_KEY`, `EMAIL_FROM`; interfaz compatible con la versión Nodemailer |
| `response.js` | Respuestas uniformes; `success` agrega `pagination` cuando se pasa |
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
| Admin | `AdminHorariosComponent` | `/admin/horarios` | ts/html/scss |
| Shared | `HorarioGridComponent` | grilla reutilizable | ts/html/scss |
| Admin | `AdminAsistenciaQrComponent` | `/admin/asistencia-qr` | ts/html/scss |
| Admin | `AdminTesoreriaComponent` (wrapper) | `/admin/tesoreria` | ts |
| Admin | `AdminCajaComponent` (wrapper) | `/admin/caja` | ts |
| Admin | `AdminSiagieComponent` | `/admin/siagie` | ts/html/scss |
| Admin | `AdminReportesComponent` | `/admin/reportes` | ts/html/scss |
| Admin | `AdminAuditoriaComponent` | `/admin/auditoria` | ts/html/scss |
| Admin | `AdminConfiguracionComponent` | `/admin/configuracion` | ts/html/scss |
| Docente | `DocenteDashboardComponent` | `/docente` | ts/html/scss |
| Docente | `DocenteNotasComponent` | `/docente/notas` | ts/html/scss |
| Docente | `DocenteHorarioComponent` | `/docente/horario` | ts/html/scss |
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
| Secretaría | `SecretariaHorariosComponent` | `/secretaria/horarios` | ts/html/scss |
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
