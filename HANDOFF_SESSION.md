# HANDOFF_SESSION.md — SIGA-UC

> **Fase actual: demostración y aprobación.** SIGA-UC se muestra a la dirección del
> colegio; **no es producción real**. Nada de dominios, DNS, planes pagos ni datos de
> menores hasta que la dirección apruebe. Alcance completo en la sección 0.

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

- **Fecha:** 21/11/2026
- **Commit base de esta sesión:** `22e06f6 fix(alumnos): anular pensiones y pretickets futuros al retirar (H45)`
- **Commits de esta sesión:** aviso de correo en modo prueba, documentación de la fase de
  demostración, **H47** (esquema+CRUD `cf3c988`, generador `e65f60f`, UI `65e73a3`) y
  **datos demo H47** (`c4be5ac`).
- **Estado:** fase de demostración fijada. **H47 está aplicado en `siga_uc`**; Supabase
  tiene H47 desplegado según el dueño. El script de datos demo está probado y la base local
  quedó limpia (cargas en ADMIN, sin usuarios demo, backup intacto). Sin cambios en
  producción.
- **Datos demo H47:** `database/demo_h47_docentes.sql` crea solo los docentes que faltan
  según las cargas existentes. En local, con la distribución original de 4 docentes, crea
  únicamente a **Docente Demo 1** (`99000001`, contraseña `99000001`). En Supabase, donde
  todas las cargas están en ADMIN, crea **Docente Demo 1–5** (`99000001`–`99000005`,
  contraseña = DNI). Tras la limpieza local, todas las cargas quedaron en ADMIN; una nueva
  ejecución del script en local detectará 0 docentes con carga y creará los 5.
- **Verificación H47:** base desechable con 142 bloques completos en carga coherente; 20 h
  sin ubicar con docente sobrecargado; `test:h47-generador` **4 PASS**; E2E **14 PASS**;
  build Angular OK. La UI se probó en navegador con ADMIN, SECRETARIA, DOCENTE y
  ESTUDIANTE.
- **Verificación datos demo H47 (21/11/2026):** script ejecutado dos veces sin duplicados;
  local **54 cargas/142 h**, docentes 30/30/30/27/25; generación **142/142**, 0 sin ubicar;
  2do y 3ro publicados; Demo 1 vio 12 bloques en dos grados; alumno de 2do vio solo su grado
  y solo PUBLICADO; limpieza dejó **54 cargas en ADMIN, 0 usuarios/personal/QR demo,
  0 horarios y backup de 13 filas intacto**.
- **Verificación local previa:** `npm run smoke` **11 PASS** (exit 0), `npm run test:e2e`
  **14 PASS** (exit 0) e integridad **8 PASS / 2 FAIL** esperados del seed. Notificación
  sin correo: guardada y visible en la campanita. La contraseña del ADMIN local se alineó
  con `SMOKE_ADMIN_PASSWORD` de `.env` (no se documentó).

---

## 2. Entorno

- Desarrollo **local**:
  - Backend: `http://localhost:3000`
  - Frontend: `http://localhost:4200`
  - PostgreSQL 18 local, base `siga_uc`.
- **Demo desplegada (21/11/2026):**
  - Frontend: <https://siga-uc-web.onrender.com>
  - Backend: <https://siga-uc-api-prod.onrender.com/api>
  - Ambos **Live** en el commit `22e06f6`, con servicios **gratuitos**.
- Base de demo: Supabase `siga-uc-prod` (us-west-2), plan gratuito, **H47 desplegado**
  (según el dueño; no consultado en esta sesión), **10 períodos**. Carga 2026:
  **55 cargas/145 h, todas en el ADMIN** antes de aplicar el script demo.
- Datos de la demo: solo usuarios y alumno de prueba; noviembre y diciembre ya generados.
  **No hay datos reales.**
- **No hay staging.**
- Render gratuito puede dormir por inactividad y Supabase gratuito puede pausarse; entrar
  unos minutos antes de la demo para despertar ambos servicios.
- La BD local `siga_uc` tiene **H47 aplicado**: **41 tablas** (40 + `horarios_h47_backup`),
  **10 períodos**, **0 horarios** tras la limpieza y **13 filas** en el backup.
- Datos locales tras la limpieza: **21 alumnos, 29 usuarios, 54 cargas/142 h todas en el
  ADMIN** (ficha personal nueva del ADMIN), **0 usuarios/personal/QR demo** y **0 horarios**.
  El índice `ux_pago_pension_activo` existe.
