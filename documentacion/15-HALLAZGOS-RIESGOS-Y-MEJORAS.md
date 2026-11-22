# 15 — Hallazgos, Riesgos y Mejoras

Resultado del análisis del código el 19/11/2026. **No se modificó la aplicación.** Cada
hallazgo incluye evidencia, impacto, recomendación y esfuerzo estimado
(S = <1 día, M = 1–3 días, L = >3 días).

> **Actualización 20/11/2026:** H18 (cambio obligatorio de contraseña) quedó resuelto con
> endpoint autenticado, pantalla `/cambiar-password` y bloqueo backend. H12 (año lectivo y
> conceptos hardcodeados) quedó resuelto con `ANIO_LECTIVO`, `GET /api/configuracion` y
> conceptos dinámicos. H25 (backup) quedó resuelto con `npm run backup`, script Node y guía de
> programación en Render/Supabase. H34 quedó resuelto: libretas, boletas y actas con PDFKit.
> H15 quedó resuelto: mensajes personalizados con destinatarios TODOS/GRADO/ALUMNO —luego
> ampliados a PERSONAL/ROL— y envío por Resend sin perder la notificación si el correo falla.
> **Ampliado 21/11/2026:** admite PERSONAL (ADMIN/DOCENTE/SECRETARIA) y ROL (1, 2 o 3), con
> validación de rol, resumen real en la UI y auditoría con tipo/rol/total.
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
> dinero, `modificado_por` desde el token e índices de bitácora.
>
> **Actualización 21/11/2026 (H07 completa):** se añaden alumnos, personal, académico,
> notificaciones y descargas; H07 queda resuelto.
>
> **Actualización 21/11/2026 (H11):** los guardados masivos informan filas fallidas y la UI
> muestra el detalle; H11 queda resuelto.
>
> **Actualización 22/11/2026 (H50/H63):** la caja separa efectivo y digital (H50) y el PDF
> de actas queda restringido a ADMIN (H63). Ver la sección 3 y
> `18-AUDITORIA-PRODUCCION-2026-11-22.md`.
>
> **Actualización 22/11/2026 (H48/H51):** cierre y reapertura reales de actas, bloqueo
> global y libretas por bimestre. Ver H48/H51 en la sección 3.
>
> **Actualización 22/11/2026 (H61):** el día de la semana se deriva de la fecha en el
> backend, se guarda en español y se corrigieron los datos históricos con una migración
> idempotente. Ver H61 en la sección 3.
>
> **Actualización 22/11/2026 (H56):** la asistencia (historial, resumen, estadísticas,
> libreta, PDF y resumen por grado) filtra por año lectivo; la UI envía `?anio=`.
> H13 también queda resuelto. Ver H56 en la sección 3.
>
> **Actualización 22/11/2026 (H60):** una observación sin estado P/T/F ya no se pierde:
> la UI la bloquea con validación inline. Ver H60 en la sección 3.
>
> **Actualización 22/11/2026 (H57):** el panel del estudiante usa el grado real y los
> cursos de la carga curricular; no felicita si no hay notas. Ver H57 en la sección 3.
>
> **Actualización 22/11/2026 (H53):** los botones Asistencia/Notas del docente navegan a
> sus módulos reales y preseleccionan el curso por query params. Ver H53 en la sección 3.
>
> **Actualización 22/11/2026 (H54):** “Cobrar” en el panel de Secretaría navega a
> Tesorería con el pre-ticket y alumno preseleccionados. Ver H54 en la sección 3.
>
> **Actualización 22/11/2026 (H55):** el carné del personal genera un QR real desde
> `codigo_qr`. Ver H55 en la sección 3.

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
| Estado | ✅ Resuelto (21/11/2026): servicio de auditoría fuera de las transacciones; eventos de seguridad, alumnos, personal, pagos, caja, notificaciones, SIAGIE, cierre de acta y descargas; `modificado_por` desde el token; índices `ix_bitacora_*` |

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
| Estado | ✅ Resuelto (21/11/2026): ambos DAOs devuelven `guardados`, `total_errores` y hasta 20 `errores` con `indice`/`id_alumno`/`mensaje`; validación previa de estado/calificación. La UI muestra banner amarillo “X guardadas, Y fallidas” con detalle expandible y no muestra éxito si hay errores |

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
| Estado | ✅ Resuelto (22/11/2026, H56): `getResumenAsistenciaGrado` filtra `EXTRACT(YEAR FROM asis.fecha) = $2` y recibe el año desde el controller |

