# HANDOFF_SESSION.md — SIGA-UC

> **Fase actual: demostración y aprobación.** SIGA-UC se muestra a la dirección del
> colegio; **no es producción real**. Nada de dominios, DNS, planes pagos ni datos de
> menores hasta que la dirección apruebe. Alcance completo en la sección 0.
>
> **Cierre de sesión 22/11/2026:** HEAD `9a29122`; frontend/API desplegados en Render con
> el código `df1f384` (login, sidebar y módulos del ESTUDIANTE responsive). E2E **75 PASS**,
> integridad **21 PASS** en base nueva (19/2 local), smoke **11**, H47 **4**, build OK.
> Supabase intacto: 43 tablas, 2026 ACTIVO, 2027 no activo, 1 política, 0 promociones,
> 0 actas, 1 alumno. **Siguiente bloque:** responsive de ADMIN/SECRETARÍA/DOCENTE.
> Prompt de arranque en la sección 10.
>
> **Actualización 22/11/2026 (despliegue `df1f384`):** módulos del **ESTUDIANTE**
> adaptados a móviles, tabletas y laptops: drawer de navegación, cabecera compacta,
> dashboard, asistencia y horario responsive; tablas con scroll interno y horario con
> columna de horas fija. E2E **75 PASS** y build OK. Ver sección 1.10.
>
> **Actualización 22/11/2026 (despliegue `c098f02`):** sidebar con menú de scroll propio,
> marca fija y bloque de usuario/cerrar sesión siempre visible; compactación automática en
> pantallas bajas. Aplicado a ADMIN, SECRETARÍA, DOCENTE y ESTUDIANTE. Código subido a
> GitHub y desplegado en Render; `test:e2e` **75 PASS**. Ver sección 1.9.
>
> **Actualización 22/11/2026 (despliegue `e1c3ada`):** login adaptado a celulares,
> tabletas, plegables, laptops y escritorio; modal de recuperación con scroll interno y
> botones táctiles. Código subido a GitHub y desplegado en Render (frontend y API).
> `test:e2e` **75 PASS** tras el cambio. Ver sección 1.8.
>
> **Actualización 22/11/2026 (cierre de demo):** SIAGIE quedó como **exportación interna**
> honesta (sin portal MINEDU, sin análisis simulado y sin carga de plantilla); incluye
> **todos los cursos** del grado/año (H05), nota final y conclusión, con aviso visible.
> **H70 cerrado** (sin `nodemailer`, `multer` ni SMTP; logs sin PII) y **H71 implementado**
> (backfill de retirados; aplicado en local). UAT de los 4 roles en local; Supabase solo
> para previews. `test:e2e` **75 PASS**, integridad **21 PASS** en base nueva (19/2 en
> local), smoke 11, H47 4 y build Angular OK. Ver sección 1.7.
>
> **Actualización 22/11/2026 (Fase 7 desplegada):** pulido de demo con H62 (DOCENTE ya no
> envía notificaciones), H59 (observaciones de cese; **aplicada en Supabase demo**), H65
> (docentes vs. personal activo), H66 (panel de cobranza y expedientes), H67 (grados/cursos
> desde la API), H68 (hash de integridad, no firma digital) y H69 (textos, `lang="es"` y
> títulos por ruta). Código `8eba9e9`; frontend de Render ya sirve los textos nuevos.
> `test:e2e` **72 PASS**, integridad **20 PASS** en base nueva. Ver sección 1.6.
>
> **Actualización 22/11/2026 (Fase 6.4 desplegada):** histórico por año con selector en
> reportes, padrón y tesorería; modo de solo lectura en años no activos; consolidado por
> DNI/`id_usuario` con notas, asistencia, pagos, deuda y promoción; pantalla ADMIN
> `/admin/historico` y validación `404 MATRICULA_NO_ENCONTRADA_EN_ANIO` en endpoints
> históricos. **Sin migración y sin cambios en Supabase.** `test:e2e` **65 PASS**, integridad
> **20 PASS** en base nueva. Desplegada en Render (`cdc129e`). Ver sección 1.5.
>
> **Próximo bloque:** demo y aprobación. **H59 ya está aplicada en Supabase demo**;
> 2026 sigue activo, 2027 no se activa y no hay promociones confirmadas. No iniciar Fase 8
> ni cargar datos reales. `test:e2e` **75 PASS**. Ver secciones 1.7 y 1.8.
>
> **Actualización 22/11/2026 (Fases 6.3 y 6.3.1 desplegadas):** promoción anual con
> política configurable, preview por alumno y hash, confirmación transaccional e idempotente,
> egresados/repitentes/retirados/traslados y anulación con reversa. Migración H73
> (`promociones`, `politicas_promocion`; 43 tablas base), API `/api/promociones` y pantalla
> ADMIN `/admin/promociones`. **H49 y H73 están aplicadas en Supabase demo**; **6.3/6.3.1
> desplegadas en Render (`89eba24`)**. `test:e2e` **58 PASS** e integridad **20 PASS** en base
> nueva. Supabase: 43 tablas, 2026 ACTIVO, 1 política, 0 promociones, 0 actas, 145 horarios y
> 5 docentes. Ver secciones 1.3 y 1.4.
>
> **Próximo bloque de trabajo:** cierre de demo/UAT. 6.4 y Fase 7 ya están desplegadas;
> H59 aplicada en Supabase. No activar 2027 en Supabase demo sin aprobación del colegio; el
> flujo completo de promoción se prueba en local/E2E.
>
> **Actualización 22/11/2026 (Fase 6.2 desplegada):** rollover anual con preview de solo
> lectura y hash, clonado transaccional e idempotente de grados, conceptos, períodos, carga
> y tutores, activación auditada con un solo año ACTIVO y reversión de un rollover vacío.
> Pantalla ADMIN `/admin/anios-lectivos` y API `/api/anios-lectivos`. Commits `a670c06`
> (backend), `44bf200` (UI), `9b3ea6f` (tests) y cierre `f05ecc5`; **desplegado en Render**.
> **H49 aplicada en Supabase; 2026 sigue activo allí.** `test:e2e` **38 PASS** e integridad
> **16 PASS** en base nueva. Ver sección 1.2.
>
> **Próximo bloque de trabajo:** Fase 6.4 (histórico). H49/H73 ya están aplicadas en
> Supabase demo. No activar 2027 en producción/demo sin aprobación.
> H64 (`/* → /index.html`, 200) sigue como configuración de Render.
>
> **Actualización 22/11/2026:** **H50** (caja separa efectivo y digital) y **H63** (PDF de
> actas solo ADMIN) desplegados en Render con `3052f44`; **H48** (cierre/reapertura real de
> actas y bloqueo global) y **H51** (libretas por bimestre) desplegados con `9648689`.
> La migración H48 ya está aplicada en Supabase (4 columnas nuevas + índice
> `uq_acta_anio_bimestre_grado`, 0 actas). `test:e2e` quedó en **19 PASS**.
> **H61** (día de la semana) cerrado en local el 22/11/2026; su migración de datos es
> idempotente y aún **no** se aplicó en Supabase. **H56** (asistencia por año), **H60**
> (observación sin estado) y **H57** (panel del estudiante) también quedaron cerrados en
> local el 22/11/2026. La Fase 3 está completa en local; falta desplegar.
>
> **Fase 4 (credibilidad de la UI):** H53, H54, H55, H58 y H72 cerrados en local el
> 22/11/2026. H64 es solo configuración de Render. Ver sección 3 y la verificación de la
> Fase 4.

---

## 0. Fase actual: demostración y aprobación

**Objetivo:** demostrar el sistema a la dirección del colegio y obtener su aprobación.
En esta fase **no** se prepara el despliegue definitivo.

### Alcance permitido

- Entorno local (Windows + PostgreSQL 18).
- Render con servicios gratuitos.
- Supabase con plan gratuito.
- Datos ficticios o de prueba.
- Notificaciones internas (campanita).
- Smoke test, `test:integridad` y `test:e2e`.

### Fuera de alcance hasta la aprobación

- Comprar o registrar dominios.
- Modificar DNS de cualquier dominio.
- Configurar un dominio real en Resend o usar el dominio del colegio (no está
  confirmado ni autorizado).
- Contratar planes pagos: Render Starter, Supabase pago o Resend pago.
- Cargar datos reales de alumnos, apoderados o personal.
- Servidores corporativos del colegio o de la empresa.
- Integrar pasarelas de pago (Edpago u otras).

### Reglas de Resend en esta fase

- Remitente de prueba: `SIGA-UC <onboarding@resend.dev>`.
- **No** cambiar `EMAIL_FROM` a un dominio no verificado.
- En modo prueba el correo solo llega a la cuenta dueña de Resend. La notificación
  siempre se guarda y se ve en la campanita aunque el correo falle.
- El modal de Nueva Notificación muestra el aviso de modo prueba.

### Reglas de datos y migraciones

- Solo datos ficticios o de prueba; nunca información real de menores.
- Supabase `siga-uc-prod` es **de prueba**, aunque su nombre diga “prod”; puede pausarse
  por inactividad y no ofrece garantías de producción.
- **Un `git push` no aplica migraciones.** Cualquier cambio de esquema se aplica a mano
  en Supabase (SQL Editor) con un archivo idempotente en `database/`.
- Los datos de prueba deben poder limpiarse al terminar la demo (ver
  `documentacion/17-GUION-DEMOSTRACION.md`).

---

## 1. Cierre de sesión

- **Fecha:** 21/11/2026 (actualizado 22/11/2026)
- **Commit base de esta sesión:** `22e06f6 fix(alumnos): anular pensiones y pretickets futuros al retirar (H45)`
- **Código desplegado en Render (backend y frontend Live):** `9648689` (22/11/2026).
  Incluye **H50/H63** (`2449cf3`, desplegados con `3052f44`) y **H48/H51** (`d9071e5`).
- **Último commit de datos demo:** `a9acf24` (solo `database/`; no redepliega).
- **Commits de cierre:** `9648689` (docs) y `d9071e5` (código H48/H51).
- **Commits de esta sesión:** aviso de correo en modo prueba, documentación de la fase de
  demostración, **H47** (esquema+CRUD `cf3c988`, generador `e65f60f`, UI `65e73a3`),
  **datos demo H47** (`a9acf24`), **H50/H63** (`2449cf3`, desplegados con `3052f44`) y
  **H48/H51** (`d9071e5`, desplegados con `9648689`).
- **Commits Fase 3 (local, 22/11/2026):** H61 `269e1ae`, H56 `15aab48`, H60 `410b35d`,
  H57 `2cf8477`. No modifican el esquema; solo H61 trae una migración de datos idempotente.
- **Commits Fase 4 (local, 22/11/2026):** H53 `6c7c5ff`, H54 `e030432`, H55 `24ddbc3`,
  H58 `eed93b6` + ajuste de impresión `8bea060`, H72 `e58feca`. Sin cambios de esquema.
- **Estado:** demo desplegada y actualizada; Supabase tiene H47 y H48 aplicados y los datos
  demo cargados. La base local quedó limpia y el script demo probado.
- **Datos demo H47:** `database/demo_h47_docentes.sql` crea solo los docentes que faltan
  según las cargas existentes. En local, con la distribución original de 4 docentes, crea
  únicamente a **Docente Demo 1** (`99000001`, contraseña `99000001`). En Supabase creó
  **Docente Demo 1–5** (`99000001`–`99000005`, contraseña = DNI). Tras la limpieza local,
  todas las cargas quedaron en ADMIN; una nueva ejecución en local detectará 0 docentes con
  carga y creará los 5.