- Credenciales de prueba: `docs/CREDENCIALES.md`. La clave de PostgreSQL local está en
  `siga-uc-backend/.env` (`DB_PASSWORD`); no se escribe en este documento.
- `npm run smoke` existe (`siga-uc-backend/scripts/smoke.js`): 11 pruebas de solo lectura,
  timeout de 10 s por petición. Lee las credenciales de `SMOKE_*` y de
  `siga-uc-backend/.env`; nunca las imprime. Códigos de salida: `0` solo sin FAIL y sin
  SKIP; `1` si hay FAIL; `2` si hay SKIP sin `SMOKE_ALLOW_SKIP=1`.
- Verificación local del 21/11/2026: **11 PASS, 0 FAIL, 0 SKIP** (exit 0) con las tres
  cuentas; **3 PASS, 0 FAIL, 8 SKIP** (exit 2) sin credenciales.
- `npm run test:integridad` (`scripts/test-integridad.js`): 10 invariantes de solo lectura
  sobre cualquier base. Fuerza `default_transaction_read_only=on`. Exit 1 si hay FAIL.
- `npm run test:e2e` (`scripts/test-e2e.js`): crea `siga_uc_e2e`, carga el dump y las
  migraciones, arranca el backend en el puerto 3101, ejecuta 14 flujos y elimina la base
  con `dropdb --force`. Verificado dos veces seguidas: **14 PASS, 0 FAIL** y exit 0.
- Integridad local del 21/11/2026: **8 PASS, 2 FAIL** por datos de seed reales
  (invariantes 4 y 8: 5 pagos sin INGRESO y 144 pensiones PAGADO sin pago). El
  invariante 7 ya no marca al ADMIN: solo exige ficha a ESTUDIANTE (rol 4) y
  DOCENTE (rol 2).
- `database/seed_produccion.sql` crea solo catálogos, una caja y un ADMIN inicial
  (`74829102`, `requiere_cambio_password=TRUE`) con contraseña recibida por
  `-v admin_password`. En `siga_uc_prod_test`: **10 PASS, 0 FAIL**, **0 alumnos,
  0 pagos, 0 pensiones, 1 usuario**. Login inicial bloqueado con
  `CAMBIO_PASSWORD_REQUERIDO`; tras cambiarla, login y `/alumnos` funcionan.
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
| H06 | Acta cerrada bloquea notas | `f02f88a` |
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
| H47 | Horarios por bloques, `mi-horario`, CRUD, publicación, generador y UI | `cf3c988`, `e65f60f`, `65e73a3` |

---

## 4. Hallazgos PENDIENTES

| Hallazgo | Detalle | Severidad | Esfuerzo |
|---|---|---|---|
| H05 | SIAGIE limitado a 4 cursos y primera hoja | Alta | M |
| H21 | Cambio de rol no regenera QR ni permisos históricos | Media | S |
| H22 | N+1 en tesorería (pensiones por alumno) | Media | S/M |
| H23 | Paginación faltante en personal, pagos y pre-tickets | Media | M |
| H24 | Sin tests automatizados ni CI/CD | Media | L |
| H26 | Documentación histórica desactualizada | Baja | S |
| H27 | `.env.example` usa SMTP y no Resend | Baja/Media | S |
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
`migracion_h47_horarios.sql` →
  migraciones futuras, en ese orden.
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
- H47: el esquema nuevo tiene **40 tablas**; `siga_uc` y Supabase siguen en 39 hasta
  aplicar `migracion_h47_horarios.sql` a mano. `siga_uc_completo.sql` no se editó.
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
- H47 demo: el script aborta si hay horarios PUBLICADOS o generados (`creado_por` no nulo).
  Los 10 borradores migrados de local tienen `creado_por` nulo y no bloquean; el generador
  los reemplaza.
- H47 demo: la limpieza borra los horarios generados por el ADMIN, asegura ficha del ADMIN,
  devuelve todas las cargas al ADMIN y elimina usuarios/personal/QR demo. **No borra
  `horarios_h47_backup`**.
- H47 demo: tras la limpieza, las cargas quedan en el ADMIN. Si se vuelve a ejecutar el
  script en local, como no hay docentes con cargas, creará los 5 demo; es el comportamiento
  esperado de la detección por cargas.
- H47 demo: los correos son `docente.demoN@demo.local`; el QR usa el patrón real
  `QR-<DNI>-<UPPER(MD5(DNI || 'SIGAUC'))>`.
- H47: `test:integridad` espera 40 tablas + `periodos_clase`; `test:e2e` aplica H47.
  `npm run test:h47-generador` no toca BD (**4 PASS**).
