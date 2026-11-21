# HANDOFF_SESSION.md — SIGA-UC

## 1. Cierre de sesión

- **Fecha:** 21/11/2026
- **Commit base de esta sesión:** `cafcda4 fix(personal): especialidad solo para docentes y roles de personal (H46)`
- **Commit de esta sesión:** `fix(alumnos): anular pensiones y pretickets futuros al retirar (H45)`
  (el hash exacto queda en `git log -1`).
- **Estado:** retiro anula deuda futura en una transacción, UI y migración H45 verificadas;
  árbol limpio.

---

## 2. Entorno

- Todo el desarrollo es **local**:
  - Backend: `http://localhost:3000`
  - Frontend: `http://localhost:4200`
  - PostgreSQL 18 local, base `siga_uc`.
- En **Render** hay una versión **ANTIGUA** con **DATOS DE PRUEBA**. **No hay datos reales.**
- **No hay staging.**
- La BD local de demo se recreó con la secuencia del dump: **39 tablas** y el índice
  `ux_pago_pension_activo` **existe** (verificado el 21/11/2026).
- Datos locales tras la recreación: **21 alumnos, 29 usuarios, 10 pagos de seed
  (+1 pago de prueba existente), 180 pensiones, 0 pensiones duplicadas**.
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
| H33 | Sin CRUD de horarios, competencias y conclusiones | Media | L |
| H35 | Estudiantes sin pantalla de libreta | Baja | S |
| H36 | Rate limit de login por IP compartida en red escolar | Media | S |

---

## 5. Decisiones de negocio tomadas

1. Las pensiones se pagan **completas**; no existen pagos parciales.
2. Las boletas son **comprobantes internos**; no van a SUNAT.
3. La anulación de un pago genera un **EGRESO** con el mismo medio de pago.
4. La auditoría registra **escrituras, accesos y descargas**; **no lecturas**.
5. El despliegue se hará primero en el **Render actual como ensayo**, con datos de
   prueba, antes del despliegue definitivo.
6. Antes de desplegar se ejecutará un **smoke test de solo lectura**.

---

## 6. Trampas conocidas

- El backend fija la sesión de PostgreSQL en `America/Lima`; el `TZ` del **proceso**
  también debe ser `America/Lima` en Render (variable de entorno, no en JS).
- **Desarrollo/demo:** `siga_uc_completo.sql` (esquema + 21 alumnos ficticios +
  ~146 pensiones PAGADO sin pago). **Nunca en producción.**
- **Producción:** `siga_uc.sql` → `seed_produccion.sql` (con `-v admin_password`) →
  `migracion_h32_anulacion_pagos.sql` → `migracion_h10_h38_concurrencia_pagos.sql` →
  `migracion_h07_auditoria.sql` → `migracion_h45_pensiones_anuladas.sql` →
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
  en la bitácora); el resto son GET. No imprime tokens ni contraseñas.
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
- En los ensayos locales de notificaciones se arrancó el backend con
  `RESEND_API_KEY=""` para no enviar correos reales; los residuos de notificaciones y
  auditoría se eliminaron al terminar.
- El hash del ADMIN de demo no coincide con `SMOKE_ADMIN_PASSWORD` (drift detectado al
  probar H43). Para las pruebas se usó una clave aleatoria temporal y se restauró el
  hash original; `npm run smoke` puede fallar en el login ADMIN hasta restablecer esa
  contraseña a un valor conocido. Los resets auditados no guardan la clave ni el hash.
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

---

## 7. Próximo paso exacto

1. **Ensayo de despliegue en el Render actual con el escenario de producción**:
   - Crear la base con `siga_uc.sql` → `seed_produccion.sql` (`-v admin_password`) →
     migraciones en orden. **No** usar `siga_uc_completo.sql`.
   - Configurar `NODE_ENV=production`, `FRONTEND_URL`, `TZ=America/Lima`,
     `JWT_SECRET` largo y la conexión (`DATABASE_URL`/`DB_SSL` o `DB_*`).
   - **Resend:** verificar el dominio con SPF/DKIM. Sin eso los correos solo llegan a
     la cuenta propia.
   - **Backups:** comprobar que `pg_dump` existe en el entorno de Render; si no,
     `npm run backup` falla en producción y hay que usar los backups del proveedor.
   - **Frontend:** confirmar que `environment.prod.ts` apunta a la URL real del backend
     y que el build genera `404.html`.
   - Entrar con el admin inicial (`74829102`) y cambiar la contraseña temporal.
   - Ejecutar `npm run test:integridad` contra la base de Render: debe dar **10 PASS**.
   - Antes del ensayo, ejecutar localmente `npm run test:integridad` y
     `npm run test:e2e`; el E2E debe dar 14 PASS.
   - El smoke completo necesita cuentas DOCENTE/ESTUDIANTE reales; el seed de producción
     solo trae el admin. Crear cuentas reales (o temporales) y recién entonces ejecutar
     `npm run smoke` con `SMOKE_*` de ese entorno. Sin esas cuentas, el smoke será parcial
     (exit 2) y no debe usarse como aceptación.
   - Criterio: **11 PASS, 0 FAIL, 0 SKIP**, exit code `0`. Un FAIL (exit 1) o un SKIP
     inesperado (exit 2) bloquea el ensayo. `SMOKE_ALLOW_SKIP=1` solo se usa para
     diagnósticos parciales, nunca como aceptación.
2. Revisar en Render los logs del backend y confirmar que el smoke no dejó escrituras
   de negocio (solo `ultimo_login` y los registros de LOGIN en la bitácora).
3. Solo si el ensayo pasa: planificar el **despliegue definitivo** y la carga de
   datos reales.

---

## 8. Verificar el entorno en 6 comandos

```powershell
git log -1 --oneline
psql -U postgres -d siga_uc -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'; SELECT indexname FROM pg_indexes WHERE indexname='ux_pago_pension_activo';"
# Requiere el backend corriendo en localhost:3000
curl.exe -s http://localhost:3000/api/health
cd siga-uc-backend; npm run smoke          # 11 PASS, exit 0
npm run test:integridad                    # 10 invariantes; revisar FAIL reales
npm run test:e2e                           # 14 PASS, exit 0; elimina siga_uc_e2e
```

El primero confirma el commit; el segundo debe devolver **39** y
`ux_pago_pension_activo`; el tercero debe devolver `success: true` y
`database: "ok"` **con el backend en marcha**; el cuarto debe terminar en
**11 PASS, 0 FAIL**; el quinto puede reportar violaciones reales de seed; el sexto
debe terminar en **14 PASS, 0 FAIL** y dejar `siga_uc_e2e` eliminada.

Para una base de **producción** nueva:

```powershell
createdb -U postgres siga_uc
psql -U postgres -d siga_uc -f database/siga_uc.sql
psql -U postgres -d siga_uc -v admin_password="TuClaveTemporal" -f database/seed_produccion.sql
psql -U postgres -d siga_uc -f database/migracion_h32_anulacion_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h10_h38_concurrencia_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h07_auditoria.sql
psql -U postgres -d siga_uc -f database/migracion_h45_pensiones_anuladas.sql
cd siga-uc-backend; npm run test:integridad   # 10 PASS
```