- **Verificación H47:** base desechable con 142 bloques completos en carga coherente; 20 h
  sin ubicar con docente sobrecargado; `test:h47-generador` **4 PASS**; E2E **19 PASS**
  (incluye H48, H50, H51 y H63); build Angular OK. La UI se probó en navegador con ADMIN,
  SECRETARIA, DOCENTE y ESTUDIANTE.
- **Verificación Fase 3 (22/11/2026, local):** `test:e2e` **19 PASS** tras H61, H56, H60 y
  H57; build Angular OK y `node --check` OK. H61: migración idempotente normalizó 12 filas
  (6 días desfasados + 6 en inglés; 2 ya correctas) y una prueba API con `dia_semana`
  incorrecto guardó/leyó `Lunes`. H56: base desechable con 2026/2027 devolvió solo el año
  pedido en historial, resumen, libreta y resumen por grado. H60: navegador real, sin
  estado no hubo POST y con “Presente” la observación persistió. H57: alumno `74829103`
  (2do) mostró sidebar “2do de Secundaria”, KPI 11, mensaje neutral y horario coherente.
- **Verificación Fase 4 (22/11/2026, local):** `test:e2e` **19 PASS**, build Angular OK y
  `node --check` OK. Prueba real con los 4 roles: DOCENTE navegó a Asistencia/Notas con
  `id_curso=5&id_grado=1` y curso preseleccionado; SECRETARÍA abrió Tesorería con
  `id_preticket=1&id_alumno=1` y el modal del alumno correcto; ADMIN vio el QR real
  (`QR-50182736-...`, idéntico a BD) en `<img>` y descargó la libreta PDF (`%PDF`, 3570
  bytes); ESTUDIANTE mantuvo su panel de 2do y recibió 404 en ruta inexistente. La vista
  de impresión quedó sin sidebar/header/filtros en reporte, carné y cierre de caja. Login
  con `returnUrl` volvió a `/docente/asistencia?id_curso=1&id_grado=1`. Deep link directo
  en local respondió **200**; no depende de `404.html` (H64 queda para Render).
- **Verificación datos demo H47 (21/11/2026):** script ejecutado dos veces sin duplicados;
  local **54 cargas/142 h**, docentes 30/30/30/27/25; generación **142/142**, 0 sin ubicar;
  2do y 3ro publicados; Demo 1 vio 12 bloques en dos grados; alumno de 2do vio solo su grado
  y solo PUBLICADO; limpieza dejó **54 cargas en ADMIN, 0 usuarios/personal/QR demo,
  0 horarios y backup de 13 filas intacto**.
- **Verificación local previa:** `npm run smoke` **11 PASS** (exit 0), `npm run test:e2e`
  **19 PASS** (exit 0) e integridad **8 PASS / 2 FAIL** esperados del seed. Notificación
  sin correo: guardada y visible en la campanita. La contraseña del ADMIN local se alineó
  con `SMOKE_ADMIN_PASSWORD` de `.env` (no se documentó). **La contraseña del ADMIN de
  producción es la real del dueño y NO está en `.env`.**
- **H50/H63 (22/11/2026):** `/caja/actual` devuelve totales de efectivo y digital por
  separado; el cierre usa solo efectivo para `efectivo_esperado` y reporta `total_digital`.
  El PDF de actas quedó restringido a ADMIN. Verificación `test:e2e` 15/16/17 PASS.
- **H48/H51 (22/11/2026):** migración `migracion_h48_actas.sql` con `bimestre`,
  reapertura y UNIQUE por año/bimestre/grado; cierre con `INSERT ... ON CONFLICT`;
  acta global `CERRADO` bloquea todos los grados; reapertura con motivo auditada. Libretas
  con selector de bimestre 1-4 y PDF por bimestre. Verificación `test:e2e` 14/18/19 PASS y
  UI local.

### 1.1 Fase 6.1 — Multi-año base (22/11/2026, solo local)

- **Alcance:** identidad vs. matrícula anual, sin promociones ni rollover. `promociones`
  queda para 6.2/6.3; `TRASLADADO` no se agregó (se usa `RETIRADO` +
  `alumnos.condicion='Traslado'`).
- **Migración:** `database/migracion_h49_multianio_base.sql` crea `anios_lectivos`, agrega
  `grados.orden`, reemplaza los UNIQUE globales por `(dni, año)`, `(id_usuario, año)` y
  `(codigo_estudiante, año)`, y agrega índices operativos. Es idempotente, usa
  `_param_anio`/`current_setting` (sin variables `psql`) y se pega en SQL Editor.
  Antes de aplicarla, editar `_param_anio` al año de la instalación (`2026` en demo,
  `2027` en producción).
  `database/rollback_h49_multianio_base.sql` es solo para bases desechables.
- **Año activo:** `config/academico.js` carga `anios_lectivos.estado='ACTIVO'` al arrancar
  (`cargarAnioActivo`), mantiene `getAnioLectivo()` síncrona y usa `ANIO_LECTIVO` como
  respaldo. `setAnioActivo`/`refrescarAnioActivo` quedan para 6.2.
- **Login:** un ESTUDIANTE sin matrícula del año activo entra con `matricula_activa=false`;
  los endpoints académicos propios responden `403 SIN_MATRICULA_ACTIVA`. La matrícula se
  resuelve por año, no “la primera” del usuario.
- **Consultas:** alumnos, grados, asistencia, calificaciones, reportes, tesorería,
  notificaciones y horarios filtran por año activo; `?anio=YYYY` explícito permite
  históricos. `reporteDao.getResumenAsistenciaGrado` ya no ignora el año.
  `asistencia_alumnos` sigue sin columna `anio_lectivo` (se deriva de `fecha`).
- **Matrícula:** valida que el grado y el concepto `MATRICULA` sean del año; reutiliza
  apoderado por DNI sin sobrescribir; el retiro solo desactiva al usuario si no le queda otra
  matrícula no retirada.
- **Frontend:** ficha docente y pre-tickets envían `?anio`; el panel del estudiante muestra
  “Sin matrícula {año}” y el sidebar no inventa grado.
- **Commits locales de 6.1:** `39f2eb4` (DB/H49), `84c4c5c` (backend), `72c68df`
  (frontend), `a10e324` (tests) y `952ecc4` (docs). Sin push ni despliegue.
- **Verificación (local):** migración dos veces en `siga_uc_h49` (idempotente); rollback OK;
  seed de producción con `-v anio_lectivo=2027` (41 tablas, 0 alumnos, admin OK);
  `test:integridad` **14 PASS** en base de producción desechable; `test:e2e` **27 PASS**;
  `npm run smoke` **11 PASS**; `test:h47-generador` **4 PASS**; build Angular OK;
  `node --check` OK. La base local `siga_uc` quedó con H49 (42 tablas por el backup H47).

### 1.2 Fase 6.2 — Rollover anual y activación auditada (22/11/2026, desplegada)

- **Alcance:** preparar la oferta del año destino sin tocar alumnos. No promueve, no crea
  matrículas/pagos/notas/asistencia/actas ni horarios. **6.2 no agrega migración**; opera
  sobre H49.
- **Backend:** `/api/anios-lectivos` (solo ADMIN) con `GET` catálogo, `POST /preview`,
  `POST /rollover`, `PUT /:anio/activar` y `DELETE /:anio/rollover`. DAOs
  `anioLectivoDao`/`rolloverDao`, servicios `anioLectivoService`/`rolloverService` y
  controlador/ruta nuevos. Si falta `anios_lectivos`, responde **503 H49_NO_APLICADO**.
- **Preview:** solo lectura; bloquea origen inexistente/sin grados, falta de `MATRICULA`,
  destino con actividad u oferta distinta, docentes inactivos/sobrecargados y grados sin
  `orden`/duplicados. Advierte por falta de períodos, carga, tutores y conceptos `OTROS`.
  `incluir_otros=false` por defecto. SHA-256 estable con origen, destino, conteos,
  conflictos y opciones.
- **Confirm:** transacción única, advisory lock `rollover:origen:destino`, orden grados →
  conceptos → períodos → carga → tutores. Compara antes de insertar; no usa
  `ON CONFLICT DO NOTHING` a ciegas. Repetir con el mismo hash devuelve `creados=0`,
  `existentes>0`. Si el hash cambió, `409 PREVIEW_DESACTUALIZADA`.
- **Activación:** solo `PLANIFICADO → ACTIVO`, exige 1 grado y 1 concepto `MATRICULA`;
  cierra el año anterior y deja un solo `ACTIVO`. Actualiza `setAnioActivo()` tras el
  COMMIT y audita `ACTIVAR`. No reactiva `CERRADO` en 6.2.
- **Reversión:** solo año `PLANIFICADO`, no activo, sin actividad y con oferta idéntica a
  la clonada (marca `Rollover desde YYYY`). Borra tutores → carga → períodos → conceptos →
  grados, retira el año si lo creó el rollover y audita `REVERTIR_ROLLOVER`.
- **Frontend:** servicio `anio-lectivo.service.ts`, pantalla
  `features/admin/anios-lectivos` (catálogo, selects origen/destino, preview por secciones,
  checkbox `incluir OTROS`, confirmación con responsabilidad, modales de activación y
  reversión), ruta `admin/anios-lectivos` e ítem de sidebar solo ADMIN. Tras activar llama
  `await configuracion.cargar()` y recarga el catálogo; los demás usuarios deben recargar.
- **Commits de 6.2:** `a670c06` (backend), `44bf200` (UI), `9b3ea6f` (tests), `05aa805`
  (docs) y cierre `f05ecc5`. **Push y despliegue en Render**; H49 sigue pendiente en
  Supabase.
- **Verificación (local):** `test:e2e` **38 PASS** (27 previas + 11 de rollover);
  `test:integridad` **16 PASS** en base de producción desechable (14 previas + carga/tutores
  del mismo año); `npm run smoke` **11 PASS**; `test:h47-generador` **4 PASS**; build Angular
  OK; `node --check` OK. UI probada en navegador con ADMIN: preview 2026→2027, confirm
  (85 filas), activación 2027 (2026 CERRADO, caché actualizada), preview 2027→2028 y modal
  de reversión. Bases desechables eliminadas; `siga_uc` y Supabase no se modificaron.
  Render recibió el push `f05ecc5` y sirve el frontend 6.2; `/api/health` OK.
- **Trampa de la base local:** `siga_uc` tiene las 142 h de carga en el ADMIN y el preview
  bloquea por sobrecapacidad (correcto). El E2E reequilibra su base desechable (4 docentes,
  ≤40 h) para probar el camino feliz. En Supabase el reparto es 30/30/30/30/25 h.

### 1.3 Fase 6.3 — Promoción de alumnos (22/11/2026, desplegada)

- **Alcance:** promoción = recomendación + confirmación humana. Crea matrículas del año
  destino, expedientes y pre-tickets; registra egresados, repitentes y retirados. **No**
  activa el año, no copia notas/asistencia/pagos/pensiones, no crea usuarios ni QR y no
  codifica la norma peruana.
- **Migración:** `database/migracion_h73_promociones.sql` crea `politicas_promocion` y
  `promociones`, con UNIQUE parcial de origen/destino confirmado, FKs RESTRICT/SET NULL,
  índices y una política estándar para el año ACTIVO. No agrega `TRASLADADO`. Rollback
  `rollback_h73_promociones.sql` solo para bases desechables. 43 tablas base (44 local con
  `horarios_h47_backup`).