### H14 — Dos algoritmos de nota final

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `calificacionDao.calcularNotaFinal` desempata por mejor nota; `calcular_nota_final_area` SQL no |
| Impacto | Resultados distintos según el punto de cálculo |
| Recomendación | Unificar en una sola función/DAO documentado |
| Esfuerzo | S |

### H15 — Envío masivo de notificaciones (resuelto y ampliado)

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | Antes `notificacionService.crearMasivo` solo insertaba; ahora resuelve TODOS/PERSONAL/ROL/GRADO/ALUMNO y envía correos con manejo de fallos |
| Impacto | El ADMIN cree que envió correos y solo llegó la campanita |
| Recomendación | Reutilizar `crear` por destino o enviar en lote |
| Esfuerzo | S |
| Estado | ✅ Resuelto (20/11/2026) y ampliado (21/11/2026): `POST /notificaciones/masivo` con PERSONAL y ROL (roles 1-3), validación de ESTUDIANTE/rol inexistente (400), UI con select de roles y auditoría `ENVIAR` con tipo, `rol_nombre` y total |

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

### H33 - Sin CRUD de horarios, competencias, conclusiones

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | Solo consultas; datos por seed/BD |
| Impacto | La institución no puede mantener su malla desde la UI |
| Recomendación | Módulos de configuración académica |
| Esfuerzo | L |
| Estado | 🟡 Parcial (21/11/2026): **horarios resuelto con H47** (malla, CRUD, generación y publicación). Competencias y conclusiones siguen pendientes |

### H47 - Horarios sin bloqueo, publicación ni generación (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | Alta (IDOR + ausencia de mantenimiento) |
| Evidencia | `GET /api/horarios/grado/:id_grado` accesible a cualquier autenticado; tabla sin año, estado, aula ni UNIQUE de solape |
| Impacto | Cualquier usuario podía leer el horario de otro grado; ADMIN no podía mantener la malla |
| Recomendación | Modelo por bloques, `mi-horario` derivado del token, CRUD ADMIN, publicación estricta y generador en BORRADOR |
| Estado | ✅ Resuelto (21/11/2026): `periodos_clase` por año, `horarios` con `id_carga`/período/estado/aula, UNIQUE de grado/docente/aula, `mi-horario`, publicación con `permitir_parcial`, generador con preflight y auditoría `CREAR/MODIFICAR/ELIMINAR/PUBLICAR/DESPUBLICAR/GENERAR` |
| Verificación | Base desechable: 142 bloques completos en carga coherente; 20 h sin ubicar con docente sobrecargado; 4 PASS del generador; build Angular y E2E |

### H50 — Caja sin separación efectivo/digital (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | **Crítica** (riesgo financiero) |
| Evidencia | `cajaDao.obtenerCajaAbierta` sumaba todos los `INGRESO`/`EGRESO` sin mirar `medio_pago`; la UI usaba ese total para "Efectivo Físico en Cajón"; `cajaDao.cerrar` separaba ingresos pero sumaba todos los `EGRESO` como efectivo; una anulación Yape reducía el efectivo esperado |
| Impacto | Con Yape/transferencia el arqueo podía declarar faltante/sobrante falso; riesgo de descuadre y pérdida |
| Recomendación | Devolver totales separados por medio; calcular `efectivo_esperado` solo con efectivo; reportar `total_digital` aparte |
| Esfuerzo | S/M |
| Estado | ✅ Resuelto (22/11/2026): `/caja/actual` devuelve `total_ingresos_efectivo`, `total_ingresos_digital`, `total_egresos_efectivo` y `total_egresos_digital`; `cerrar` devuelve `egresos_efectivo`, `egresos_digital` y `total_digital`; la UI muestra efectivo y digital por separado |
| Verificación | `test:e2e` 15: efectivo 150, digital 0 (Yape 80 anulado), cierre CUADRADO; 16: efectivo 150, digital 80, cierre CUADRADO |

