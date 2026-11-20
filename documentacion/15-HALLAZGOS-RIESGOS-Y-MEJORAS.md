# 15 — Hallazgos, Riesgos y Mejoras

Resultado del análisis del código el 19/11/2026. **No se modificó la aplicación.** Cada
hallazgo incluye evidencia, impacto, recomendación y esfuerzo estimado
(S = <1 día, M = 1–3 días, L = >3 días).

> **Actualización 20/11/2026:** H18 (cambio obligatorio de contraseña) quedó resuelto con
> endpoint autenticado, pantalla `/cambiar-password` y bloqueo backend. H12 (año lectivo y
> conceptos hardcodeados) quedó resuelto con `ANIO_LECTIVO`, `GET /api/configuracion` y
> conceptos dinámicos. H25 (backup) quedó resuelto con `npm run backup`, script Node y guía de
> programación en Render/Supabase. H34 quedó **parcial**: libretas en PDF con PDFKit; boletas y
> actas siguen pendientes.

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

### H02 — El estado del usuario no se revalida en cada petición

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | `authMiddleware.verificarAutenticacion` solo verifica el JWT; `authService.login` valida estado |
| Impacto | Un usuario cesado conserva acceso hasta 8 h |
| Recomendación | Consultar `usuarios.estado` en el middleware (con caché corta) o incluir versión de sesión |
| Esfuerzo | S |

### H03 — Sin rate limiting ni bloqueo por intentos

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | No hay `express-rate-limit` ni contador de intentos |
| Impacto | Fuerza bruta sobre DNI/contraseña y recuperación |
| Recomendación | Limitar `/auth/login`, `/auth/recuperar-password` y `/auth/validar-token`; bloqueo temporal |
| Esfuerzo | S |

### H04 — La nota final no se calcula automáticamente desde la UI

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | `POST /api/calificaciones/notas-finales` existe; ningún componente lo llama. Reportes y SIAGIE leen `notas_finales_area` |
| Impacto | Libretas, mérito, riesgo y SIAGIE pueden salir vacíos aunque los docentes hayan registrado competencias |
| Recomendación | Botón “Calcular notas finales” por curso/bimestre o cálculo automático tras guardar; job de cierre |
| Esfuerzo | M |

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

### H07 — Auditoría incompleta y con usuario NULL

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | Solo `trg_calificaciones_audit`; el frontend no envía `modificado_por`; no se audita login, pagos, caja, matrícula |
| Impacto | Sin trazabilidad real; la bitácora no sirve para investigación |
| Recomendación | Servicio de auditoría central, tomar usuario del token, auditar eventos críticos |
| Esfuerzo | M |

### H08 — Pagos se imputan a una caja posiblemente cerrada

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | `trg_pago_a_caja` toma la última apertura sin comprobar cierre |
| Impacto | Movimientos en cajas cerradas; descuadre y reportes inconsistentes |
| Recomendación | Verificar apertura sin cierre; si no hay, rechazar pago o registrar pendiente |
| Esfuerzo | S |

### H09 — El pago no valida monto, concepto ni caja

| Campo | Detalle |
|---|---|
| Severidad | **Alta** |
| Evidencia | `tesoreriaService.registrarPago` valida presencia y existencia, no coherencia |
| Impacto | Se puede pagar S/1 una pensión de S/250 o pagar una pensión de otro alumno |
| Recomendación | Validar monto contra pensión/concepto, pertenencia alumno-pensión y caja abierta |
| Esfuerzo | M |

### H10 — Concurrencia en códigos y boletas

| Campo | Detalle |
|---|---|
| Severidad | **Media/Alta** |
| Evidencia | `getSiguienteCodigo` usa `MAX+1`; `registrarPago` usa `MAX(numero)+1` |
| Impacto | Dos matrículas/pagos simultáneos pueden colisionar; un fallo revierte la transacción |
| Recomendación | Secuencias PostgreSQL o `SELECT ... FOR UPDATE` |
| Esfuerzo | S |

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

### H15 — Envío masivo de notificaciones no envía correos

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `notificacionService.crearMasivo` llama a `notificacionDao.crearMasivo`, que inserta sin pasar por `emailService` |
| Impacto | El ADMIN cree que envió correos y solo llegó la campanita |
| Recomendación | Reutilizar `crear` por destino o enviar en lote |
| Esfuerzo | S |

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

### H18 — Cambio obligatorio de contraseña (resuelto)

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | El flag se guarda y devuelve, pero no hay pantalla ni bloqueo |
| Impacto | Contraseñas temporales pueden quedar indefinidamente |
| Recomendación | Pantalla obligatoria post-login y bloqueo de otras rutas |
| Esfuerzo | M |
| Estado | ✅ Resuelto (20/11/2026): endpoint `PUT /api/auth/cambiar-password`, pantalla `/cambiar-password`, redirect en guards y bloqueo API |

### H19 — Retiro no congela expediente ni usuario

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `alumnoDao.retirar` solo actualiza `alumnos`; el mensaje dice “expediente congelado” |
| Impacto | Usuario retirado puede iniciar sesión y consultar; expediente queda abierto |
| Recomendación | `expediente_alumno.congelado = true` y `usuarios.estado = INACTIVO` (o CESADO) |
| Esfuerzo | S |

### H20 — Edición de alumno no sincroniza usuario

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `alumnoDao.actualizar` no toca `usuarios` |
| Impacto | Login/perfil muestran nombres antiguos; correos desactualizados |
| Recomendación | Actualizar usuario en la misma transacción |
| Esfuerzo | S |

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

### H23 — Listas sin paginación

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | Alumnos, personal, pagos, pre-tickets, bitácora (200 fijo) |
| Impacto | Rendimiento y usabilidad con datos reales |
| Recomendación | Paginación server-side y filtros indexados |
| Esfuerzo | M |

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

### H32 — Anulación de pagos sin UI

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | `pagos.estado` admite `ANULADO`, pero no hay endpoint ni pantalla |
| Impacto | Errores de cobro no se pueden corregir |
| Recomendación | Endpoint de anulación con reversión de caja/pensión y auditoría |
| Esfuerzo | M |

### H33 — Sin CRUD de horarios, competencias, conclusiones

| Campo | Detalle |
|---|---|
| Severidad | Media |
| Evidencia | Solo consultas; datos por seed/BD |
| Impacto | La institución no puede mantener su malla desde la UI |
| Recomendación | Módulos de configuración académica |
| Esfuerzo | L |

### H34 — Sin PDFs reales (libretas resueltas)

| Campo | Detalle |
|---|---|
| Severidad | Baja |
| Evidencia | `window.print()` en libretas; boletas/actas siguen pendientes |
| Impacto | Depende del navegador; no hay archivo firmado |
| Recomendación | `pdfkit`/Puppeteer para libretas, boletas y actas |
| Esfuerzo | M |
| Estado | 🟡 Parcial (20/11/2026): libretas con PDFKit; boletas y actas pendientes |

### H35 — Estudiantes sin pantalla de libreta

| Campo | Detalle |
|---|---|
| Severidad | Baja |
| Evidencia | El endpoint `/reportes/libreta/:id` está abierto a autenticados, pero el panel del estudiante no lo usa |
| Impacto | Funcionalidad disponible pero no visible |
| Recomendación | Añadir “Mi libreta” con validación de pertenencia |
| Esfuerzo | S |

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
8. ~~H34 PDFs reales~~ 🟡 (libretas resueltas; boletas/actas pendientes).

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