- **Backend:** `/api/promociones` con políticas (`GET`, `POST`, `PUT`), `POST /preview`,
  `POST /confirmar`, `GET /`, `GET /:id` y `PUT /:id/anular`. DAOs
  `promocionDao`/`politicaPromocionDao`; servicios `promocionService`/
  `politicaPromocionService`. Si faltan las tablas H73, responde **503
  PROMOCIONES_NO_APLICADAS**; si falta H49, **503 H49_NO_APLICADO**.
- **Preview:** solo lectura; por alumno calcula resultado sugerido, actas (H48), notas,
  asistencia (advertencia), deuda (advertencia), becas, bloqueos y override. Hash SHA-256
  estable con años, política, decisiones, conteos y bloqueos. El confirm recalcula el hash
  dentro de la transacción; hash viejo → `409 PREVIEW_DESACTUALIZADA`.
- **Confirmación:** advisory lock `promocion:origen:destino`; transacción única. Crea
  matrícula destino con `PendientePago` si hay MATRICULA (si no, `Matriculado` con
  advertencia), expediente nuevo y pre-ticket. Egresados/retirados no crean matrícula
  destino. Idempotente: mismo hash devuelve `ya_confirmada=true`; no duplica.
- **Override:** solo si `permite_override=true`, con motivo ≥5 y `es_override=true`. Sin
  permiso o sin motivo, el confirm falla con `422 PROMOCION_BLOQUEADA`.
- **Anulación:** solo `CONFIRMADA`; si el destino no tiene pagos/notas/asistencia/pensiones/
  pre-tickets pagados, desvincula y borra matrícula/expediente/pre-ticket y permite
  reintento con `id_promocion_reversa`. Si hay actividad, `409 PROMOCION_CON_ACTIVIDAD`.
- **Frontend:** servicio `promocion.service.ts`, pantalla `admin/promociones` con filtros,
  preview por alumno, override con motivo, confirmación con responsabilidad, historial y
  anulación, y modal de políticas. No activa el año. SECRETARIA puede leer/previsualizar por
  API; DOCENTE/ESTUDIANTE 403.
- **Verificación (local):** migración H73 aplicada en `siga_uc` tras backup; `test:e2e`
  **54 PASS** (38 previas + 16 de promoción); `test:integridad` **20 PASS** en base de
  producción desechable y **18 PASS / 2 FAIL** de seed en local; `npm run smoke` **11 PASS**;
  `test:h47-generador` **4 PASS**; build Angular OK; `node --check` OK. UI probada en
  navegador con ADMIN: preview 2026→2028, confirm (2 matrículas), historial y override con
  re-previsualización.
- **Commits de 6.3:** migración `c893e02`, backend `cf8efb3`, UI `8b15041`, tests
  `7226003`, documentación `5f73049`; cierre `8492262`. **Push y despliegue en Render.**
- **Estado:** implementado, verificado y **desplegado en Render (`89eba24`)**; **H73
  aplicada en Supabase demo**. Allí hay 43 tablas, 2026 activo, 1 política, 0 promociones y
  2027 sin activar.

### 1.4 Fase 6.3.1 — cierre de reglas de promoción (22/11/2026, desplegada)

- **Actas/notas:** se validan para PROMOVIDO, REPITENTE y EGRESADO; RETIRADO queda exento.
  Si faltan, el resultado es PENDIENTE con bloqueo; el override permitido + motivo las exime
  y deja evidencia en `metadata`.
- **Notas multibimestre:** `criterio_academico.notas_bimestres` (arreglo 1–4, default `[4]`).
  Se acepta el legado `notas_bimestre` y se normaliza a `[n]`. Un curso falta si no tiene
  nota en cualquiera de los bimestres requeridos; la repitencia usa el último bimestre.
  La UI tiene checkboxes de bimestres y la migración siembra `[4]` para nuevas políticas.
- **Becas en el hash:** `copiar_becas` entra en `preview_hash`; cambiarlo sin re-preview
  responde `409 PREVIEW_DESACTUALIZADA`. La UI invalida el preview al cambiar el checkbox.
- **PENDIENTE:** el confirm responde `422 PROMOCION_PENDIENTE` y no crea filas CONFIRMADA si
  algún alumno del lote queda PENDIENTE (no `ya_confirmada`). La UI deshabilita el confirm y
  muestra los pendientes. Un intento posterior sin decisiones sigue permitido.
- **Menores:** 23505/23503 de promociones tienen mensajes de promoción; el catálogo de años
  tolera que `periodos_clase` no exista (H47 no aplicado).
- **Verificación:** `test:e2e` **58 PASS** (54 previas + 4 nuevas), integridad **20 PASS** en
  base nueva, smoke 11, H47 4, build Angular y `node --check` OK. Desplegado en Render.
- **Commits:** `f1c5f71` (fix backend/UI/H73), `f9d8d1a` (tests) y `89eba24` (docs/cierre).

### 1.5 Fase 6.4 - Histórico por año y consolidado por estudiante (22/11/2026, desplegada)

- **Alcance:** consultar años históricos sin mezclar matrículas; selector de año en pantallas
  operativas, modo lectura en años no activos y consolidado por `id_usuario`/DNI. **No agrega
  migración** y no toca Supabase.
- **RBAC de años:** `GET /api/anios-lectivos` acepta ADMIN y SECRETARIA; `preview`,
  `rollover`, activar y revertir siguen siendo solo ADMIN.
- **Helper:** `alumnoDao.validarMatriculaAnual(id_alumno, anio)` valida que la matrícula
  pertenezca al año. Se usa en asistencia (historial y resumen) y calificaciones (curso y
  notas finales). Un `id_alumno` de otro año responde `404
  MATRICULA_NO_ENCONTRADA_EN_ANIO`; no una lista vacía.
- **Consolidado:** `GET /api/reportes/consolidado/:dni` (ADMIN/SECRETARIA) agrupa por
  `id_usuario`/DNI y devuelve una fila por año con grado, sección, estado, resultado de
  promoción, conteos AD/A/B/C, % de asistencia, total pagado, deuda pendiente y pensiones.
  No suma años por `id_alumno`. Si el DNI no existe, `404 ESTUDIANTE_NO_ENCONTRADO`.
- **UI:** componente compartido `selector-anio` (reutiliza `anio-lectivo.service.ts`) en
  `admin/reportes`, `admin/alumnos` y su wrapper `secretaria/padron`, y
  `secretaria/tesoreria`. Año no activo = badge **Histórico** y se ocultan nueva matrícula,
  editar, retirar, reset, cobrar y generar pensiones. `/admin/historico` busca por DNI y
  enlaza a libreta (`?anio&dni&grado&bimestre`), asistencia (modal con `?anio`) y tesorería
  (`?anio&dni`). `admin/reportes` acepta deep links y abre la libreta.
- **Verificación (local, 22/11/2026):** `test:e2e` **65 PASS** (58 previas + 7 nuevas);
  `test:integridad` **20 PASS** en base de producción desechable y **18 PASS / 2 FAIL** de
  seed en local (invariantes 4 y 8); `npm run smoke` **11 PASS**;
  `test:h47-generador` **4 PASS**; build Angular OK y `node --check` OK.
- **Commits de 6.4:** `68308ac` (backend), `2b4faed` (UI), `70bddb0` (tests) y `cdc129e`
  (docs); cierre `151ab95` (registro de despliegue).
- **Estado:** implementado, verificado y **desplegado en Render** (`cdc129e`); **sin
  migración** y sin cambios en Supabase.

### 1.6 Fase 7 — Pulido de credibilidad, datos y seguridad (22/11/2026, desplegada)

- **H62:** `POST /api/notificaciones` quedó para ADMIN/SECRETARIA; DOCENTE recibe 403.
  `/masivo` sigue solo ADMIN. No hay UI de envío para docente.
- **H59:** `database/migracion_h59_observaciones_personal.sql` agrega
  `personal.observaciones text` (idempotente). El cese la guarda, `GET /personal` la
  devuelve y la ficha del cesado la muestra; la reactivación limpia fecha, motivo y
  observación. El apoderado con correo y sin nombres sigue respondiendo 400.
  **Aplicada en local y en Supabase demo.** La columna existe en Supabase; el cese con
  observación ya puede persistirla. Sin la migración, el listado devolvía
  `observaciones: null` y el cese respondía `503 H59_NO_APLICADO`.
- **H65:** `GET /reportes/dashboard` agrega `total_docentes` (rol 2 activo con ficha sin
  cese) y conserva `total_personal` (todo el personal sin cese). La UI rotula “Estudiantes
  matriculados”, “Plana Docente” y “Personal activo”; Secretaría usa “Pagos del Mes”.
- **H66:** el panel se llama “Cobranza y expedientes” y ya no muestra el badge “Filtro
  Automático”.
- **H67:** el filtro de grados usa `grados()` (ya venía de 6.4) y el texto de carga usa
  `cursos().length`; no quedan 1–5 ni “11 cursos” fijos.
- **H68:** el PDF del acta dice “Hash de integridad” y “Acta cerrada por”; el botón de caja
  dice “Cerrar caja”. No se promete firma digital ni no repudio. El algoritmo MD5 no cambió.
- **H69:** `lang="es"` y título del colegio; “Boletas internas / Tesorería”; “Correo
  institucional (referencia)”; DNI real en pre-tickets; títulos del ADMIN por ruta;
  `/en-construccion` eliminado; aviso de correo en modo prueba en recuperación; sidebar
  docente usa especialidad/cargo real.
- **H70 (estado al cierre de Fase 7):** el login ya no imprimía el objeto usuario y el
  arranque decía “Resend configurado”; `nodemailer` y SMTP se retiraron en el cierre (1.7).
- **H71 (estado al cierre de Fase 7):** pendiente; se implementó en el cierre (1.7).
- **Verificación (local, 22/11/2026):** `test:e2e` **72 PASS**; `test:integridad` **20 PASS**
  en base nueva y **18/2** de seed local; smoke **11 PASS**; H47 **4 PASS**; build Angular y
  `node --check` OK. (El cierre de demo subió a 75 E2E y 21 invariantes; ver 1.7.)
- **Commits de 7:** `c5f974e` (H62), `520cb7e` (H59), `184a543` (H65-H69), `c097b15`
  (tests), `882da76` (docs) y `8eba9e9` (compatibilidad H59 sin migración).
- **Estado:** código desplegado en Render (`8eba9e9`); el frontend ya sirve `lang="es"` y el
  título del colegio. **H59 aplicada en Supabase demo** (43 tablas, 2026 ACTIVO,
  0 promociones).

### 1.7 Cierre de demo — SIAGIE interno, H70/H71 y UAT (22/11/2026)

- **SIAGIE interno (decisión cerrada):** no se implementa integración oficial con MINEDU.
  Se retiraron “Abrir Portal MINEDU”, el `alert` de plantilla y el falso “Análisis Dinámico
  Exitoso” con `setTimeout`. El formulario solo pide año, grado y bimestre; muestra el
  aviso “Exportación interna. No es una exportación oficial a SIAGIE/MINEDU.” y el botón
  “Exportar Excel interno”.
- **Backend:** `GET /api/siagie/resumen` y `GET /api/siagie/exportar` (ADMIN). Usa
  `carga_curricular` + cursos con notas (sin prefijos H05), alumnos
  `Matriculado`/`PendientePago`, notas finales y conclusiones. Genera
  `EXPORTACION_INTERNA_<grado>_BIM<n>_<año>.xlsx` con hojas `Notas` y `Aviso`; registra
  `exportaciones_siagie` y audita `EXPORTAR`. No escribe archivos ni usa Multer.