### H63 — IDOR en el PDF de actas (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | **Alta** (exposición de datos de menores) |
| Evidencia | `GET /api/auditoria/actas/:id_acta/pdf` permitía ADMIN y DOCENTE antes del guard global; el controller no validaba grado ni pertenencia; un docente podía descargar el acta de cualquier grado/año enumerando IDs |
| Impacto | Fuga de nombres, notas y PDF de actas de otros grados; las actas globales incluían todos los grados |
| Recomendación | Restringir a ADMIN; si más adelante DOCENTE debe descargar, aplicar `checkGradoDocente` con `acta.id_grado`; las globales quedan ADMIN-only |
| Esfuerzo | S |
| Estado | ✅ Resuelto (22/11/2026): la ruta quedó detrás del `checkRole(["ADMIN"])` global |
| Verificación | `test:e2e` 17: ADMIN 200 (PDF), DOCENTE 403, sin token 401 |

### H48 — Actas sin creación real ni bloqueo global (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | **Crítica** (integridad académica) |
| Evidencia | `cerrarActa` solo hacía `UPDATE`; una base nueva sin actas devolvía 500. `actaEstaCerrada` ignoraba las actas globales, que la UI mostraba como "Acta Firmada". El seed de producción no crea actas. |
| Impacto | El cierre de bimestre no se podía ejecutar en una base nueva y, en la demo, las notas seguían editables con actas globales cerradas. |
| Recomendación | Migración H48 con `bimestre`, reapertura y unicidad por año/bimestre/grado; `INSERT ... ON CONFLICT`; bloqueo global; reapertura auditada. |
| Esfuerzo | M |
| Estado | ✅ Resuelto (22/11/2026): `database/migracion_h48_actas.sql` (idempotente); `actas_bimestrales.bimestre` 1-4, `reabierto_por`, `fecha_reapertura`, `motivo_reapertura`; índice único `uq_acta_anio_bimestre_grado` `NULLS NOT DISTINCT`; `POST /actas/cerrar` crea o cierra; `POST /actas/:id/reabrir`; `actaEstaCerrada` bloquea si el acta global está `CERRADO`; auditoría `CERRAR`/`REABRIR`. |
| Verificación | `test:e2e` 14: cierre real 200, nota 409, reapertura 200, nota 201; 18: global bloquea 1ro y 5to, reabrir libera; 19: doble cierre 409, motivo corto 400, DOCENTE/SECRETARIA 403, sin token 401. UI: cierre 2do grado 2do bimestre, badge, nota 409, reapertura y nota 200. Migración ejecutada dos veces. |

### H51 — Libretas fijas al II Bimestre (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `AdminReportesComponent` ocultaba el selector de bimestre en la pestaña de libretas y mantenía `bimestre = 2`; la tabla y el PDF usaban ese valor fijo. |
| Impacto | No se podían consultar ni descargar libretas de I, III o IV bimestre. |
| Recomendación | Mostrar el selector en todas las pestañas y usar `this.bimestre()` en tabla, encabezado y PDF; estado vacío claro. |
| Esfuerzo | S |
| Estado | ✅ Resuelto (22/11/2026): selector visible en libretas, valor por defecto 2, PDF y encabezado usan el bimestre elegido; aviso cuando no hay calificaciones. |
| Verificación | UI local: I, III y IV; encabezado y PDF con `?bimestre=1/3/4`; estado vacío en un bimestre sin notas. |

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
| Recomendación | Dos secuencias excluyentes: demo (`siga_uc_completo.sql` + migraciones) y producción (`siga_uc.sql` + `seed_produccion.sql` + migraciones); nunca mezclarlas |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): `database/README.md`, AGENTS §4, docs 12 y HANDOFF actualizados; instalación de producción verificada en `siga_uc_prod_test` con 39 tablas e índice `ux_pago_pension_activo` |

