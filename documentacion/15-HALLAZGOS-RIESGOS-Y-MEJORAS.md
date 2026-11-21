# 15 — Hallazgos, Riesgos y Mejoras

Resultado del análisis del código el 19/11/2026. **No se modificó la aplicación.** Cada
hallazgo incluye evidencia, impacto, recomendación y esfuerzo estimado
(S = <1 día, M = 1–3 días, L = >3 días).

> **Actualización 20/11/2026:** H18 (cambio obligatorio de contraseña) quedó resuelto con
> endpoint autenticado, pantalla `/cambiar-password` y bloqueo backend. H12 (año lectivo y
> conceptos hardcodeados) quedó resuelto con `ANIO_LECTIVO`, `GET /api/configuracion` y
> conceptos dinámicos. H25 (backup) quedó resuelto con `npm run backup`, script Node y guía de
> programación en Render/Supabase. H34 quedó resuelto: libretas, boletas y actas con PDFKit.
> H15 quedó resuelto: mensajes personalizados con destinatarios TODOS/GRADO/ALUMNO y envío por
> Resend sin perder la notificación si el correo falla.
> H23 quedó resuelto parcialmente: alumnos y bitácora ya tienen paginación server-side; faltan
> personal, pagos y pre-tickets. H19 y H20 quedaron resueltos: el retiro desactiva al usuario y
> congela el expediente en una transacción, y la edición sincroniza nombres/apellidos.
>
> **Actualización 21/11/2026 (auditoría de hallazgos):** H01, H02, H04, H06, H08 y H17 quedaron
> verificados como resueltos con evidencia en el código; H03 y H09 quedan 🟡 (parciales); H07
> sigue sin cambios.
>
> **Actualización 21/11/2026 (cierre H03/H09):** H03 y H09 quedaron resueltos. Se añade H36
> (rate limit de login por IP compartida en red escolar) solo como hallazgo documentado.
>
> **Actualización 21/11/2026 (H39):** las fechas de negocio se calculan en hora local y las
> sesiones de PostgreSQL trabajan en `America/Lima`; H39 queda resuelto.
>
> **Actualización 21/11/2026 (H32):** anulación de pagos con reversión de caja, pensión,
> pre-ticket y boleta; H32 queda resuelto.
>
> **Actualización 21/11/2026 (H10/H37/H38):** numeraciones protegidas con advisory locks,
> coherencia mes/año concepto-pensión y bloqueo del doble pago; H10, H37 y H38 resueltos.
>
> **Actualización 21/11/2026 (H40):** secuencia de instalación corregida; `siga_uc_completo.sql`
> es el dump completo y `siga_uc.sql` queda solo como referencia de esquema.
>
> **Actualización 21/11/2026 (H07 parte A):** servicio de auditoría, eventos de seguridad y
> dinero, `modificado_por` desde el token e índices de bitácora; H07 queda 🟡 hasta la parte B.

---

## 1. Hallazgos críticos y altos

### H01 — GET sensibles accesibles para cualquier autenticado

| Campo | Detalle |
|---|---|
| Severidad | **Crítica** |
| Evidencia | `alumnoRoutes.js`, `personalRoutes.js`, `calificacionRoutes.js`, `asistenciaRoutes.js`, `tesoreriaRoutes.js`, `cajaRoutes.js`, `auditoriaRoutes.js` solo aplican `router.use(verificarAutenticacion)` en los GET |
| Impacto | Un estudiante puede listar alumnos, ver notas/asistencias ajenas, pagos, caja y bitácora |
| Recomendación | Middleware de autorización por recurso/rol; restringir GET a ADMIN/SECRETARIA/DOCENTE según módulo; validar pertenencia en libreta y asistencias |
| Esfuerzo | M |
| Estado | ✅ Resuelto (21/11/2026): `alumnoRoutes.js:26` (ADMIN/SECRETARIA) y `:27-38` (`checkAlumnoPropio`/`checkAlumnoPorDni`); `personalRoutes.js:17`, `tesoreriaRoutes.js:17` y `cajaRoutes.js:17` (ADMIN/SECRETARIA); `auditoriaRoutes.js:26` (ADMIN); `calificacionRoutes.js:26-42` y `asistenciaRoutes.js:32-42` con ownership; `reporteRoutes.js:50-60` con ownership |