- **UI:** se eliminó la carga de archivo y el mapeo simulado; se conservó la auditoría real
  de notas por docente y la notificación. El sidebar y el título dicen “Exportación
  interna”.
- **H70 cerrado:** se retiraron `nodemailer`, `multer` y las variables SMTP de
  `config/env.js` y `.env.example`. El arranque dice “Resend configurado”; el login no
  imprime el objeto usuario y `emailService` no imprime destinatarios.
- **H71 implementado:** `database/migracion_h71_retirados_historicos.sql` (idempotente)
  congela el expediente de los `Retirado` y desactiva al usuario solo si no conserva otra
  matrícula no retirada. Aplicado en local: 1 expediente sin congelar y 1 usuario ACTIVO
  corregidos. Invariante 21 en `test:integridad`. **No aplicado en Supabase demo** porque
  no hay retirados allí; aplicarlo antes de datos reales.
- **Verificación (local, 22/11/2026):** `test:e2e` **75 PASS**, integridad **21 PASS** en
  base nueva y **19/2** de seed local, smoke **11 PASS**, H47 **4 PASS**, build Angular OK
  y `node --check` OK. SIAGIE descargado desde la UI y abierto con ExcelJS: 11 cursos,
  4 alumnos, nota y conclusión.
- **UAT:** login ADMIN, SECRETARÍA, DOCENTE y ESTUDIANTE; padrón (21), tesorería, caja,
  notas, reportes, auditoría, histórico, rollover preview 2026→2027 (bloqueo real por
  sobrecapacidad) y SIAGIE. Promoción completa en E2E (local no tiene oferta 2027).
  Detalle y límites en `documentacion/17`, sección 9.
- **Estado Supabase:** 43 tablas, 2026 ACTIVO, 2027 no activo, 1 política, 0 promociones
  confirmadas, 0 actas, 1 alumno. Solo previews y consultas.

### 1.8 Login responsive y despliegue `e1c3ada` (22/11/2026)

- **Alcance:** solo `login.component.html` y `login.component.scss`. No cambia la API ni la
  base de datos.
- **Layout:** alto real de pantalla (`100dvh` con respaldo `100vh`), login centrado, ancho
  máximo 1100 px en escritorio y una columna de 600 px en tabletas/plegables.
- **Móvil (≤640 px):** marca compacta, se ocultan el bloque promocional y el pie, el
  formulario queda prioritario, inputs de 16 px para evitar el zoom de iOS, DNI con teclado
  numérico y botón de contraseña de 44×44 px.
- **Pantallas bajas:** reglas por altura para laptops y tabletas en horizontal; si aun así
  no cabe, el login permite scroll vertical sin desbordamiento horizontal.
- **Modal de recuperación:** ancho/alto adaptativos, cuerpo con scroll interno, botones
  táctiles a ancho completo en móvil y cierre accesible.
- **Accesibilidad:** `aria-live` en errores, `aria-label`/`aria-pressed` en el ojo de la
  contraseña, `aria-modal`/`aria-labelledby` en el modal, foco visible y
  `prefers-reduced-motion`.
- **Verificación:** probado en 320×568, 360×640, 375×667, 390×844, 412×915, 600×960,
  768×1024, 820×1180, 1024×600, 1280×800, 1366×768, 1440×900 y 1920×1080; sin
  desbordamiento horizontal. Login real ADMIN en 390×844. `npm run build` OK y E2E
  **75 PASS**.
- **Despliegue:** commits `2a6bd7d`…`e1c3ada` subidos a `origin/main`; Render actualizó
  frontend y API. El frontend de producción ya sirve el login responsive y la API nueva
  responde `403` a DOCENTE en `/api/siagie/resumen` (rol ADMIN requerido).

### 1.9 Sidebar con scroll y cierre de sesión siempre visible (22/11/2026)

- **Problema:** el sidebar tenía `height: 100vh` con la marca, todos los ítems y el bloque
  de usuario dentro de un `space-between`; al crecer el menú, los últimos ítems y el
  usuario/cerrar sesión quedaban fuera de la pantalla, sobre todo en laptops de 600–720 px.
- **Solución:** la marca queda fija arriba, el menú tiene `overflow-y: auto` con scrollbar
  fina y el bloque de usuario/cerrar sesión queda fijo abajo. El sidebar usa `100dvh`.
- **Compactación:** hasta 800 px de alto se reducen paddings, logo y tipografía; hasta
  650 px se compacta aún más. En 1024×600 los 14 ítems del ADMIN entran completos y el
  usuario sigue visible. En 1024×500 el menú hace scroll y el usuario permanece visible.
- **Alcance:** se aplicó el mismo patrón a los cuatro sidebars (ADMIN, SECRETARÍA, DOCENTE
  y ESTUDIANTE). El logout pasó de `<i>` a `<button>` con `aria-label`, conservando la
  confirmación y la funcionalidad existentes.
- **Verificación:** ADMIN a 1920×1080, 1440×900, 1366×768, 1280×720, 1024×600 y 1024×500;
  SECRETARÍA, DOCENTE y ESTUDIANTE a 1024×600. Footer visible en todos los casos; logout
  probado (confirma y redirige a `/login`). `npm run build` OK y E2E **75 PASS**.
- **Despliegue:** commit `c098f02` en `origin/main`; Render sirve el frontend nuevo. En
  producción, a 1024×600, el menú del DOCENTE tiene `overflow-y: auto`, el botón de logout
  existe y el bloque de usuario queda dentro de la pantalla.

### 1.10 Módulos del ESTUDIANTE adaptados a móviles y tabletas (22/11/2026)

- **Layout:** en pantallas ≤900 px el sidebar se convierte en un **drawer** con overlay,
  botón de hamburguesa en el header, cierre con X/overlay y bloqueo del scroll de fondo. En
  escritorio (≥901 px) sigue fijo y visible. Al cambiar de ruta se cierra solo; si se
  amplía la ventana se cierra y se libera el scroll.
- **Cabecera:** botón de menú accesible (`aria-controls`, `aria-expanded`), título
  dinámico por sección (“Mis Cursos y Calificaciones”, “Mi Asistencia”, “Horario de
  Clases”), título compacto, campana y avatar sin nombre en móvil, y modales adaptativos.
- **Dashboard:** banner de bienvenida en columna, KPIs apilados en pantallas pequeñas y
  tabla de notas con scroll horizontal interno.
- **Asistencia:** filtro a ancho completo, KPIs en 2 columnas (1 columna bajo 360 px),
  tabla con scroll interno y resumen global en rejilla adaptable.
- **Horario:** banner reordenado, aviso “Desliza horizontalmente…”, tabla con scroll
  interno y columna de horas fija para no perder la referencia.
- **Sin cambios funcionales:** mismas rutas, servicios, permisos y llamadas HTTP. El logout
  conserva confirmación y redirección.
- **Verificación:** 320×568, 360×640, 390×844, 412×915, 600×960, 640×360, 768×1024,
  1024×600 y 1366×768. Sin desbordamiento horizontal; drawer, overlay, cierre, navegación,
  logout y modales probados. `npm run build` OK, E2E **75 PASS**, smoke **11 PASS**.
- **Despliegue:** commit `df1f384` en `origin/main`; Render sirve el `main-SCTCECV3.js`
  generado por ese commit. Verificado en producción: API `200`, `database: "ok"`.

### 1.11 Estado final de la sesión (22/11/2026)

- **HEAD:** `9a29122` (`docs(estudiante): registrar diseno responsive df1f384`).
- **Código desplegado:** `df1f384` en Render (frontend y API). La documentación posterior
  (`9a29122`) no cambia el código.
- **Trabajo cerrado:** SIAGIE interno, H70, H71 local, login responsive, sidebar corregido
  en los cuatro roles y módulos del ESTUDIANTE responsive.
- **Suites:** E2E **75 PASS**; integridad **21 PASS** en base nueva y **19/2** de seed local;
  smoke **11 PASS**; H47 **4 PASS**; build Angular OK; `node --check` OK.
- **Supabase:** sin cambios en esta sesión. 43 tablas, 2026 ACTIVO, 2027 no activo,
  1 política, 0 promociones confirmadas, 0 actas, 1 alumno. H71 sigue pendiente allí porque
  no hay retirados en la demo.
- **Pendiente inmediato:** adaptar a móvil/tableta los módulos de ADMIN, SECRETARÍA y
  DOCENTE (login, sidebar y estudiante ya están hechos). No iniciar Fase 8.
- **Datos locales:** 21 alumnos, 54 cargas/142 h en el ADMIN, 0 horarios publicados. Para
  una demo docente hay que reasignar cargas; para el horario del estudiante hay que generar
  y publicar.

---

## 2. Entorno

- Desarrollo **local**:
  - Backend: `http://localhost:3000`
  - Frontend: `http://localhost:4200`
  - PostgreSQL 18 local, base `siga_uc`.
- **Demo desplegada (21/11/2026, actualizada 22/11/2026):**
  - Frontend: <https://siga-uc-web.onrender.com>
  - Backend: <https://siga-uc-api-prod.onrender.com/api>
  - Ambos **Live** en el commit `9648689`, con servicios **gratuitos**.
- Base de demo: Supabase `siga-uc-prod` (us-west-2), plan gratuito, **43 tablas**,
  H47 desplegado, **H48 aplicado** (4 columnas nuevas + índice
  `uq_acta_anio_bimestre_grado`, **0 actas**), **H49 y H73 aplicadas**, **10 períodos** y
  **145 horarios PUBLICADO**. 2026 ACTIVO, 1 política de promoción, 0 promociones.
- Carga 2026 en Supabase: **55 cargas/145 h**, repartidas **30/30/30/30/25 h** entre los
  5 docentes demo (`99000001`–`99000005`), **0 choques**. Auditoría `GENERAR` y `PUBLICAR`
  registrada.
- Datos de la demo: usuarios, alumnos de prueba y horarios ficticios; noviembre y diciembre
  del alumno de prueba ya generados. **No hay datos reales.**
- **No hay staging.**
- Render gratuito puede dormir por inactividad y Supabase gratuito puede pausarse; entrar
  unos minutos antes de la demo para despertar ambos servicios.
- La BD local `siga_uc` tiene **H47, H49 y H73 aplicados**: **44 tablas** (43 base +
  `horarios_h47_backup`), **10 períodos**, **0 horarios** tras la limpieza y **13 filas**
  en el backup. `anios_lectivos` tiene 2026 `ACTIVO`; `grados.orden` 1..5.
  `politicas_promocion` tiene la "Política estándar" de 2026 y `promociones` está vacía.
- Datos locales tras la limpieza: **21 alumnos, 29 usuarios, 54 cargas/142 h todas en el
  ADMIN** (ficha personal nueva del ADMIN), **0 usuarios/personal/QR demo** y **0 horarios**.
  El índice `ux_pago_pension_activo` existe.
- Credenciales de demo: docentes `99000001`–`99000005`, contraseña = DNI; alumno de prueba
  `99999999` con la contraseña definida por el dueño. La contraseña del ADMIN de producción
  es la real del dueño y **no** está en `.env`. La clave de PostgreSQL local está en
  `siga-uc-backend/.env` (`DB_PASSWORD`); no se escribe en este documento.