### H41 — Datos de demostración mezclados con la instalación de producción

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Evidencia | `siga_uc_completo.sql` es el único dump documentado y contiene 21 alumnos ficticios y más de 140 pensiones `PAGADO` sin pago (144 medidas por `test:integridad`); usarlo en producción deja datos operativos falsos desde el día uno |
| Impacto | Reportes, caja, pensiones y SIAGIE contaminados con información ficticia; difícil de distinguir y limpiar |
| Recomendación | Separar el seed de demo del de producción: catálogos + un admin inicial, sin datos operativos |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): `database/seed_produccion.sql` (roles, grados, cursos, competencias, escala, conceptos, carga, caja y admin con cambio obligatorio); `test:integridad` corregido para no marcar al ADMIN; verificado en `siga_uc_prod_test` con 10 PASS y 0 alumnos/pagos/pensiones |

### H43 — Resets de contraseña por ADMIN sin auditoría

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `authController.resetPassword` (por DNI) y `personalController.resetPassword` (por id de personal) actualizaban `password_hash` y `requiere_cambio_password` sin registrar el evento en `bitacora_auditoria` |
| Impacto | No había trazabilidad de quién ejecutó un reset, sobre qué usuario ni cuándo; difícil investigar accesos indebidos o errores operativos |
| Recomendación | Registrar `RESET_PASSWORD` en `Seguridad` con el DNI y el `id_usuario_afectado`; nunca guardar la contraseña temporal ni el hash |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): ambos endpoints auditan `RESET_PASSWORD`; la UI de auditoría tiene icono, estilo y filtro para la acción. Verificado con 4 PASS, resets por DNI y por personal, 403 de DOCENTE sin auditoría y 0 contraseñas/hashes en la bitácora |

### H44 — Alumnos nuevos sin pensiones

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Evidencia | Al pagar matrícula el alumno pasaba a `Matriculado`, pero no se generaba ninguna fila en `pensiones`; el único generador era el mensual global y el frontend nunca lo llamaba |
| Impacto | Alumnos matriculados con 0 pensiones: imposible cobrarles desde la UI y sin cronograma para el año |
| Recomendación | Generar el cronograma por alumno dentro de la misma transacción de pago de matrícula, con endpoint manual idempotente para regularizar alumnos existentes |
| Esfuerzo | M |
| Estado | ✅ Resuelto (21/11/2026): `generarPensionesAlumno` crea desde el mes de `fecha_creacion` hasta diciembre, solo meses con concepto `PENSION` y con beca; se ejecuta al matricular y desde el botón manual. Verificado: Nov/Dic automáticos, marzo-diciembre 10, idempotencia, pagos fuera de orden, rollback total y UI con “Generar pensiones”/“Al día” |

### H45 — Pensiones y pre-tickets futuros quedan como deuda al retirar

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Evidencia | `alumnoDao.retirar` marcaba al alumno `Retirado`, pero no anulaba las pensiones `PENDIENTE` de meses futuros ni los `pre_tickets PENDIENTE`; el estado `ANULADO` no existía para pensiones |
| Impacto | Alumnos retirados seguían apareciendo con deuda futura y pre-tickets cobrables para siempre |
| Recomendación | Anular pensiones futuras y pre-tickets pendientes en la misma transacción; pensión del mes de retiro se mantiene; permitir restaurar `ANULADO` al regenerar |
| Esfuerzo | M |
| Estado | ✅ Resuelto (21/11/2026): migración H45 (CHECK + backfill), retiro transaccional con conteos y auditoría, pago rechaza `ANULADO`, generador restaura `ANULADO` y UI muestra “Anulada”/“Retirado”. Verificado con 8 PASS de API + UI y migración ejecutada dos veces |