### H02 — El estado del usuario no se revalida en cada petición

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | `authMiddleware.verificarAutenticacion` solo verifica el JWT; `authService.login` valida estado |
| Impacto | Un usuario cesado conserva acceso hasta 8 h |
| Recomendación | Consultar `usuarios.estado` en el middleware (con caché corta) o incluir versión de sesión |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): `authMiddleware.js:41-51` consulta `getContextoUsuario` y rechaza `estado !== 'ACTIVO'` en cada request, incluidos los JWT ya emitidos |

### H03 — Sin rate limiting ni bloqueo por intentos

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | No hay `express-rate-limit` ni contador de intentos |
| Impacto | Fuerza bruta sobre DNI/contraseña y recuperación |
| Recomendación | Limitar `/auth/login`, `/auth/recuperar-password` y `/auth/validar-token`; bloqueo temporal |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): `crearLimiter` (5 intentos/15 min) y `tokenValidationLimiter` en `rateLimit.js:22-42`, aplicado a login (`authRoutes.js:25-27`), recuperación (`:109-113`) y `GET /auth/validar-token/:token` (`:122-126`) |

### H04 — La nota final no se calcula automáticamente desde la UI

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | `POST /api/calificaciones/notas-finales` existe; ningún componente lo llama. Reportes y SIAGIE leen `notas_finales_area` |
| Impacto | Libretas, mérito, riesgo y SIAGIE pueden salir vacíos aunque los docentes hayan registrado competencias |
| Recomendación | Botón “Calcular notas finales” por curso/bimestre o cálculo automático tras guardar; job de cierre |
| Esfuerzo | M |
| Estado | ✅ Resuelto (21/11/2026): tras cada guardado, `registrar` y `registrarMasivo` recalculan y guardan `notas_finales_area` (`calificacionService.js:146-159` y `:172-209`; `calificacionDao.js:283-286`) |

### H05 — SIAGIE limitado a 4 cursos y primera hoja

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | `siagieService` detecta solo `ARITM`, `ALGEBRA`, `COMUNIC`, `FISICA`; usa `worksheets[0]`; comparación por primeros 5 caracteres |
| Impacto | Plantillas con otros cursos (Historia, Geografía, Química, Razonamiento) no se llenan; nombres similares pueden confundirse |
| Recomendación | Mapeo configurable columna↔curso, soporte multi-hoja, normalización de nombres |
| Esfuerzo | M |

### H06 — El cierre de acta no bloquea modificaciones

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | `auditoriaDao.cerrarActa` solo actualiza el acta; no hay validación en `calificacionDao` |
| Impacto | Se pueden alterar notas después del cierre, contradiciendo el mensaje de la UI |
| Recomendación | Verificar acta `CERRADO` antes de insertar/actualizar notas; permitir reapertura auditada |
| Esfuerzo | M |
| Estado | ✅ Resuelto (21/11/2026): `auditoriaDao.actaEstaCerrada` (`auditoriaDao.js:346-368`) se invoca antes de registrar y calcular (`calificacionService.js:12-28` y `:234`), respondiendo 409 |