- `npm run smoke` existe (`siga-uc-backend/scripts/smoke.js`): 11 pruebas de solo lectura,
  timeout de 10 s por petición. Lee las credenciales de `SMOKE_*` y de
  `siga-uc-backend/.env`; nunca las imprime. Códigos de salida: `0` solo sin FAIL y sin
  SKIP; `1` si hay FAIL; `2` si hay SKIP sin `SMOKE_ALLOW_SKIP=1`.
- Verificación local del 21/11/2026: **11 PASS, 0 FAIL, 0 SKIP** (exit 0) con las tres
  cuentas; **3 PASS, 0 FAIL, 8 SKIP** (exit 2) sin credenciales.
- `npm run test:integridad` (`scripts/test-integridad.js`): 21 invariantes de solo lectura
  sobre cualquier base. Fuerza `default_transaction_read_only=on`. Exit 1 si hay FAIL.
- `npm run test:e2e` (`scripts/test-e2e.js`): crea `siga_uc_e2e`, carga el dump y las
  migraciones (incluidas H49, H73, H59 y H71), arranca el backend en el puerto 3101, ejecuta
  75 flujos y elimina la base con `dropdb --force`. Verificado: **75 PASS, 0 FAIL** y exit 0
  (incluye H48, H49, H50, H51, H63, rollover 6.2, promociones 6.3, histórico 6.4, pulido 7 y
  SIAGIE interno).
- Integridad local del 22/11/2026 (tras H71): **19 PASS, 2 FAIL** por datos de seed reales
  (invariantes 4 y 8: 5 pagos sin INGRESO y 144 pensiones PAGADO sin pago). El
  invariante 7 ya no marca al ADMIN: solo exige ficha a ESTUDIANTE (rol 4) y
  DOCENTE (rol 2). Los invariantes 15 y 16 (carga/tutores del mismo año) pasan.
- `database/seed_produccion.sql` crea solo catálogos, una caja y un ADMIN inicial
  (`74829102`, `requiere_cambio_password=TRUE`) con contraseña recibida por
  `-v admin_password` y año por `-v anio_lectivo`. En la base desechable de 6.2 (2027):
  **21 PASS, 0 FAIL**, **0 alumnos, 0 pagos, 0 pensiones, 1 usuario**, 43 tablas.
  Login inicial bloqueado con `CAMBIO_PASSWORD_REQUERIDO`; tras cambiarla, login y
  `/alumnos` funcionan.
- `POST /api/notificaciones/masivo` acepta `TODOS`, `PERSONAL`, `ROL`, `GRADO` y
  `ALUMNO`. En la demo: PERSONAL = 7, ROL DOCENTE = 5, ROL ADMIN = 1. `PERSONAL` no
  envía `id`; `ROL` solo admite roles 1-3 y rechaza el 4 con
  `"Para estudiantes use TODOS, GRADO o ALUMNO."`. La UI muestra las 5 opciones y el
  select de roles; la auditoría `ENVIAR` guarda tipo, total y `rol_nombre`.
- H43: los resets por ADMIN (`PUT /auth/reset-password` por DNI y
  `PUT /personal/:id/reset-password`) registran `RESET_PASSWORD` en `Seguridad` con
  `{ dni, id_usuario_afectado }`, nunca la clave. La bitácora tiene icono, estilo y
  filtro `RESET_PASSWORD`. Verificación: **4 PASS**, DOCENTE recibe 403 sin auditoría,
  hashes temporales restaurados y 0 residuos.
- H44: al pagar matrícula se genera el cronograma del alumno desde su mes de
  `fecha_creacion` hasta diciembre, solo conceptos `PENSION` y con beca. La generación
  participa de la misma transacción: si falla, el pago completo hace ROLLBACK. La
  respuesta de pago añade `pensiones_generadas`. Endpoint manual idempotente:
  `POST /tesoreria/pensiones/alumno/:id_alumno/generar` (ADMIN/SECRETARIA).
  Verificación en `siga_uc_h44`: **9 PASS** (Nov/Dic automáticos, marzo-diciembre 10,
  idempotencia, pagos fuera de orden, rollback, 400, RBAC, auditoría) + UI
  “Generar pensiones”/“Al día”.
- H46: el módulo Personal solo acepta roles 1-3; `ESTUDIANTE` responde 400 con
  “El rol ESTUDIANTE no aplica al personal.”. La especialidad solo se guarda para
  DOCENTE; al cambiar a ADMIN/SECRETARIA el backend la deja en `NULL`. La UI filtra
  ESTUDIANTE en alta/edición/filtro y muestra “Especialidad (solo docentes)” solo con
  DOCENTE. Verificación en `siga_uc_h46`: **8 PASS** de API + UI (campo condicional,
  lista y cese). En local existe **1** usuario no docente con especialidad
  (SECRETARIA, id_usuario 2); no se modificó.
- H45: el retiro anula en la misma transacción las pensiones `PENDIENTE` de meses
  posteriores al retiro y todos los `pre_tickets PENDIENTE`; la pensión del mes de
  retiro queda `PENDIENTE` y los `PAGADO` no se tocan. La respuesta y la auditoría
  `RETIRAR` incluyen `pensiones_anuladas` y `pretickets_anulados`. Verificación en
  `siga_uc_h45`: **8 PASS** de API + UI (Nov→Dic anulada, retiro en Dic, PAGADO intacto,
  pre-tickets/KPI, pago 400, rollback, reactivación y migración dos veces).

---

## 3. Hallazgos CERRADOS

| Hallazgo | Detalle | Commit |
|---|---|---|
| H01 | GET por rol/ownership | `b6f4a21` (+ verificación `ca5e742`) |
| H02 | Revalidar estado en cada request | `b6f4a21` |
| H03 | Rate limit en login, recuperación y validar-token | `b6f4a21`, `408c451` |
| H04 | Nota final automática al guardar | `f02f88a` |
| H06 | Acta cerrada bloquea notas (completo en H48: acta global y por grado) | `f02f88a`, `d9071e5` |
| H07 (A+B) | Auditoría de seguridad, dinero, alumnos, personal, académico, SIAGIE, notificaciones y descargas | `d8800e4`, `76573ac` |
| H08 | Pago solo a caja abierta | `81aa521` |
| H09 | Monto, pensión, alumno y caja coherentes | `408c451` |
| H10 | Numeraciones con advisory locks | `c65770c` |
| H11 | Errores visibles en guardados masivos | `48d119a` |
| H12 | Año lectivo y conceptos centralizados | `e483245` |
| H15 | Notificaciones personalizadas + buscador + PERSONAL/ROL | `e099173`, `e793ee3`, `feat(notificaciones)` |
| H17 | Errores SQL no expuestos | `b6f4a21` |
| H18 | Cambio obligatorio de contraseña | `33be57a` |
| H19 | Retiro desactiva usuario y congela expediente | `e5f7055` |
| H20 | Edición sincroniza nombres en `usuarios` | `e5f7055` |
| H23 (parcial) | Paginación en alumnos y bitácora | `8a4727b` |
| H25 | Backup automático | `e6e5296` |
| H32 | Anulación de pagos | `f2c258c` |
| H34 | PDFs reales de libretas, boletas y actas | `9b70b94`, `95f08f3` |
| H37 | Concepto de pensión valida mes/año | `c65770c` |
| H38 | Doble pago concurrente bloqueado | `c65770c` |
| H39 | Fechas de negocio en hora de Lima | `399d35e` |
| H40 | Secuencia de instalación corregida | `def839e` |
| H41 | Seed de producción separado del dump demo; invariante 7 corregido | `feat(db): seed de produccion sin datos ficticios (H41)` |
| H43 | Resets de contraseña por ADMIN auditados | `fix(seguridad): auditar resets de contraseña por admin (H43)` |
| H44 | Pensiones por alumno generadas al matricular y por botón manual | `fix(tesoreria): generar pensiones del alumno al matricular (H44)` |
| H46 | Especialidad solo para DOCENTE y roles de Personal 1-3 | `fix(personal): especialidad solo para docentes y roles de personal (H46)` |
| H45 | Anulación de pensiones/pre-tickets futuros al retirar | `fix(alumnos): anular pensiones y pretickets futuros al retirar (H45)` |
| H47 | Horarios por bloques, `mi-horario`, CRUD, publicación, generador y UI | `cf3c988`, `e65f60f`, `65e73a3`, `a9acf24` |
| H50 | Caja separa efectivo y digital; el cierre no descuenta Yape/transferencia del cajón | `2449cf3` (22/11/2026), desplegado con `3052f44` |
| H63 | PDF de actas restringido a ADMIN; DOCENTE recibe 403 | `2449cf3` (22/11/2026), desplegado con `3052f44` |
| H48 | Cierre/reapertura reales de actas, bloqueo global y migración H48 | `d9071e5` (22/11/2026), desplegado con `9648689` |
| H51 | Selector de bimestre en libretas y PDF por bimestre | `d9071e5` (22/11/2026), desplegado con `9648689` |
| H61 | Día de la semana derivado en backend, en español y datos históricos normalizados | `269e1ae` (22/11/2026, local) |
| H56 | Asistencia por año en historial, resumen, libreta, PDF y resumen por grado; H13 incluido | `15aab48` (22/11/2026, local) |
| H60 | Observación sin estado bloqueada con validación inline; con estado se guarda y persiste | `410b35d` (22/11/2026, local) |
| H57 | Grado real en sidebar, cursos desde carga curricular y mensaje neutral sin notas | `2cf8477` (22/11/2026, local) |
| H53 | Botones Asistencia/Notas del docente navegan con curso/grado preseleccionado | `6c7c5ff` (22/11/2026, local) |
| H54 | “Cobrar” navega a tesorería con pre-ticket/alumno y reutiliza el modal de cobro | `e030432` (22/11/2026, local) |
| H55 | Carné del personal con QR real generado desde `codigo_qr` | `24ddbc3` (22/11/2026, local) |
| H58 | Impresión aislada de reportes/carné; PDF de backend intacto para libreta/boleta/acta | `eed93b6`, `8bea060` (22/11/2026, local) |
| H72 | Página 404 propia y `returnUrl` interno respetado tras el login | `e58feca` (22/11/2026, local) |

---

## 4. Hallazgos PENDIENTES

> **Cerrados en el cierre de demo:** H05 (todos los cursos en la exportación interna),
> H27 (`.env.example` usa Resend), H70 (sin Nodemailer/SMTP) y H71 (backfill de retirados).

| Hallazgo | Detalle | Severidad | Esfuerzo |
|---|---|---|---|
| H21 | Cambio de rol no regenera QR ni permisos históricos | Media | S |
| H22 | N+1 en tesorería (pensiones por alumno) | Media | S/M |
| H23 | Paginación faltante en personal, pagos y pre-tickets | Media | M |
| H24 | Sin tests automatizados ni CI/CD | Media | L |
| H26 | Documentación histórica desactualizada | Baja | S |
| H28 | `siga_uc.sql` con meta-orden `\restrict` de psql 18 | Baja | S |
| H29 | Tablas de reportes no persistidas | Baja | S |
| H30 | Título e identidad menores | Baja | S |
| H31 | Endpoint de logout sin uso | Baja | S |
| H33 | Competencias y conclusiones sin CRUD (horarios resuelto con H47) | Media | L |
| H35 | Estudiantes sin pantalla de libreta | Baja | S |
| H36 | Rate limit de login por IP compartida en red escolar | Media | S |

---

## 5. Decisiones de negocio tomadas

1. Las pensiones se pagan **completas**; no existen pagos parciales.
2. Las boletas son **comprobantes internos**; no van a SUNAT.
3. La anulación de un pago genera un **EGRESO** con el mismo medio de pago.
4. La auditoría registra **escrituras, accesos y descargas**; **no lecturas**.
5. El despliegue actual en **Render + Supabase gratuitos** es el **entorno de
   demostración**, no producción real.