### H46 — Especialidad y rol del personal desalineados

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | El formulario mostraba “Especialidad” para todos los roles; `personalDao` guardaba cualquier valor y `COALESCE` impedía borrarla; el selector de roles incluía ESTUDIANTE |
| Impacto | ADMIN/SECRETARIA con especialidad incoherente, datos históricos que no se limpiaban y posibilidad de crear personal con rol ESTUDIANTE |
| Recomendación | Especialidad exclusiva de DOCENTE; backend valida roles 1-3 y limpia la especialidad de los demás; UI filtra ESTUDIANTE y muestra el campo solo para docentes |
| Esfuerzo | S |
| Estado | ✅ Resuelto (21/11/2026): `personalService` valida roles 1-3, `personalDao.crear` guarda especialidad solo para DOCENTE y `personalDao.actualizar` la limpia al cambiar de rol; UI condiciona el campo y filtra roles. Verificado con 8 PASS de API y UI (alta ADMIN/SECRETARIA/DOCENTE, cambio DOCENTE→ADMIN, selector sin ESTUDIANTE, lista y cese). Datos existentes no se modificaron: en local hay **1** usuario no docente con especialidad |

### H61 — Día de la semana desfasado y en inglés

| Campo | Detalle |
|---|---|
| Severidad | Baja |
| Evidencia | La UI calculaba el día con `new Date('YYYY-MM-DD').getDay()` (UTC) y el DAO usaba `TO_CHAR(fecha,'Day')` (inglés) |
| Impacto | Asistencias de lunes podían guardarse como domingo y el historial mostraba “Monday/Martes” en una UI en español |
| Recomendación | Parsear la fecha como local, derivar `dia_semana` en el backend con `EXTRACT(ISODOW)` y normalizar los datos históricos |
| Esfuerzo | S |
| Estado | ✅ Resuelto (22/11/2026): `fecha.util.parseFechaLocal`/`diaSemanaLocal`; `asistenciaDao` calcula y actualiza `dia_semana` en español tanto en el alta individual como en el masivo; la UI muestra el día en español. Migración idempotente `migracion_h61_dia_semana.sql`: en local corrigió **12** filas (6 días desfasados y 6 en inglés; 2 ya estaban correctas). Verificado por API: se envió `dia_semana="Domingo"` para el lunes 2026-11-23 y la BD/API devolvieron `Lunes` |

### H56 — La asistencia no filtra por año lectivo

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Evidencia | La libreta (`reporteDao.getLibretaAlumno`) y el historial/resumen del alumno (`asistenciaDao`) no filtraban por año; la UI no enviaba `?anio=` |
| Impacto | En 2027 la libreta y “Mi Asistencia” sumaban registros de 2026; porcentajes e historial contaminados |
| Recomendación | Filtrar por `EXTRACT(YEAR FROM fecha)` en todas las consultas de asistencia y enviar `?anio=` desde la UI |
| Esfuerzo | M |
| Estado | ✅ Resuelto (22/11/2026): historial, resumen, estadísticas, libreta, PDF y resumen por grado filtran por año; sin `?anio=` se usa `ANIO_LECTIVO` y un valor explícito tiene prioridad. La UI de “Mi Asistencia”, la ficha del docente y la libreta envían el año. Verificado en base desechable con 2026/2027: 2027 devolvió solo 2027 (1 registro) y 2026 solo 2026 (9 registros); libreta y resumen por grado coincidieron |