### H07 — Auditoría incompleta y con usuario NULL

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | Solo `trg_calificaciones_audit`; el frontend no envía `modificado_por`; no se audita login, pagos, caja, matrícula |
| Impacto | Sin trazabilidad real; la bitácora no sirve para investigación |
| Recomendación | Servicio de auditoría central, tomar usuario del token, auditar eventos críticos |
| Esfuerzo | M |
| Estado | 🟡 Parcial (21/11/2026, parte A): `auditoriaService.registrar/registrarSeguro` + login/logout/recuperación/cambio de contraseña, pagos, anulación y caja; `modificado_por` desde el token en calificaciones e índices `ix_bitacora_*`. Falta la parte B: alumnos, personal, notificaciones, descargas y cierre de acta |

### H08 — Pagos se imputan a una caja posiblemente cerrada

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | `trg_pago_a_caja` toma la última apertura sin comprobar cierre |
| Impacto | Movimientos en cajas cerradas; descuadre y reportes inconsistentes |
| Recomendación | Verificar apertura sin cierre; si no hay, rechazar pago o registrar pendiente |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): el trigger solo imputa a aperturas sin cierre (`siga_uc.sql:207-214`) y `registrarPago` rechaza el cobro si no hay caja abierta (`tesoreriaService.js:74-81`) |

### H09 — El pago no valida monto, concepto ni caja

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | `tesoreriaService.registrarPago` valida presencia y existencia, no coherencia |
| Impacto | Se puede pagar S/1 una pensión de S/250 o pagar una pensión de otro alumno |
| Recomendación | Validar monto contra pensión/concepto, pertenencia alumno-pensión y caja abierta |
| Esfuerzo | M |
| Estado | ✅ Resuelto (21/11/2026): `registrarPago` exige pensión existente, del mismo alumno, `PENDIENTE` y monto igual a `monto_final` redondeado a 2 decimales (`tesoreriaService.js:52-64` y `:114-182`; `tesoreriaDao.js:343-369`). Si el concepto es pensión sin `id_pension`, la resuelve por alumno/año/mes; los conceptos no pensión exigen `monto_base` exacto |

### H10 — Concurrencia en códigos y boletas

| Campo | Detalle |
|---|---|
| Severidad | **Media/Alta** |
| Evidencia | `getSiguienteCodigo` usa `MAX+1`; `registrarPago` usa `MAX(numero)+1` |
| Impacto | Dos matrículas/pagos simultáneos pueden colisionar; un fallo revierte la transacción |
| Recomendación | Secuencias PostgreSQL o `SELECT ... FOR UPDATE` |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): advisory locks por dominio dentro de la transacción (`codigo_alumno`, `efectivo:<año>`, `boleta:B001`) y `UNIQUE (serie, numero)` en `boletas_electronicas`; pruebas concurrentes con códigos, nros y boletas distintos |

---

## 2. Hallazgos medios

### H11 — Guardado masivo con éxito parcial silencioso

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `asistenciaDao.registrarMasivo` y `calificacionDao.registrarMasivo` capturan errores por fila y hacen `COMMIT` igual |
| Impacto | La UI muestra “X guardadas” y oculta filas fallidas |
| Recomendación | Mostrar `errores[]`; usar savepoints o validación previa |
| Esfuerzo | S |

### H12 — Año 2026 y conceptos hardcodeados (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | Defaults `2026` en controllers/DAOs/UI; `conceptosMap` en tesorería; `anio_lectivo: 2026` en notas; `anio=2026` en listados |
| Impacto | El sistema no opera correctamente en 2027 sin cambios de código |
| Recomendación | Configuración global de año lectivo y mapeo dinámico de conceptos |
| Esfuerzo | M |
| Estado | ✅ Resuelto (20/11/2026): `ANIO_LECTIVO` + `GET /api/configuracion` + conceptos dinámicos y script idempotente |

### H13 — Resumen de asistencia ignora el año

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `reporteDao.getResumenAsistenciaGrado` recibe `anioLectivo` pero la consulta no lo usa; comenta “SOLO 1 parámetro” |
| Impacto | Mezcla asistencias de distintos años |
| Recomendación | Filtrar por año en `asistencias` o `alumnos.anio_lectivo` |
| Esfuerzo | S |