6. Antes de dar una demo se ejecutará un **smoke test de solo lectura** en local; contra
   Render solo con confirmación explícita del dueño.
7. **No se compran dominios ni planes** hasta que la dirección apruebe el proyecto.
8. El correo queda en **modo prueba**; el canal confiable de la demo es la **campanita**.

---

## 6. Trampas conocidas

- El backend fija la sesión de PostgreSQL en `America/Lima`; el `TZ` del **proceso**
  también debe ser `America/Lima` en Render (variable de entorno, no en JS).
- **Correo en modo prueba:** `onboarding@resend.dev` solo entrega al correo dueño de la
  cuenta Resend. No prometer correos a apoderados; la campanita sí funciona.
- **Supabase `siga-uc-prod` es de prueba:** plan gratuito, puede pausarse por inactividad
  y no ofrece garantías de producción ni de retención de backups.
- **Un `git push` no aplica migraciones:** se ejecutan a mano en Supabase, en orden y con
  archivos idempotentes.
- **Desarrollo/demo:** `siga_uc_completo.sql` (esquema + 21 alumnos ficticios +
  ~146 pensiones PAGADO sin pago). **Nunca en producción.**
- **Producción:** `siga_uc.sql` → `seed_produccion.sql` (con `-v admin_password`) →
  `migracion_h32_anulacion_pagos.sql` → `migracion_h10_h38_concurrencia_pagos.sql` →
  `migracion_h07_auditoria.sql` → `migracion_h45_pensiones_anuladas.sql` →
  `migracion_h47_horarios.sql` → `migracion_h48_actas.sql` →
  `migracion_h61_dia_semana.sql` → migraciones futuras, en ese orden.
- No mezclar ambos escenarios: `siga_uc.sql` y `siga_uc_completo.sql` son excluyentes.
- `seed_produccion.sql` crea una ficha `personal` mínima del admin porque
  `carga_curricular.id_personal` es NOT NULL; la carga inicial queda asignada al admin
  y debe reasignarse al crear docentes reales. Sigue habiendo **1 solo usuario**.
- `express-rate-limit` usa memoria: reiniciar el backend limpia los contadores.
- 5 fallos de login bloquean 15 min por IP; en red escolar compartida afecta a todos
  (H36, pendiente).
- El guardado masivo devuelve `{ guardados, total_errores, errores[] }`; la UI solo
  muestra éxito si `total_errores = 0`.
- La auditoría se escribe **después** del COMMIT: un fallo de auditoría no revierte
  pagos ni caja.
- El índice `ux_pago_pension_activo` existe en local; si una base tiene pagos
  `PAGADO` duplicados, la migración H10/H38 lo omite y avisa.
- H23 es parcial: faltan personal, pagos y pre-tickets.
- `npm run smoke` carga `.env` automáticamente y no sobrescribe variables ya definidas en
  el proceso. Su único POST es `/auth/login` (actualiza `ultimo_login` y registra el LOGIN
  en la bitácora); el resto son GET, pero la descarga de libreta registra `DESCARGAR` en
  la bitácora. No imprime tokens ni contraseñas.
- La cuenta docente `10293847` tiene `requiere_cambio_password = TRUE` y su contraseña
  documentada anteriormente ya no es válida. Para el smoke usar otra cuenta docente activa
  (por ejemplo `20394812`), sin modificar datos ni contraseñas.
- El login correcto no consume el rate limit (`skipSuccessfulRequests`); un smoke con
  contraseña incorrecta sí consume 1 de los 5 intentos de la ventana de 15 min.
- `npm run test:e2e` exige `createdb`, `dropdb` y `psql` en el PATH, el puerto 3101 libre y
  las credenciales `SMOKE_*` del seed. Ignora `DATABASE_URL`, se niega a usar una base sin
  `_e2e` y nunca toca `siga_uc` ni Supabase. Al terminar elimina `siga_uc_e2e`; si no puede,
  imprime los comandos manuales.
- `npm run test:integridad` es de solo lectura y puede apuntar a producción mediante
  `DATABASE_URL`; no ejecutarlo con credenciales de escritura si se quiere una garantía
  adicional.
- Notificaciones masivas: `PERSONAL` no lleva `id`; `ROL` exige `id` 1-3. El rol 4
  (ESTUDIANTE) y los roles inexistentes responden `400`; para estudiantes se usa
  `TODOS`, `GRADO` o `ALUMNO`. El endpoint `/masivo` es solo ADMIN: DOCENTE y
  ESTUDIANTE reciben `403`.
- La tabla `notificaciones` guarda una fila por usuario. Los correos se envían después
  de guardar; si Resend falla, la notificación permanece y solo aumentan
  `correos_fallidos`.
- Para probar notificaciones **sin correo real**, arrancar el backend con una key inválida
  no vacía (`RESEND_API_KEY=re_test_no_enviar`). En PowerShell, asignar `""` elimina la
  variable y `dotenv` vuelve a cargar la key real de `.env`, lo que envía correos de
  verdad. Los residuos de notificaciones y auditoría se eliminan al terminar.
- El hash del ADMIN de demo estaba desalineado de `SMOKE_ADMIN_PASSWORD` (drift de H43).
  El 21/11/2026 se alineó la contraseña del ADMIN local `74829102` con el valor de
  `SMOKE_ADMIN_PASSWORD` de `.env` (no se imprimió ni se documentó). Tras el cambio,
  `npm run smoke` da **11 PASS, 0 FAIL, 0 SKIP** (exit 0). Los resets auditados no
  guardan la clave ni el hash.
- H44: las pensiones se generan desde el **mes de `fecha_creacion`** hasta diciembre,
  nunca desde enero. Un alumno creado en noviembre solo recibe noviembre y diciembre.
  No se exige orden de pago; cada mes genera su propia boleta.
- El pago de matrícula y la generación de pensiones son una sola transacción. Si la
  generación falla, el alumno **no** queda `Matriculado`; la respuesta de pago incluye
  `pensiones_generadas`.
- La base desechable usada para H44 se creó desde el dump de demo, se probó con
  backend/puerto 3000 y se eliminó al terminar; `siga_uc` no se tocó.
- H46: “Especialidad” solo existe para DOCENTE (id_rol 2). ADMIN/SECRETARIA se guardan
  con `NULL`; “Cargo” aplica a todos. El módulo Personal nunca acepta ESTUDIANTE (4).
- Los datos históricos no se corrigen automáticamente: en `siga_uc` hay 1 usuario no
  docente (SECRETARIA, id_usuario 2) con especialidad “Auxiliar Administrativo”; se
  limpiará cuando el dueño edite esa ficha. No se tocaron roles ni nombres.
- El carné y el QR no se modificaron en H46.
- H45: la pensión del **mes de retiro** se mantiene `PENDIENTE` y se cobra completa;
  solo se anulan meses posteriores. Los `pre_tickets PENDIENTE` se anulan todos.
  Pagar una pensión `ANULADO` responde 400 “La pensión está anulada.”.
- H45: al regenerar el cronograma de un alumno, `ON CONFLICT` cambia `ANULADO` a
  `PENDIENTE` sin tocar montos ni descuentos. El generador mensual global no cambió.
- La migración H45 se aplicó dos veces en `siga_uc_h45` (idempotente) y la base se
  eliminó; `siga_uc` no se tocó.
- H47: Supabase ya tiene **43 tablas** y local **44** (43 base + `horarios_h47_backup`);
  H49 está solo en local. Una base creada con `siga_uc_completo.sql` debe aplicar
  `migracion_h47_horarios.sql` y `migracion_h49_multianio_base.sql` a mano; el dump no se
  editó.
- H47: la migración guarda las filas antiguas en `horarios_h47_backup`, mapea los 10
  bloques CLASE a BORRADOR y convierte los 3 recreos en el período de receso. Si algo no
  mapea, aborta sin borrar.
- H47: el alumno de 2do deja de ver el horario migrado hasta que ADMIN publique; es
  intencional (BORRADOR invisible).
- H47: el generador **no publica**. Preflight 422 si un docente/grado supera la capacidad;
  `forzar=true` genera parcial y devuelve `sin_ubicar`. El seed de producción tiene 55
  cargas/145 h en el ADMIN (capacidad 40), así que primero hay que reasignar docentes.
- H47: generar sobre un grado con bloques PUBLICADO responde 409; hay que despublicar.
- H47: editar/eliminar un bloque publicado exige `confirmar=true` y devuelve todo el grado
  a BORRADOR. Cambiar docente de una carga publicada responde 409 con el mensaje exacto
  “Despublique el horario antes de cambiar el docente.”.
- H47: en BORRADOR, cambiar docente reasigna los bloques en la misma transacción; un
  choque con el nuevo docente devuelve 409. Cambiar grado/curso/año exige `confirmar=true`
  y elimina los bloques en borrador.
- H47: el generador considera los bloques de **otros grados** para el mismo docente. El
  aula es nullable y su UNIQUE es parcial e insensible a mayúsculas/espacios.
- H47: cambiar `id_personal` de una carga con SQL directo deja los horarios apuntando al
  docente anterior; usar `PUT /api/carga-curricular/:id`, que reasigna o bloquea.
- H47 demo: `database/demo_h47_docentes.sql` es **solo para demo**. Detecta docentes por
  cargas existentes (no por nombres): en local reutiliza a Pérez/Aguilar/Vilchez/Gómez y crea
  solo a Demo 1; en Supabase, sin docentes con carga, crea Demo 1–5. Credenciales:
  `99000001`–`99000005` con contraseña igual al DNI.
- H47 demo: en una base recién migrada, los 10 borradores CLASE de 2do tienen `creado_por`
  nulo y no bloquean el script; el generador los reemplaza. El script **no los limpia**; si
  se reejecuta en una base con borradores, revisar la grilla antes de generar/publicar.
- H47 demo: el script aborta si hay horarios PUBLICADOS o generados (`creado_por` no nulo).
  Para reejecutarlo hay que despublicar/limpiar primero.
- H47 demo: la limpieza borra los horarios generados por el ADMIN, asegura ficha del ADMIN,
  devuelve todas las cargas al ADMIN y elimina usuarios/personal/QR demo. **No borra
  `horarios_h47_backup`**.
- H47 demo: tras la limpieza, las cargas quedan en el ADMIN. Si se vuelve a ejecutar el
  script en local, como no hay docentes con cargas, creará los 5 demo; es el comportamiento
  esperado de la detección por cargas.
- H47 demo: los correos son `docente.demoN@demo.local`; el QR usa el patrón real
  `QR-<DNI>-<UPPER(MD5(DNI || 'SIGAUC'))>`.
- H47 demo: el script **no limpia** los BORRADOR migrados que ya existían; solo reasigna
  cargas y, si hay horarios generados/publicados, aborta. Si se re-ejecuta en una base con
  borradores, revisar la grilla antes de generar/publicar.
- **Despliegue:** un `git push` que solo toca `database/` o `documentacion/` **no
  redepliega** Render. El código desplegado es `9648689` (backend y frontend), que incluye
  H50/H63 y H48/H51. `a9acf24` fue solo datos demo.
- **Migraciones:** se aplican **a mano** en Supabase. Un push no las ejecuta. H47 y H48 ya
  están aplicadas en `siga-uc-prod`.