### H60 — Observación sin estado de asistencia se pierde

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | La UI creaba el cambio con `estado: ''` y al guardar solo enviaba registros con estado; la observación se descartaba |
| Impacto | El docente escribía una justificación sin marcar P/T/F y, al recargar, la observación desaparecía |
| Recomendación | Exigir estado cuando hay observación y mostrar validación inline; el backend mantiene la validación P/T/F |
| Esfuerzo | S |
| Estado | ✅ Resuelto (22/11/2026): si hay observación sin estado, la fila se marca en rojo y el guardado se bloquea con un mensaje inline; si hay estado, la observación se envía y persiste. El backend no se relajó: sigue rechazando estados distintos de P/T/F |

### H53 — Botones “Asistencia” y “Notas” del docente solo mostraban alerts

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `docente-dashboard.component.ts` lanzaba `alert("próximamente")` aunque las rutas `/docente/asistencia` y `/docente/notas` ya existían |
| Impacto | El docente no podía iniciar la tarea desde el panel y creía que el módulo no existía |
| Recomendación | Navegar a las rutas reales pasando el curso/grado y preseleccionarlo en destino |
| Esfuerzo | S |
| Estado | ✅ Resuelto (22/11/2026): los botones navegan con `id_curso` e `id_grado`; Asistencia y Notas leen los query params y seleccionan ese curso, con fallback al primero |

### H54 — “Cobrar” un pre-ticket en el panel de Secretaría solo mostraba un alert

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Evidencia | `secretaria-dashboard.component.ts` mostraba `alert("Cobro del pre-ticket ... próximamente")`; el cobro real ya existía en `secretaria-tesoreria` |
| Impacto | La acción principal de la bandeja de matrículas pendientes no cobraba nada y obligaba a ir manualmente a Tesorería |
| Recomendación | Navegar a `/secretaria/tesoreria` con `id_alumno` e `id_preticket` y reutilizar el flujo de cobro existente |
| Esfuerzo | S |
| Estado | ✅ Resuelto (22/11/2026): el dashboard navega con ambos IDs; Tesorería espera la carga de alumnos/pre-tickets, busca el pre-ticket y abre el modal de cobro existente. No se duplicó la lógica de pago |

### H55 — El carné QR del personal mostraba un icono, no un QR

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Evidencia | `admin-personal.component.html` mostraba `<i class="fa-solid fa-qrcode">`; el componente no importaba `qrcode` ni leía `credencial_qr` |
| Impacto | La credencial impresa no se podía escanear; parecía un carné real sin serlo |
| Recomendación | Obtener `codigo_qr` del backend y generar un `<img>` con `QRCode.toDataURL` |
| Esfuerzo | S |
| Estado | ✅ Resuelto (22/11/2026): `GET /personal` y `GET /personal/:id` incluyen `codigo_qr`; el modal genera el QR real con la librería del header y lo muestra como `<img>`. Verificado contra el `codigo_qr` de la BD |

### H57 — Panel del estudiante engañoso

| Campo | Detalle |
|---|---|
| Severidad | Alta |
| Evidencia | El sidebar fijaba “3ro de Secundaria”; la felicitación era fija; “Cursos Matriculados” usaba `cursos().length` (cursos con notas) |
| Impacto | Un alumno de 2do veía 3ro en el sidebar y 0 cursos aunque tuviera 11 en su carga; se lo felicitaba sin notas |
| Recomendación | Usar el grado real del perfil y los cursos de la carga curricular; condicionar la felicitación a que existan notas |
| Esfuerzo | S |
| Estado | ✅ Resuelto (22/11/2026): sidebar con `info_adicional.nombre_grado`; KPI desde `GET /carga-curricular?id_grado=&anio=`; mensaje neutral sin notas. Verificado con el alumno de 2do `74829103`: sidebar “2do de Secundaria”, panel “Cursos Matriculados 11”, mensaje neutral y horario “2do de Secundaria Única” |

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