### H14 — Dos algoritmos de nota final

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `calificacionDao.calcularNotaFinal` desempata por mejor nota; `calcular_nota_final_area` SQL no |
| Impacto | Resultados distintos según el punto de cálculo |
| Recomendación | Unificar en una sola función/DAO documentado |
| Esfuerzo | S |

### H15 — Envío masivo de notificaciones no envía correos (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | Antes `notificacionService.crearMasivo` solo insertaba; ahora resuelve TODOS/GRADO/ALUMNO y envía correos con manejo de fallos |
| Impacto | El ADMIN cree que envió correos y solo llegó la campanita |
| Recomendación | Reutilizar `crear` por destino o enviar en lote |
| Esfuerzo | S |
| Estado | ✅ Resuelto (20/11/2026): `POST /notificaciones/masivo`, destinatarios dinámicos y correos con `correos_enviados`/`correos_fallidos` |

### H16 — HTML del correo sin escapar

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `emailService.plantillaNotificacion` interpola `asunto`, `destinatario`, `cuerpo`, `remitente` sin escape |
| Impacto | Inyección de HTML en correos internos |
| Recomendación | Escapar entidades o usar plantilla con texto plano |
| Esfuerzo | S |

### H17 — Mensajes de error SQL expuestos

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | Controllers devuelven `error.message` en 500; `express` handler global también |
| Impacto | Fuga de nombres de tablas/columnas y detalles internos |
| Recomendación | Mensaje genérico al cliente; detalle solo en logs |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): `response.error` sustituye cualquier mensaje por uno genérico cuando el status es ≥ 500 (`response.js:33-40`), y el handler global hace lo mismo (`app.js:151-157`); el detalle queda solo en consola |

### H18 — Cambio obligatorio de contraseña (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | El flag se guarda y devuelve, pero no hay pantalla ni bloqueo |
| Impacto | Contraseñas temporales pueden quedar indefinidamente |
| Recomendación | Pantalla obligatoria post-login y bloqueo de otras rutas |
| Esfuerzo | M |
| Estado | ✅ Resuelto (20/11/2026): endpoint `PUT /api/auth/cambiar-password`, pantalla `/cambiar-password`, redirect en guards y bloqueo API |

### H19 — Retiro no congela expediente ni usuario (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | Antes `alumnoDao.retirar` solo actualizaba `alumnos`; ahora usa transacción y actualiza `usuarios.estado = 'INACTIVO'` y `expediente_alumno.congelado = TRUE` |
| Impacto | Usuario retirado puede iniciar sesión y consultar; expediente queda abierto |
| Recomendación | `expediente_alumno.congelado = true` y `usuarios.estado = INACTIVO` (o CESADO) |
| Esfuerzo | S |
| Estado | ✅ Resuelto (20/11/2026): retiro atómico; login responde 403 y los JWT en curso quedan bloqueados |

### H20 — Edición de alumno no sincroniza usuario (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | Antes `alumnoDao.actualizar` no tocaba `usuarios`; ahora sincroniza nombres/apellidos con `COALESCE` en la misma transacción |
| Impacto | Login/perfil muestran nombres antiguos; correos desactualizados |
| Recomendación | Actualizar usuario en la misma transacción |
| Esfuerzo | S |
| Estado | ✅ Resuelto (20/11/2026) |

### H21 — Cambio de rol no regenera QR ni permisos históricos

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `personalDao.actualizar` cambia `id_rol`; `credenciales_qr.tipo` queda igual |
| Impacto | Carné con tipo incorrecto |
| Recomendación | Actualizar credencial al cambiar rol |
| Esfuerzo | S |

### H22 — N+1 en tesorería

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `SecretariaTesoreriaComponent.cargarPensiones` hace una petición por alumno |
| Impacto | 20+ peticiones; empeora con más alumnos |
| Recomendación | Endpoint agregado de pensiones por año o incluir en listado |
| Esfuerzo | S/M |