- **Credenciales:** el ADMIN local y el ADMIN de producción **no comparten contraseña**.
  La de producción es la real del dueño y no está en `.env`.
- H47: `test:integridad` espera 43 tablas base (H49 + H73); `test:e2e` aplica H45, H47,
  H48, H61, H49 y H73. `npm run test:h47-generador` no toca BD (**4 PASS**).
- H47: el frontend viejo llama al endpoint retirado `/horarios/grado/:id_grado`; desplegar
  backend y frontend juntos o esperar 404 en la vista del alumno.
- H50: `/caja/actual` devuelve `total_ingresos_efectivo`, `total_ingresos_digital`,
  `total_egresos_efectivo` y `total_egresos_digital`; el "efectivo en cajón" usa solo
  efectivo. `cerrar` devuelve `egresos_efectivo`, `egresos_digital` y `total_digital`.
  No volver a usar `total_ingresos` para el arqueo.
- H63: `GET /api/auditoria/actas/:id_acta/pdf` es ADMIN-only; DOCENTE recibe 403. Si se
  habilita DOCENTE, validar `acta.id_grado` y no exponer actas globales.
- H48: el cierre usa `INSERT ... ON CONFLICT (anio_lectivo, bimestre, id_grado)`; el
  periodo se deriva del bimestre. Un acta global `CERRADO` bloquea **todos** los grados.
  Cerrar dos veces da 409; reabrir exige motivo de 10-250 y solo aplica a `CERRADO`.
- H48: la migración agrega `bimestre`, reapertura y el índice único `NULLS NOT DISTINCT`.
  Ya está aplicada en Supabase (4 columnas nuevas + `uq_acta_anio_bimestre_grado`,
  0 actas); en local se ejecutó 3 veces sin errores.
- H51: el selector de bimestre de libretas quedó visible; el PDF usa el bimestre elegido.
  El valor por defecto sigue siendo 2.
- H61: `dia_semana` se deriva de `fecha` en el backend con `EXTRACT(ISODOW)` y se guarda en
  español; el valor que envíe el frontend se ignora. La migración
  `database/migracion_h61_dia_semana.sql` es solo de datos (no cambia esquema) y es
  idempotente. En local normalizó 12 filas (6 días desfasados y 6 en inglés; 2 ya estaban
  correctas). Aún no se aplicó en Supabase.
- H61: para fechas `YYYY-MM-DD` usar `parseFechaLocal`/`diaSemanaLocal` de
  `core/utils/fecha.util.ts`; `new Date('YYYY-MM-DD')` se interpreta como UTC y en Lima
  devuelve el día anterior.
- H56: el historial (`/asistencias/alumno/:id`), el resumen (`/resumen`), la libreta, el
  PDF y el resumen por grado filtran por `EXTRACT(YEAR FROM fecha)`. Sin `?anio=` se usa
  `ANIO_LECTIVO`; `?anio=YYYY` explícito tiene prioridad. No volver a sumar todos los años
  en reportes de asistencia.
- H56: la UI de “Mi Asistencia”, la ficha del docente y la libreta envían el año desde
  `ConfiguracionService` (`anioLectivo()`).
- H60: una observación sin P/T/F se marca en rojo y bloquea el guardado con mensaje
  inline; no se envía al backend hasta marcar estado. El backend sigue exigiendo P/T/F.
  Verificado en navegador: sin estado no hubo confirmación ni POST; con “Presente” se
  guardó y la observación persistió tras recargar.
- H57: el sidebar del estudiante usa `info_adicional.nombre_grado`; “Cursos Matriculados”
  sale de `GET /carga-curricular?id_grado=&anio=`, no de las notas. La felicitación solo
  se muestra si `tieneNotas()`. Verificado con `74829103` (2do): sidebar “2do de
  Secundaria”, KPI 11, mensaje neutral y horario “2do de Secundaria Única”.
- H58: los documentos imprimibles llevan `documento-visible`; los que están dentro de un
  modal añaden `documento-modal` para no salir del flujo (si se posicionan absolutos, el
  modal colapsa y recorta el QR/reporte). Libreta, boleta y acta siguen descargando PDF de
  backend; no cambiar esos botones a `window.print()`.
- H72: el login solo acepta `returnUrl` que empiece con `/`, no con `//` y no sea `/login`.
  Una ruta desconocida con sesión muestra `NotFoundComponent`, no el login.
- H64: un deep link directo debe responder 200 desde el servidor (rewrite de Render). El
  repo genera `404.html`, pero la app no depende de él para rutas internas.
- H49: `alumnos` ya **no** es único por DNI global. No asumir “un alumno por persona”; toda
  consulta operativa debe filtrar `anio_lectivo` y los históricos usar `?anio=YYYY`.
- H49: `usuarios` sigue siendo único por DNI y `credenciales_qr` una por usuario. La
  matrícula anual es la fila de `alumnos`; el QR no se duplica.
- H49: el año activo se lee al arrancar. Desde 6.2, la activación desde la UI/API actualiza
  la caché sin reiniciar; un cambio manual con SQL exige reiniciar el backend.
- H49: `ANIO_LECTIVO` ya no es la fuente principal. Si la tabla no existe o no tiene un
  único `ACTIVO`, el backend usa el env y avisa por consola.
- H49: `asistencia_alumnos` no tiene `anio_lectivo`; no agregar la columna en 6.1. El año
  se deriva de `fecha`.
- H49: `preparar_anio_lectivo.sql` sigue siendo **histórico y parcial** (conceptos y
  períodos). No crea grados, carga ni tutores; la UI de 6.2 lo reemplaza.
- H49: el retiro de una matrícula **no** desactiva al usuario si tiene otra matrícula no
  retirada en otro año. No volver a un `UPDATE usuarios ... INACTIVO` incondicional.
- **6.2:** no hay migración nueva. Los endpoints `/api/anios-lectivos` son solo ADMIN y, si
  falta `anios_lectivos`, responden `503 H49_NO_APLICADO`.
- **6.2:** el preview no escribe y devuelve `preview_hash`; el confirm lo recalcula dentro
  de la transacción y responde `409 PREVIEW_DESACTUALIZADA` si cambió la fuente, la
  actividad o los conflictos.
- **6.2:** el confirm clona solo la oferta (grados, conceptos, períodos, carga, tutores).
  No crea alumnos, matrículas, pagos, notas, asistencia, actas, becas, QR ni horarios.
- **6.2:** el hash no incluye la oferta del destino para que el confirm repetido sea
  idempotente. No “arreglar” eso incluyéndola: rompe la idempotencia.
- **6.2:** la activación solo acepta `PLANIFICADO → ACTIVO`, cierra el año anterior y deja
  un solo `ACTIVO`. No reactiva `CERRADO`. No activar 2027 en Supabase/demo hasta cerrar 6.3:
  los alumnos sin matrícula 2027 quedan con `matricula_activa=false`.
- **6.2:** la reversión exige año `PLANIFICADO`, no activo, sin actividad y con la marca
  `Rollover desde YYYY` y oferta exacta. Una oferta manual distinta aborta con `409`.
- **6.2:** en `siga_uc` local las 142 h están en el ADMIN y el preview bloquea por
  sobrecapacidad. Es correcto; el E2E reequilibra su base desechable. Supabase tiene
  30/30/30/30/25 h.
- **Estado 6.2:** implementado, verificado y **desplegado en Render**; no aplicado/activado
  en Supabase. `2026` sigue activo allí y `/admin/anios-lectivos` muestra 503 hasta aplicar
  H49.
- **6.3:** requiere H73 aplicada después de H49. No hay `TRASLADADO`; el traslado es
  `RETIRADO` + `alumnos.condicion='Traslado'` + `metadata.retiro.motivo='TRASLADO'`.
- **6.3:** el preview es de solo lectura. El hash incluye años, política, decisiones,
  conteos y bloqueos de origen; **no** incluye las matrículas creadas en el destino, para que
  el confirm idempotente conserve el mismo hash. No “arreglar” eso incluyéndolas.
- **6.3:** el confirm crea matrícula/expediente/pre-ticket; no crea usuario, QR, notas,
  asistencia, pagos, pensiones ni pre-tickets heredados. `PendientePago` si hay MATRICULA;
  si no, `Matriculado` con advertencia.
- **6.3:** un override exige `permite_override=true` y motivo ≥5; sin eso, el confirm
  responde `422 PROMOCION_BLOQUEADA`. La asistencia bajo umbral es advertencia, no exclusión.
- **6.3:** la anulación borra la matrícula destino solo si no hay pagos/notas/asistencia/
  pensiones/pre-tickets pagados; si hay actividad, `409 PROMOCION_CON_ACTIVIDAD`. El
  reintento se enlaza con `id_promocion_reversa`. La promoción no activa el año.
- **6.3:** `SECRETARIA` puede listar políticas, previsualizar y consultar promociones por
  API; confirmar y anular son solo ADMIN. DOCENTE/ESTUDIANTE reciben 403.
- **Estado 6.3/6.3.1:** implementado, verificado y **desplegado en Render (`89eba24`)**;
  H73 aplicada en Supabase demo. 21 integridad en base nueva y 19/2 en local.
  Supabase: 43 tablas, 2026 activo, 1 política, 0 promociones; 2027 no se activa.
- **6.4:** sin migración. `GET /api/anios-lectivos` es legible por ADMIN/SECRETARIA;
  escrituras solo ADMIN. Asistencia y calificaciones históricas validan la matrícula anual y
  responden `404 MATRICULA_NO_ENCONTRADA_EN_ANIO`. El consolidado por DNI se agrupa por
  `id_usuario`, nunca por `id_alumno`.
- **6.4 UI:** selector de año con default activo; años no activos muestran **Histórico** y
  ocultan escrituras en padrón y tesorería. `/admin/historico` enlaza con `?anio`. La ficha
  docente se mantiene en el año activo.
- **Estado 6.4:** implementado, verificado y **desplegado en Render (`cdc129e`)**; 72 E2E,
  20 integridad, smoke 11, H47 4, build OK. Supabase no se modificó (sin migración).
- **7 — H62:** `POST /api/notificaciones` es ADMIN/SECRETARIA; DOCENTE 403 y `/masivo` solo
  ADMIN. No volver a habilitar DOCENTE sin validar pertenencia de cada destinatario.
- **7 - H59:** `personal.observaciones` viene de `migracion_h59_observaciones_personal.sql`.
  **Ya está aplicada en Supabase demo**; 43 tablas, 2026 activo. El backend tolera bases sin
  la columna, pero el cese con observación responde 503 hasta aplicarla.
- **7 — H65/H66:** `total_docentes` no reemplaza a `total_personal`; la UI muestra ambos.
  El panel “Cobranza y expedientes” no promete alertas de asistencia.
- **7 — H68:** el hash del acta es MD5 de integridad, no firma digital. No prometer valor
  legal ni no repudio.
- **7 — H69:** `/en-construccion` fue eliminado; los textos de demo y `lang="en"` no deben
  volver. El login avisa que el correo está en modo prueba.
- H49: el rollback está probado solo en bases desechables; aborta si detecta varias
  matrículas por persona o promociones con filas. **No ejecutarlo en Supabase.**

---

## 7. Próximo paso exacto (demo y aprobación)

H49/H73/H59 están aplicadas en Supabase demo (43 tablas, 2026 ACTIVO, 1 política,
0 promociones, 0 actas, 145 horarios, 5 docentes). El cierre de demo, el login responsive,
el sidebar y los módulos del estudiante están en Render (`df1f384`; documentación
`9a29122`). `/api/anios-lectivos`, `/api/promociones`, `/api/reportes/consolidado/:dni` y
`/api/siagie/*` existen y responden 401 sin token.