- H47: el frontend viejo llama al endpoint retirado `/horarios/grado/:id_grado`; desplegar
  backend y frontend juntos o esperar 404 en la vista del alumno.

---

## 7. Próximo paso exacto (fase demo)

1. **Aplicar los datos demo a Supabase solo con confirmación del dueño**:
   ```powershell
   psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/demo_h47_docentes.sql
   ```
   El script creará Demo 1–5 (55 cargas/145 h) y no toca horarios ni el backup.
2. Generar en Supabase `POST /api/horarios/generar { anio: 2026 }`; esperado **145/145**,
   0 sin ubicar. Luego publicar los grados que se mostrarán en la demo.
3. **Ensayar el guion** de `documentacion/17-GUION-DEMOSTRACION.md` en local, **sin
   correos reales**, incluyendo horarios: generar, publicar, ver como docente/alumno.
4. Ejecutar en local `npm run smoke` (11 PASS), `npm run test:integridad`,
   `npm run test:e2e` (14 PASS) y `npm run test:h47-generador` (4 PASS). **No** ejecutar
   nada contra Render/Supabase sin confirmación del dueño.
5. Después de la demo, limpiar los datos de prueba recreando la base (nunca si hubiera
   datos reales).

---

## 8. Pendiente después de la aprobación

Nada de esta lista se hace en la fase actual.

| Tema | Qué queda pendiente |
|---|---|
| **Resend real** | Comprar/autorizar un dominio, verificar SPF/DKIM, cambiar `EMAIL_FROM` y probar un envío a un tercero. Hoy es `onboarding@resend.dev` y solo llega a la cuenta dueña de Resend |
| **Planes pagos** | Render Starter para evitar el sleep y Supabase pago para evitar la pausa; decidir backups/retensión |
| **Datos reales** | Limpiar datos de prueba, cargar alumnos/personal reales, rotar credenciales y actualizar `FRONTEND_URL`/`EMAIL_FROM` |
| **Backups definitivos** | Verificar `pg_dump` en la Shell de Render o documentar el uso de los backups de Supabase |
| **Smoke contra producción** | `SMOKE_ADMIN_PASSWORD` en `.env` y `npm run smoke` contra Render: 11 PASS, 0 FAIL, 0 SKIP. Escribe `ultimo_login`, `LOGIN` y `DESCARGAR` en la bitácora. Solo con confirmación explícita |
| **Migraciones** | Aplicarlas **a mano** en Supabase, en orden, con archivos idempotentes. Un `git push` no las aplica |
| **Integridad** | `npm run test:integridad` contra la base definitiva: 10 PASS |

---

## 9. Verificar el entorno en 8 comandos

```powershell
git log -1 --oneline
# Solo si la base aún no tiene H47:
psql -U postgres -d siga_uc -f database/migracion_h47_horarios.sql
psql -U postgres -d siga_uc -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'; SELECT indexname FROM pg_indexes WHERE indexname='ux_pago_pension_activo';"
# Requiere el backend corriendo en localhost:3000
curl.exe -s http://localhost:3000/api/health
cd siga-uc-backend; npm run smoke          # 11 PASS, exit 0
npm run test:integridad                    # 10 invariantes; revisar FAIL reales
npm run test:e2e                           # 14 PASS, exit 0; elimina siga_uc_e2e
npm run test:h47-generador                 # 4 PASS; no toca BD
```

El primero confirma el commit; el segundo aplica H47 si falta; el tercero debe devolver
**40** y `ux_pago_pension_activo`; el cuarto debe devolver `success: true` y
`database: "ok"` **con el backend en marcha**; el quinto debe terminar en
**11 PASS, 0 FAIL**; el sexto puede reportar violaciones reales de seed; el séptimo
debe terminar en **14 PASS, 0 FAIL** y dejar `siga_uc_e2e` eliminada; el octavo en
**4 PASS**.

Para una base **definitiva** (solo después de la aprobación):

```powershell
createdb -U postgres siga_uc
psql -U postgres -d siga_uc -f database/siga_uc.sql
psql -U postgres -d siga_uc -v admin_password="TuClaveTemporal" -f database/seed_produccion.sql
psql -U postgres -d siga_uc -f database/migracion_h32_anulacion_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h10_h38_concurrencia_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h07_auditoria.sql
psql -U postgres -d siga_uc -f database/migracion_h45_pensiones_anuladas.sql
psql -U postgres -d siga_uc -f database/migracion_h47_horarios.sql
cd siga-uc-backend; npm run test:integridad   # 10 PASS
```