### H23 — Listas sin paginación (parcial: alumnos y bitácora)

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | Alumnos, personal, pagos, pre-tickets, bitácora (200 fijo) |
| Impacto | Rendimiento y usabilidad con datos reales |
| Recomendación | Paginación server-side y filtros indexados |
| Esfuerzo | M |
| Estado | 🟡 Alumnos y bitácora resueltos (20/11/2026): `page`/`pageSize`, `COUNT(*)` con filtros y paginador compartido. Pendiente: personal, pagos y pre-tickets |

### H24 — Sin tests ni CI/CD

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `npm test` no implementado; no hay workflows |
| Impacto | Regresiones y despliegues manuales |
| Recomendación | Unit tests de services, integración de endpoints, E2E de flujos críticos, GitHub Actions |
| Esfuerzo | L |

### H25 — Sin backup automatizado (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | No hay scripts/cron; solo `pg_dump` manual documentado |
| Impacto | Pérdida de datos ante incidente |
| Recomendación | Tarea diaria + retención + prueba de restauración |
| Esfuerzo | S |
| Estado | ✅ Resuelto (20/11/2026): `scripts/backup.js`, `npm run backup`, `.gitignore` y documentación Render/Supabase |

---

## 3. Hallazgos bajos / documentación

### H26 — Documentación histórica desactualizada

| Campo | Detalle |
|---|---|
| Severidad | Baja |
| Evidencia | `AGENTS.md` anterior: 26 tablas, 17 servicios, 16 DAOs, 14 controladores, Nodemailer/SMTP; `database/README.md` 26 tablas; `docs/INSTALACION.md` 26 tablas |
| Impacto | Confusión para nuevos desarrolladores |
| Recomendación | Reemplazado por `AGENTS.md` nuevo y esta carpeta; actualizar `docs/` cuando se pueda |
| Esfuerzo | S |

### H27 — `.env.example` usa SMTP y no Resend

| Campo | Detalle |
|---|---|
| Severidad | Baja/Media |
| Evidencia | `.env.example` solo SMTP; `emailService` usa `RESEND_API_KEY`/`EMAIL_FROM`; `README.md` dice Nodemailer |
| Impacto | Un despliegue nuevo configura correo incorrecto |
| Recomendación | Actualizar `.env.example`, README e INSTALACION |
| Esfuerzo | S |

### H28 — `siga_uc.sql` con meta-orden de psql 18

| Campo | Detalle |
|---|---|
| Severidad | Baja |
| Evidencia | `\restrict` al inicio/fin del dump |
| Impacto | Falla en `psql` antiguo |
| Recomendación | Documentar o generar dump con `--no-restrict` |
| Esfuerzo | S |

### H29 — Tablas de reportes no persistidas

| Campo | Detalle |
|---|---|
| Severidad | Baja |
| Evidencia | `cuadro_merito`, `alumnos_riesgo`, `libretas`, `resumen_asistencia_curso`, `estado_carga_docentes` no se escriben |
| Impacto | Estructura muerta; confusión |
| Recomendación | Documentar como históricas o implementar persistencia si se necesita |
| Esfuerzo | S |

### H30 — Título e identidad menores

| Campo | Detalle |
|---|---|
| Severidad | Baja |
| Evidencia | `index.html` título `SigaUcFrontend`; sin `aria-label`; responsive revertido |
| Impacto | Percepción y accesibilidad |
| Recomendación | Título “SIGA-UC”, revisión accesible, drawer responsive |
| Esfuerzo | S |

### H31 — Endpoint de logout sin uso

| Campo | Detalle |
|---|---|
| Severidad | Baja |
| Evidencia | `POST /auth/logout` existe; el frontend no lo llama |
| Impacto | No hay registro de cierre de sesión |
| Recomendación | Llamarlo y auditar |
| Esfuerzo | S |