1. No volver a aplicar H49/H73/H59 en Supabase.
2. Mantener 2026 activo. No activar 2027 en la demo.
3. En Supabase, si se necesita oferta 2027, confirmar el rollover 2026→2027 (solo oferta).
4. **H71 no se aplicó en Supabase** porque no hay alumnos retirados; aplicarlo antes de
   datos reales o si el invariante 21 falla.
5. Probar en Supabase **solo previews** de promoción; el confirm/anulación se valida en
   local/E2E. Con 0 actas, el preview bloqueará por actas: es correcto.
6. **SIAGIE es exportación interna**: no prometer integración oficial con MINEDU. El Excel
   incluye todos los cursos del grado y el aviso visible.
7. No iniciar Fase 8 ni cargar datos reales sin aprobación.
8. El rollback H49/H73/H59 **no** se ejecuta en Supabase.
9. **Siguiente bloque:** responsive de ADMIN, SECRETARÍA y DOCENTE. Login, sidebar y
   ESTUDIANTE ya están adaptados. No mezclar con Fase 8.

> **No reejecutar** `database/demo_h47_docentes.sql` sobre Supabase mientras haya horarios
> publicados: el guard aborta, pero primero hay que despublicar/limpiar. Resend real y
> planes pagos quedan para después de la aprobación.

---

## 8. Pendiente después de la aprobación

Nada de esta lista se hace en la fase actual.

| Tema | Qué queda pendiente |
|---|---|
| **Guion de demo** | Usar `documentacion/17-GUION-DEMOSTRACION.md` en cada demo |
| **Resend real** | Comprar/autorizar un dominio, verificar SPF/DKIM, cambiar `EMAIL_FROM` y probar un envío a un tercero. Hoy es `onboarding@resend.dev` y solo llega a la cuenta dueña de Resend |
| **Planes pagos** | Render Starter para evitar el sleep y Supabase pago para evitar la pausa; decidir backups/retensión |
| **Datos reales** | Limpiar datos de prueba, cargar alumnos/personal reales, rotar credenciales y actualizar `FRONTEND_URL`/`EMAIL_FROM` |
| **Backups definitivos** | Verificar `pg_dump` en la Shell de Render o documentar el uso de los backups de Supabase |
| **Smoke contra producción** | `SMOKE_ADMIN_PASSWORD` real en `.env` de sesión y `npm run smoke` contra Render: 11 PASS, 0 FAIL, 0 SKIP. Escribe `ultimo_login`, `LOGIN` y `DESCARGAR` en la bitácora. Solo con confirmación explícita |
| **Migraciones** | H47, H48, H49, H59 y H73 ya aplicadas en Supabase demo. H61 es solo datos y **aún no** está aplicada allí. Cierre de demo y responsive desplegados en Render (`df1f384`). Las próximas, **a mano**, en orden, con archivos idempotentes. Un `git push` que solo toca `database/` o `documentacion/` **no despliega** |
| **Integridad** | `npm run test:integridad` contra la base definitiva: 21 PASS |
| **Multi-año** | 6.2 rollover, 6.3/6.3.1 promoción y 6.4 histórico implementados y desplegados en Render (`cdc129e`); H49/H73 aplicadas en Supabase demo. 6.4 no tiene migración. 2026 debe seguir activo en Supabase hasta la aprobación |
| **Promociones** | 6.3 no crea usuarios ni QR; no copia notas/pagos/pensiones; no activa el año. La política estándar se siembra con el año ACTIVO. Revisar con dirección/UGEL los criterios de repitencia y transición |
| **Fase 7 / cierre** | H62, H59, H65, H66, H67, H68, H69, H70 y H71 cerrados. H59 aplicada en Supabase demo; H71 aplicado en local y pendiente solo en Supabase (no hay retirados). SIAGIE interno, UAT y guion listos |

---

## 9. Verificar el entorno

```powershell
git log -1 --oneline
# Solo si la base aún no tiene H47/H48/H61/H49/H73/H59/H71:
psql -U postgres -d siga_uc -f database/migracion_h47_horarios.sql
psql -U postgres -d siga_uc -f database/migracion_h48_actas.sql
psql -U postgres -d siga_uc -f database/migracion_h61_dia_semana.sql
psql -U postgres -d siga_uc -f database/migracion_h49_multianio_base.sql
psql -U postgres -d siga_uc -f database/migracion_h73_promociones.sql
psql -U postgres -d siga_uc -f database/migracion_h59_observaciones_personal.sql
psql -U postgres -d siga_uc -f database/migracion_h71_retirados_historicos.sql
psql -U postgres -d siga_uc -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'; SELECT anio, estado FROM anios_lectivos ORDER BY anio; SELECT indexname FROM pg_indexes WHERE indexname='ux_pago_pension_activo';"
# Requiere el backend corriendo en localhost:3000
curl.exe -s http://localhost:3000/api/health
cd siga-uc-backend; npm run smoke          # 11 PASS, exit 0
npm run test:integridad                    # 21 invariantes; revisar FAIL reales
npm run test:e2e                           # 75 PASS, exit 0; elimina siga_uc_e2e
npm run test:h47-generador                 # 4 PASS; no toca BD
```

El primero confirma el commit; los `psql` aplican H47/H48/H61/H49/H73/H59/H71 si faltan; el conteo
debe devolver **43** sin backup o **44** con `horarios_h47_backup`; `anios_lectivos` debe
tener un solo `ACTIVO`; el health debe devolver `success: true` y `database: "ok"` **con el
backend en marcha**; el smoke debe terminar en **11 PASS, 0 FAIL**; integridad puede reportar
violaciones reales de seed; E2E debe terminar en **75 PASS, 0 FAIL** y dejar `siga_uc_e2e`
eliminada; el generador en **4 PASS**. La base nueva de producción debe dar **21 PASS**.

Para una base **definitiva** (solo después de la aprobación):

```powershell
createdb -U postgres siga_uc
psql -U postgres -d siga_uc -f database/siga_uc.sql
psql -U postgres -d siga_uc -v anio_lectivo=2027 -v admin_password="TuClaveTemporal" -f database/seed_produccion.sql
psql -U postgres -d siga_uc -f database/migracion_h32_anulacion_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h10_h38_concurrencia_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h07_auditoria.sql
psql -U postgres -d siga_uc -f database/migracion_h45_pensiones_anuladas.sql
psql -U postgres -d siga_uc -f database/migracion_h47_horarios.sql
psql -U postgres -d siga_uc -f database/migracion_h48_actas.sql
psql -U postgres -d siga_uc -f database/migracion_h61_dia_semana.sql
psql -U postgres -d siga_uc -f database/migracion_h49_multianio_base.sql
psql -U postgres -d siga_uc -f database/migracion_h73_promociones.sql
psql -U postgres -d siga_uc -f database/migracion_h59_observaciones_personal.sql
psql -U postgres -d siga_uc -f database/migracion_h71_retirados_historicos.sql
cd siga-uc-backend; npm run test:integridad   # 21 PASS
```

---

## 10. Prompt de arranque para la nueva sesión de código

```text
Estás retomando la sesión de CÓDIGO de SIGA-UC. No es una sesión de asesoría.
Tu tarea ahora es continuar con el DISEÑO RESPONSIVE de los módulos de ADMIN,
SECRETARÍA y DOCENTE, sin romper funcionalidades ni cambiar el stack.

## Lectura mínima (en este orden)
1. AGENTS.md (raíz).
2. HANDOFF_SESSION.md: secciones 1.8, 1.9, 1.10, 1.11, 7 y 10.
3. HANDOFF_PROMPTS.md: estado del sistema y pendientes.
4. documentacion/09-FRONTEND-UI-Y-NAVEGACION.md.
5. documentacion/13-OPERACION-MANTENIMIENTO-Y-TESTEO.md.
6. documentacion/15-HALLAZGOS-RIESGOS-Y-MEJORAS.md.
7. documentacion/17-GUION-DEMOSTRACION.md.
8. Revisar el código real antes de modificar: layouts, sidebars, header y módulos.

## Estado verificado al cierre (22/11/2026)
- HEAD local: 9a29122. Código desplegado en Render: df1f384.
- Frontend de Render sirve main-SCTCECV3.js (build de df1f384).
- API Render: 200, database "ok".
- E2E 75 PASS; integridad 21 PASS en base nueva y 19/2 de seed local;
  smoke 11 PASS; H47 4 PASS; build Angular OK.
- Supabase demo: 43 tablas, 2026 ACTIVO, 2027 NO activo, 1 política,
  0 promociones confirmadas, 0 actas, 1 alumno. No tocar sin autorización.
- Ya están hechos: SIAGIE interno, H70, H71 local, login responsive,
  sidebar con scroll en los 4 roles y módulos del ESTUDIANTE responsive.

## Objetivo de esta sesión
Adaptar a móvil, tableta, plegable, laptop y escritorio los módulos de:
- ADMIN: dashboard, padrón, personal, carga, horarios, años lectivos,
  promociones, tesorería, caja, SIAGIE, reportes, histórico y auditoría.
- SECRETARÍA: dashboard, padrón, tesorería, caja, asistencia QR y horarios.
- DOCENTE: dashboard, notas, asistencia, ficha, horarios y reportes.

Prioridad:
1. Que ninguna pantalla tenga desbordamiento horizontal.
2. Que tablas anchas hagan scroll interno (no que rompan la página).
3. Que filtros, formularios, modales y botones sean táctiles y legibles.
4. Que el sidebar/drawer y el header sigan funcionando como en ESTUDIANTE.
5. No tocar rutas, servicios, permisos, endpoints ni lógica de negocio.

## Reglas
- No cambiar el stack. No agregar librerías de UI.
- No implementar Fase 8. No integrar SIAGIE oficial. No activar 2027.
- No tocar Supabase ni cargar datos reales.
- Mantener el español en mensajes, documentación y commits.
- Commits atómicos: un bloque por rol o por módulo.
- Antes de cada commit: npm run build; node --check si se toca backend.
- Antes de desplegar: npm run test:e2e (75+ PASS) y npm run smoke (11 PASS).
- Si se toca integridad: npm run test:integridad (21 PASS en base nueva).
- Probar en navegador a 320×568, 360×640, 390×844, 412×915, 600×960,
  768×1024, 1024×600, 1366×768 y 1920×1080.
- No imprimir tokens, correos ni contraseñas.

## Entorno local
- Backend: http://localhost:3000 (npm run dev en siga-uc-backend).
- Frontend: http://localhost:4200 (ng serve en siga-uc-frontend).
- Base local: siga_uc (21 alumnos; 54 cargas/142 h en el ADMIN; 0 horarios
  publicados). La carga docente y el horario del estudiante requieren
  preparación manual para la demo.
- Credenciales de demo en docs/CREDENCIALES.md y README.md. La contraseña del
  ADMIN de producción no está en el repo.

## Entregable esperado
- Módulos ADMIN/SECRETARÍA/DOCENTE adaptados sin romper nada.
- Pruebas responsive documentadas.
- Build, E2E, smoke e integridad ejecutados.
- Commits y push a origin/main; Render actualizado y verificado.
- HANDOFF_SESSION.md, HANDOFF_PROMPTS.md, AGENTS.md y documentacion/09
  actualizados con el nuevo estado.

Empieza inspeccionando los layouts y sidebars reales, propone el orden de
módulos y no modifiques nada hasta confirmar el alcance.
```