### H32 — Anulación de pagos sin UI (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `pagos.estado` admite `ANULADO`, pero no había endpoint ni pantalla |
| Impacto | Errores de cobro no se pueden corregir |
| Recomendación | Endpoint de anulación con reversión de caja/pensión y auditoría |
| Esfuerzo | M |
| Estado | ✅ Resuelto (21/11/2026): `PUT /tesoreria/pagos/:id/anular` (ADMIN/SECRETARIA) con transacción, `SELECT ... FOR UPDATE`, EGRESO en caja abierta, pensión/pre-ticket a PENDIENTE y boleta con watermark ANULADA; UI en caja e historial |

### H33 — Sin CRUD de horarios, competencias, conclusiones

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | Solo consultas; datos por seed/BD |
| Impacto | La institución no puede mantener su malla desde la UI |
| Recomendación | Módulos de configuración académica |
| Esfuerzo | L |

### H34 — Sin PDFs reales (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | Baja |
| Evidencia | `window.print()` en carné/reportes de caja; libretas, boletas y actas ya usan PDFKit |
| Impacto | Depende del navegador; no hay archivo firmado |
| Recomendación | `pdfkit`/Puppeteer para libretas, boletas y actas |
| Esfuerzo | M |
| Estado | ✅ Resuelto (21/11/2026): libretas, boletas y actas con PDFKit; acta incluye matriz real y watermark de borrador |

### H35 — Estudiantes sin pantalla de libreta

| Campo | Detalle |
|---|---|
| Severidad | Baja |
| Evidencia | El endpoint `/reportes/libreta/:id` está abierto a autenticados, pero el panel del estudiante no lo usa |
| Impacto | Funcionalidad disponible pero no visible |
| Recomendación | Añadir “Mi libreta” con validación de pertenencia |
| Esfuerzo | S |

### H36 — Rate limit de login por IP compartida en red escolar

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | El limiter de login (`rateLimit.js:22-32`) cuenta por IP: 5 intentos fallidos cada 15 minutos |
| Impacto | Detrás de una red escolar con NAT, 5 fallos de cualquier alumno bloquean el login de todo el colegio durante 15 minutos |
| Recomendación | Clave por DNI/usuario combinada con IP, o límites más altos con backoff progresivo; revisar `trust proxy` en producción |
| Esfuerzo | S |

### H37 — Concepto de pensión sin validar el mes

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Evidencia | `registrarPago` validaba monto y pertenencia, pero no que `pension.mes`/`anio_lectivo` coincidieran con el concepto |
| Impacto | Se podía pagar el concepto de abril y marcar como pagada la pensión de marzo |
| Recomendación | Exigir coincidencia de mes y año entre concepto y pensión |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): `tesoreriaService.registrarPago` responde 400 “El concepto no corresponde al mes de la pensión.” También en la resolución automática |

### H38 — Doble pago concurrente de la misma pensión

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Evidencia | Dos pagos simultáneos podían leer la pensión `PENDIENTE` y registrar ambos |
| Impacto | Pensión pagada dos veces y boletas duplicadas |
| Recomendación | Índice único parcial por pensión activa y respuesta 409 |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): lock por `pension:<id>` + verificación de pago activo en la transacción y captura del 23505 de `ux_pago_pension_activo` → 409. En la BD local el índice se omitió por duplicados históricos (pensión 139); el 409 se garantiza con el lock |

### H39 — Fechas de negocio calculadas en UTC

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Evidencia | Cuatro pantallas usaban `new Date().toISOString().split('T')[0]` (`docente-asistencia:57`, `admin-asistencia-qr:60`, `admin-alumnos:287`, `admin-personal:283`), que devuelve la fecha UTC; el pool de PostgreSQL no fijaba la zona de sesión |
| Impacto | Entre las 19:00 y 23:59 de Lima, la asistencia, el retiro y el cese se registraban con la fecha del día siguiente |
| Recomendación | Calcular la fecha local con `toLocaleDateString('en-CA')` y fijar `timezone=America/Lima` en las sesiones del pool |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): helper `core/utils/fecha.util.ts` usado en los 4 puntos; `database.js` añade `options: "-c timezone=America/Lima"` y verifica `SHOW timezone` al arrancar (warning si no coincide) |

### H40 — Documentación de instalación incorrecta

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Evidencia | AGENTS §4 y `documentacion/12` indicaban cargar `siga_uc.sql` y después `siga_uc_completo.sql`; este último es un dump completo (esquema + datos + funciones + índices) y falla con “ya existe una función «calcular_nota_final_area»” |
| Impacto | Una instalación nueva siguiendo la documentación no funciona |
| Recomendación | Una sola secuencia oficial: `siga_uc_completo.sql` + migraciones en orden; `siga_uc.sql` solo como referencia |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): `database/README.md`, AGENTS §4, docs 04/12 y HANDOFF actualizados; instalación verificada en `siga_uc_install_test` con 39 tablas e índice `ux_pago_pension_activo` |

---

## 4. Cosas que parecen bugs pero no lo son

| Situación | Explicación |
|---|---|
| Alumno recién creado no aparece en asistencia | Está `PendientePago`; debe pagar matrícula |
| SIAGIE dice “no hay notas” | No se calcularon `notas_finales_area` |
| El correo no llega en local | Resend requiere key/remitente; sin key solo se guarda la notificación |
| La campanita no suena | Solo hay badge; no hay audio |
| “Escanear QR” pide DNI | La UI simula el escaneo con entrada manual |
| El carné muestra código largo | Es el `codigo_qr` determinístico, no el DNI |
| El acta cerrada permite editar | Limitación conocida (H06) |
| El dashboard tiene números como texto | PostgreSQL devuelve `numeric` como string; el frontend usa `Number()` |
| El estudiante puede ver la libreta de otro por API | Limitación de autorización (H01) |
| No hay botón de logout en la API | El logout es local |

---

## 5. Roadmap sugerido

### Fase 1 — Seguridad y confianza (1–2 semanas)

1. H01 autorización por pertenencia/rol en GET.
2. H02 revalidar estado del usuario.
3. H03 rate limiting.
4. ~~H18 cambio obligatorio de contraseña~~ ✅
5. H07 auditoría de eventos críticos.
6. H17 mensajes de error seguros.

### Fase 2 — Integridad académica (1–2 semanas)

1. H04 cálculo de nota final desde UI.
2. H06 bloqueo por acta cerrada.
3. H14 unificar algoritmo.
4. Validar docente-curso y alumno-grado.
5. H13 filtro por año.

### Fase 3 — Integridad financiera (1–2 semanas)

1. H08/H09 validaciones de pago y caja.
2. H10 secuencias.
3. H32 anulación de pagos.
4. UI de pre-tickets, pensiones y becas.
5. H22 endpoint agregado de pensiones.

### Fase 4 — Operación y calidad (2–3 semanas)

1. H24 tests + CI.
2. ~~H25 backups automáticos~~ ✅
3. H23 paginación.
4. H11 errores visibles en lotes.
5. ~~H12 año lectivo configurable~~ ✅
6. H27/H26 documentación y `.env.example`.
7. H05 mapeo SIAGIE configurable.
8. ~~H34 PDFs reales~~ ✅

---

## 6. Estimación global

| Fase | Esfuerzo | Riesgo reducido |
|---|---|---|
| Seguridad | ~10–15 días | Crítico |
| Integridad académica | ~8–12 días | Alto |
| Integridad financiera | ~8–12 días | Alto |
| Operación/calidad | ~15–20 días | Medio |
| **Total** | **~6–10 semanas** | — |

> Las estimaciones son orientativas y asumen un desarrollador familiarizado con el código.
