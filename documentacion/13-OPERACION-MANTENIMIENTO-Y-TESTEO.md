# 13 — Operación, Mantenimiento y Testeo

## 1. Operación diaria

### 1.1 Antes de abrir

- [ ] PostgreSQL `Running`.
- [ ] Backend arriba (`/api/health`).
- [ ] Frontend arriba.
- [ ] Fecha/hora y zona `America/Lima` correctas.
- [ ] Caja del día aperturada (si se cobrará).
- [ ] Correo configurado (si se notificará).

### 1.2 Health check

```http
GET /api/health
```

Respuesta esperada:

```json
{
  "success": true,
  "message": "SIGA-UC API funcionando correctamente",
  "data": { "app": "SIGA-UC", "version": "1.0.0", "environment": "production", "database": "ok", "timestamp": "..." }
}
```

### 1.3 Monitoreo mínimo

| Señal | Dónde | Frecuencia |
|---|---|---|
| API viva | `/api/health` | Cada 5 min |
| Errores backend | Logs del proceso | Diario |
| Espacio en disco | Servidor | Semanal |
| Conexiones PostgreSQL | `pg_stat_activity` | Semanal |
| Cola de correos/fallos | Logs Resend | Diario |
| Backups | Almacenamiento | Diario |
| Intentos de login fallidos | Logs (no hay tabla) | Diario |

### 1.4 Logs

- `morgan("dev")` en desarrollo; en producción no hay logger estructurado.
- Los errores se imprimen con `console.error` (mensaje + stack).
- No hay correlación por request ID.
- **Recomendación:** añadir `pino`/`winston`, niveles y rotación.

---

## 2. Tareas periódicas

| Tarea | Frecuencia | Responsable | Comando/acción |
|---|---|---|---|
| Backup completo | Diario | TI | `npm run backup` (`scripts/backup.js`) |
| Smoke test de solo lectura | Antes de cada despliegue y semanal | TI | `npm run smoke` (`scripts/smoke.js`) |
| Integridad de datos (solo lectura) | Antes de desplegar y semanal | TI | `npm run test:integridad` (`scripts/test-integridad.js`) |
| E2E sobre base desechable | Antes de cada despliegue | TI | `npm run test:e2e` (`scripts/test-e2e.js`) |
| Verificar backup | Semanal | TI | Restaurar en entorno de prueba |
| Revisar logs de error | Diario | TI | Consola/plataforma |
| Revisar usuarios inactivos | Mensual | Admin | Módulo Personal |
| Revisar pensiones pendientes | Mensual | Secretaría | Tesorería |
| Generar pensiones del mes | Mensual | Secretaría/Admin | `POST /pensiones/generar` (sin UI) |
| Cerrar actas | Bimestral | Admin | Auditoría |
| Exportar SIAGIE | Bimestral | Admin | SIAGIE |
| Rotar contraseñas de prueba | Al desplegar | TI | Admin |
| `npm audit` | Mensual | TI | Backend/frontend |
| Actualizar dependencias | Trimestral | TI | Revisar breaking changes |
| Revisar `JWT_SECRET` | Anual/incidente | TI | Rotación |

---

## 3. Preparación de un año lectivo nuevo

Desde H49/6.1 la fuente principal del año activo es la tabla `anios_lectivos`;
`ANIO_LECTIVO` solo es bootstrap/respaldo. Desde 6.2 la oferta se prepara con la pantalla
ADMIN **Años Lectivos y Rollover** (`/admin/anios-lectivos`), sin escribir SQL a mano.

### 3.1 Antes de tocar el año nuevo

1. Hacer backup y verificar que se puede restaurar:

   ```powershell
   cd siga-uc-backend
   npm run backup
   ```

2. Confirmar que H49 está aplicada y que hay un solo año `ACTIVO`:

   ```sql
   SELECT anio, estado FROM anios_lectivos ORDER BY anio;
   ```

3. Revisar la carga del año origen: docentes activos y horas dentro de la capacidad
   (`períodos CLASE activos × 5 días`). El preview bloquea docentes inactivos o
   sobrecargados; no se puede confirmar hasta corregirlos.

### 3.2 Previsualizar y confirmar el rollover

1. Entrar como ADMIN → **Años Lectivos y Rollover**.
2. Elegir origen (normalmente el año activo) y destino (normalmente `activo + 1`).
3. Dejar **incluir OTROS** desmarcado salvo que se quieran copiar conceptos adicionales.
   Cambiar esa opción obliga a volver a previsualizar.
4. Pulsar **Previsualizar**. Es solo lectura: muestra grados, conceptos, períodos, carga,
   tutores, bloqueos, advertencias y un `preview_hash`.
5. Corregir cualquier bloqueo (grados sin `orden`, oferta distinta en el destino, docentes
   inactivos/sobrecargados, actividad en el destino). Volver a previsualizar tras cada
   cambio.
6. Marcar la casilla de responsabilidad y pulsar **Confirmar rollover**.
   - Es una transacción única con advisory lock por origen/destino.
   - Clona en orden: grados → conceptos → períodos → carga → tutores.
   - No crea `promociones`, alumnos, matrículas, pagos, notas, asistencia, actas ni horarios.
   - Repetir el confirm con el mismo hash es idempotente (`creados = 0`, `existentes > 0`).
7. Verificar en el catálogo que el año destino quedó `PLANIFICADO` con los conteos
   esperados.

### 3.3 Activar el año destino

1. En la fila del año `PLANIFICADO`, pulsar **Activar**.
2. Leer y aceptar la advertencia: los alumnos sin matrícula del nuevo año quedarán con
   `matricula_activa=false` hasta ejecutar la promoción (Fase 6.3).
3. Confirmar. El año anterior pasa a `CERRADO` con `cerrado_por` y `fecha_cierre`; solo
   queda un `ACTIVO`.
4. Tras el COMMIT, el backend actualiza `getAnioLectivo()` y el frontend recarga
   `ConfiguracionService`. **Los demás usuarios deben recargar la página** para ver el año
   nuevo.
5. Verificar:

   ```powershell
   curl.exe -s http://localhost:3000/api/configuracion
   ```

   Debe devolver el año nuevo en `anio_lectivo`. La bitácora registra `ACTIVAR` en el
   módulo `Años Lectivos` con el año anterior y el nuevo.

### 3.4 Revertir un rollover vacío

Solo se permite si el año está `PLANIFICADO`, no es el activo y no tiene matrículas, pagos,
notas, asistencia, actas ni horarios.

1. Pulsar **Revertir** en la fila del año.
2. Escribir un motivo de 10–250 caracteres y aceptar la responsabilidad.
3. El backend borra tutores → carga → períodos → conceptos → grados y, si el año fue creado
   por el rollover, lo retira del catálogo. Audita `REVERTIR_ROLLOVER`.
4. Si hay actividad o quedó oferta manual distinta, responde `409` y **no borra nada**.
   En ese caso se corrige manualmente con un plan de revisión.

### 3.5 Alternativa histórica (solo referencia)

`database/preparar_anio_lectivo.sql` copiaba conceptos y períodos del año anterior. Sigue
siendo idempotente, pero es **parcial**: no crea grados, carga ni tutores y no reemplaza al
rollover de 6.2. No se usa en la operación normal.

| Lugar | Qué revisar |
|---|---|
| `anios_lectivos` | Un solo `ACTIVO`; `PLANIFICADO` para el siguiente |
| `grados` | `orden` 1..N por nivel/sección; el rollover los copia |
| `alumnos.anio_lectivo` | Se asigna al matricular con el año activo; UNIQUE por año |
| `carga_curricular.anio_lectivo` | El rollover la copia; revise docentes y horas |
| `tutores_grado.anio_lectivo` | Solo tutores activos; puede quedar vacío |
| `conceptos_pago.anio_lectivo` | MATRICULA y PENSION por defecto; OTROS con confirmación |
| `calificaciones` / `notas_finales_area` | Se registran con el año de la matrícula |
| `pensiones.anio_lectivo` | Se generan con el año de la matrícula |
| Frontend / SIAGIE / reportes | Leen el año desde `ConfiguracionService` |

**Recomendación:** no volver a introducir literales `2026` en controllers, DAOs ni componentes;
usar `getAnioLectivo()` en backend y `ConfiguracionService.anioLectivo` en frontend.

### 3.6 Promociones anuales (Fase 6.3)

La promoción crea las matrículas del año destino. **No activa el año** y no copia notas,
asistencia, pagos, pensiones ni pre-tickets. Requiere H73 aplicada y la oferta del destino
creada por el rollover.

1. Hacer backup y confirmar que H73 está aplicada:
   ```sql
   SELECT COUNT(*) FROM politicas_promocion;
   SELECT COUNT(*) FROM promociones;
   ```
2. En **ADMIN → Promoción de Alumnos**, elegir origen, destino, política y grado.
3. Pulsar **Previsualizar**. Revisar actas, notas, asistencia, deuda, becas, resultado
   sugerido y bloqueos. El preview no escribe.
4. Si un alumno debe apartarse de la sugerencia, elegir otro resultado, escribir un motivo
   (mínimo 5 caracteres) y **volver a previsualizar**. Solo funciona si la política tiene
   `permite_override=true`.
5. Marcar la responsabilidad y **Confirmar promoción**. Se crean:
   - matrícula del año destino (`PendientePago` si hay MATRICULA; si no, `Matriculado` con
     advertencia);
   - expediente nuevo (`congelado=false`);
   - pre-ticket `MATRICULA` pendiente si existe el concepto;
   - promoción `CONFIRMADA` con metadata/evidencia.
   No se crea usuario, QR ni pensión.
6. **Anular** una promoción confirmada solo si la matrícula destino no tiene pagos, notas,
   asistencia, pensiones ni pre-tickets pagados. La anulación conserva la fila, borra la
   matrícula/expediente/pre-ticket y permite reintentar; el reintento se enlaza con
   `id_promocion_reversa`.
7. Si el destino ya tiene actividad, la API responde `409 PROMOCION_CON_ACTIVIDAD`; no se
   borra nada. Se corrige con un plan de reconciliación auditado.
8. Revisar la bitácora: `PREVISUALIZAR`, `CONFIRMAR`, `ANULAR`, `CREAR_POLITICA` y
   `ACTUALIZAR_POLITICA` en el módulo **Promociones**.

> Política: `permite_override` es `false` por defecto. La repitencia se activa con
> `criterio_academico.modo_repitencia='UMBRAL'`, `min_cursos_desaprobados` y
> `notas_desaprobadas`. Las actas/notas se exigen según `requiere_actas_cerradas`,
> `requiere_notas_finales`, `bimestres_requeridos` y `notas_bimestres` (arreglo 1–4; default
> `[4]`; se acepta el legado `notas_bimestre`). Se validan para **PROMOVIDO, REPITENTE y
> EGRESADO**; RETIRADO está exento. Si faltan, el resultado queda PENDIENTE y el lote no se
> confirma (`422 PROMOCION_PENDIENTE`), salvo override con motivo. La asistencia bajo umbral
> es una advertencia, no una exclusión automática. `copiar_becas` forma parte del
> `preview_hash`: cambiarlo obliga a re-previsualizar.

### 3.7 Consulta de años históricos (Fase 6.4)

Los años no activos se consultan en **modo lectura**. No requieren migración ni cambios en
Supabase: usan las tablas H49/H73 ya aplicadas.

1. En **Reportes y Libretas**, **Padrón de Alumnos** o **Tesorería**, elegir el año en el
   selector. El valor por defecto es el año activo (`ConfiguracionService`).
2. Si el año no es el activo, aparece el badge **Histórico** y se ocultan las escrituras:
   nueva matrícula, editar, retirar, reset de contraseña, cobrar y generar pensiones.
3. Las libretas, el PDF, la asistencia y las consultas siguen disponibles con `?anio=`.
4. Para ver la trayectoria completa de una persona, abrir **ADMIN → Histórico por
   Estudiante**, ingresar el DNI y revisar una fila por año. Los enlaces abren la libreta, la
   asistencia o la tesorería del año elegido con `?anio=`.
5. Regla de identidad: `usuarios.dni` es global; `alumnos` es matrícula anual. No sumar
   notas, pagos ni pensiones por `id_alumno` entre años: agrupar por `id_usuario`/DNI.
6. Si un endpoint histórico recibe un `id_alumno` de otro año, responde `404`
   `MATRICULA_NO_ENCONTRADA_EN_ANIO`; no devuelve una lista vacía.
7. `GET /api/anios-lectivos` es legible por ADMIN y SECRETARIA. Las escrituras de años
   (preview, rollover, activar, revertir) siguen siendo solo ADMIN.

### 3.8 Observaciones de cese (H59)

- Aplicar **antes de desplegar** el backend que lee `personal.observaciones`:
  ```powershell
  psql -U postgres -d siga_uc -f database/migracion_h59_observaciones_personal.sql
  ```
- Agrega `personal.observaciones text`; no modifica datos ni tablas (siguen 43).
- Es idempotente. El rollback `database/rollback_h59_observaciones_personal.sql` solo se usa
  en bases desechables o con backup verificado.
- En Supabase demo **no se aplicó** en esta fase; requiere autorización y backup.
- El cese guarda la observación y la reactivación la limpia. La ficha del trabajador cesado
  muestra fecha, motivo y observación.
- Si la columna todavía no existe, `GET /personal` sigue funcionando (devuelve
  `observaciones: null`); un cese **con** observación responde
  `503 H59_NO_APLICADO` para no perder el texto. Un cese sin observación funciona normal.

---

## 4. Testeo

El proyecto **no tiene CI ni tests unitarios**. Desde el 22/11/2026 cuenta con tres suites
de verificación antes de desplegar: **smoke test** (entorno y RBAC), **integridad**
(20 invariantes de datos, solo lectura) y **E2E** (72 flujos sobre una base desechable,
incluidos los de multi-año H49, rollover 6.2, promociones 6.3, histórico 6.4 y pulido
H59/H62/H65–H69). El resto de la estrategia sigue siendo manual y por rol.

### 4.1 Preparación

1. BD restaurada con `siga_uc_completo.sql`.
2. Backend y frontend corriendo.
3. Credenciales de `docs/CREDENCIALES.md`.
4. Consola del navegador (F12) abierta.
5. Logs del backend visibles.

### 4.2 Smoke test automatizado (solo lectura)

Script: `siga-uc-backend/scripts/smoke.js` → `npm run smoke`.

- **No escribe datos de negocio.** El único POST es `/auth/login` (actualiza
  `ultimo_login` y registra el LOGIN en la bitácora); el resto son GET.
- Timeout de **10 s por petición** (`AbortSignal.timeout`).
- Nunca imprime tokens ni contraseñas.
- Si faltan credenciales de un rol, las pruebas dependientes se marcan **SKIP**, nunca FAIL.
- Códigos de salida: `0` solo si no hay FAIL ni SKIP; `1` si hay al menos un FAIL; `2` si
  hay SKIP y no se definió `SMOKE_ALLOW_SKIP=1`. Con SKIP se imprime una advertencia de
  resultado parcial.

Variables de entorno:

| Variable | Obligatoria | Default |
|---|---|---|
| `SMOKE_BASE_URL` | No | `http://localhost:3000/api` |
| `SMOKE_ADMIN_DNI` / `SMOKE_ADMIN_PASSWORD` | Para pruebas ADMIN | — |
| `SMOKE_DOCENTE_DNI` / `SMOKE_DOCENTE_PASSWORD` | Para prueba DOCENTE | — |
| `SMOKE_ESTUDIANTE_DNI` / `SMOKE_ESTUDIANTE_PASSWORD` | Para pruebas ESTUDIANTE | — |
| `SMOKE_ALLOW_SKIP` | No | Sin definir; `1` acepta SKIP solo para diagnóstico |

El script carga `siga-uc-backend/.env` si existe (Node ≥ 20.12) sin sobrescribir las
variables ya definidas en el proceso. En Render se pasan desde el panel o solo para la
ejecución; **nunca se commitean**.

Ejecución local (las credenciales ya están en `.env`, no hace falta exportarlas):

```powershell
cd siga-uc-backend
npm run smoke
```

Las 11 pruebas cubren: health + `database: "ok"`, configuración con año numérico, 401 sin
token, login/perfil ADMIN, alumnos página 1, bitácora con paginación, pagos, libreta PDF
del primer alumno (Content-Type y firma `%PDF`), RBAC del ESTUDIANTE (403 en `/alumnos`),
login/perfil DOCENTE y libreta propia del ESTUDIANTE.

Resultado esperado en local con las tres cuentas: **11 PASS, 0 FAIL, 0 SKIP**, exit `0`.
Sin credenciales: **3 PASS, 0 FAIL, 8 SKIP**, exit `2` (resultado parcial).

> La cuenta docente `10293847` tiene `requiere_cambio_password = TRUE` y su contraseña
> documentada anteriormente ya no es válida. Usar otra cuenta docente activa (por ejemplo
> `20394812`) sin modificar contraseñas.

Contra un entorno remoto:

```powershell
$env:SMOKE_BASE_URL="https://<backend>/api"
# definir SMOKE_* con credenciales válidas de ese entorno
npm run smoke
```

Criterio de aceptación del ensayo en Render: **11 PASS, 0 FAIL, 0 SKIP**, exit `0`. Un FAIL
(exit `1`) o un SKIP inesperado (exit `2`) bloquea el despliegue. `SMOKE_ALLOW_SKIP=1` solo
sirve para diagnósticos parciales.

### 4.3 Smoke test manual (15 minutos)

| # | Caso | Pasos | Esperado |
|---|---|---|---|
| 1 | Health | `GET /api/health` | 200 + app/version |
| 2 | Login Admin | DNI 74829102 / clave en `.env` | Dashboard con KPIs |
| 3 | Login Docente | DNI 20394812 / clave en `.env` | Dashboard con cursos |
| 4 | Login Estudiante | DNI 75918234 / clave en `.env` | Notas del alumno |
| 5 | Login Secretaría | DNI 40596837 / clave en `.env` | Dashboard financiero |
| 6 | Ruta cruzada | Estando como estudiante, ir a `/admin` | Redirige a `/estudiante` |
| 7 | Campanita | Abrir buzón | Lista y contador |
| 8 | Carné | Abrir carné | QR visible |
| 9 | Logout | Cerrar sesión | Vuelve a login |
| 10 | Recuperación | Solicitar por DNI con correo | Alerta genérica |

### 4.4 Checklist ADMIN

- [ ] Dashboard carga KPIs.
- [ ] Alumnos: listar, filtrar, ver ficha.
- [ ] Alumnos: crear matrícula (probar DNI duplicado).
- [ ] Alumnos: editar, retirar, reset password.
- [ ] Personal: listar, crear, editar.
- [ ] Personal: cesar, reactivar, reset.
- [ ] Carga: seleccionar grado, ver 11 cursos.
- [ ] Carga: asignar docente, editar, eliminar.
- [ ] Carga: asignar tutor.
- [ ] QR: listar personal, marcar Puntual/Tardanza/Falta.
- [ ] Tesorería: ver pensiones, cobrar, ver boleta.
- [ ] Caja: aperturar, egreso, cerrar, ver diferencia.
- [ ] SIAGIE: ver auditoría, notificar docente, subir plantilla, descargar.
- [ ] Reportes: libreta, mérito, riesgo.
- [ ] Histórico: selector de año, badge Histórico, consolidado por DNI y enlaces con `?anio`.
- [ ] Auditoría: bitácora, filtros, detalle.
- [ ] Auditoría: cerrar acta.

### 4.5 Checklist SECRETARÍA

- [ ] Dashboard financiero.
- [ ] Padrón (mismo que Admin).
- [ ] Selector de año: un año no activo muestra Histórico y oculta editar/retirar.
- [ ] Tesorería: cobrar pensión/matrícula en el año activo; en histórico no permite cobrar.
- [ ] Caja: aperturar, egreso, cierre.
- [ ] QR: marcar personal.
- [ ] Verificar que no accede por UI a Personal/Carga/SIAGIE/Reportes.

### 4.6 Checklist DOCENTE

- [ ] Dashboard con cursos asignados.
- [ ] Notas: selector curso/bimestre.
- [ ] Notas: cambiar AD/A/B/C y guardar masivo.
- [ ] Notas: verificar persistencia al recargar.
- [ ] Asistencia: selector curso/fecha.
- [ ] Asistencia: P/T/F, “todos presentes”, guardar.
- [ ] Ficha: buscar por DNI, ver notas y asistencia.
- [ ] Reportes: estadísticas por competencia.
- [ ] Campanita: recibir recordatorio.
- [ ] Verificar que no accede a Admin/Secretaría.

### 4.7 Checklist ESTUDIANTE

- [ ] Dashboard: notas por curso y promedio.
- [ ] Asistencia: resumen por curso y detalle.
- [ ] Horario: bloques Lunes–Viernes.
- [ ] Carné QR.
- [ ] Verificar que no accede a Admin/Docente/Secretaría.

### 4.8 Casos borde

| Caso | Resultado esperado |
|---|---|
| DNI duplicado al matricular | 409, mensaje claro |
| DNI con letras | 400 validación |
| Contraseña corta | 400 validación |
| Token expirado | 401 + redirección |
| Token manipulado | 401 |
| Usuario cesado | 403 |
| Caja ya abierta | 409 |
| Egreso sin caja | 400 |
| Cierre sin caja | 400 |
| Pago sin número de operación (UI) | Bloqueado en frontend |
| Pago con monto 0 o distinto al esperado | 400, el backend exige el monto exacto |
| Nota inválida | 400 |
| Bimestre 5 | 400 |
| SIAGIE sin notas | 404 |
| Archivo SIAGIE PDF | 400 multer |
| Archivo >10 MB | 400 multer |
| Notificación ajena | 404 |
| Acta ya cerrada | 409, el backend bloquea la edición |
| Curso duplicado en carga | Error de llave duplicada |

### 4.9 Regresión mínima tras cambios

1. `npm run smoke` → 0 FAIL.
2. Login de los 4 roles.
3. Matrícula + pago de matrícula.
4. Asistencia + nota de un alumno.
5. Reporte de libreta.
6. Caja apertura/cierre.
7. Campanita.
8. SIAGIE con plantilla de prueba.

### 4.10 Suites de integridad y E2E pre-despliegue

#### `test:integridad` — solo lectura, cualquier base

```powershell
cd siga-uc-backend
npm run test:integridad
```

- Verifica **20 invariantes**: 43 tablas base, índices críticos de pagos/boletas, multi-año
  y promociones (`uq_alumno_*_anio`, `uq_anio_activo`, `uq_promocion_*`,
  `uq_politica_*`), pagos/pensiones/boletas coherentes, movimientos de caja, usuarios
  activos asociados, escala AD/A/B/C, alumnos matriculados con usuario activo, matrículas
  anuales con grado del mismo año, `grados.orden` válido, carga/tutores del mismo año y las
  invariantes de promociones (una confirmada por origen, destino del año/grado correcto,
  egresados/retirados sin destino y política única).
- Fuerza `default_transaction_read_only=on`: no escribe nada.
- Usa `DATABASE_URL` si existe; si no, `DB_*`. Puede ejecutarse contra local, una réplica
  de lectura o producción.
- Muestra **PASS/FAIL**, el conteo de violaciones y hasta 5 filas de ejemplo. Exit `1` si
  hay algún FAIL.
- **Cuándo:** después de restaurar un backup, antes de cada despliegue y semanalmente.
  En producción, usar preferentemente una conexión/replica de solo lectura.

> En la base local del 22/11/2026 hay violaciones reales de seed en los invariantes 4 y 8
> (5 pagos sin INGRESO y 144 pensiones PAGADO sin pago). El invariante 7 solo exige ficha
> a ESTUDIANTE/DOCENTE; ADMIN y SECRETARIA están exentos. No son fallos de la suite: deben
> revisarse antes de cargar datos reales. La base local da **18 PASS / 2 FAIL**; una base de
> producción sembrada con `siga_uc.sql` + `seed_produccion.sql` + migraciones (incluidas H49
> y H73) da **20 PASS**.

#### `test:e2e` — base desechable

```powershell
cd siga-uc-backend
npm run test:e2e
```

- Crea `siga_uc_e2e`, carga `database/siga_uc_completo.sql` y las migraciones en orden
  (`h32`, `h10_h38`, `h07`, `h45`, `h47`, `h48`, `h61`, `h49`, `h73`, `h59`), arranca el
  backend en `http://localhost:3101` y ejecuta **72 flujos**: alta/retiro de alumno, matrícula, pensión,
  doble pago, anulación, doble anulación, calificaciones, guardado masivo, PDFs, RBAC,
  auditoría, cierre/reapertura real de actas, bloqueo global, caja con efectivo/Yape (con y
  sin anulación), PDF de acta ADMIN-only, multi-año (43 tablas, uniques por año, apoderado
  compartido, login sin matrícula activa, consultas por año, retiro con matrícula en otro año,
  login con año activo 2027 y pre-tickets/pendientes sin mezclar años), rollover 6.2
  (preview sin escrituras, confirm idempotente, oferta distinta, docente inactivo/sobrecarga,
  hash desactualizado, activación con caché y auditoría, activación sin oferta, reversión con
  y sin actividad, RBAC del módulo y rollback forzado sin filas parciales), promociones
  6.3/6.3.1 (política por defecto, preview, confirm normal, egresado, repitente,
  retirado/traslado, bloqueo por actas/notas y override, asistencia bajo umbral, doble
  confirmación, anulación sin/con actividad, reintento con reversa, rollback forzado,
  QR/código/pre-ticket, RBAC, auditoría, histórico, notas multibimestre, egresado/repitente
  estrictos, `copiar_becas` en el hash y rechazo de PENDIENTE), histórico 6.4
  (listados y DNI sin mezclar años, libreta/asistencia/pensiones por año, `404`
  `MATRICULA_NO_ENCONTRADA_EN_ANIO` en 5 endpoints, consolidado por `id_usuario` con notas,
  asistencia, pagos y deuda, RBAC ADMIN/SECRETARIA y contrato de UI del selector) y pulido
  Fase 7 (H62: DOCENTE 403 en notificaciones; H59: observación de cese persistida y
  apoderado sin nombres 400; H65: docentes vs personal activo; H67/H68/H69: contratos de UI
  sin grados/cursos fijos, sin “firma digital” y sin textos de maqueta).
- Al terminar **siempre** detiene el backend y ejecuta `dropdb --force siga_uc_e2e`.
  Si la limpieza falla, imprime los comandos manuales.
- **Seguridad:** se niega a ejecutar si el nombre de la base no contiene `_e2e`, si es la
  misma que `DB_NAME` o si el host es Supabase. Ignora `DATABASE_URL` para no apuntar a
  producción.
- Requisitos: `createdb`, `dropdb` y `psql` en el `PATH`; `.env` con `DB_*` y `SMOKE_*`;
  puerto `3101` libre. `E2E_DB_NAME` puede cambiarse, pero debe contener `_e2e`.
- Resultado esperado: **72 PASS, 0 FAIL, 0 SKIP**, exit `0`.
- **Cuándo:** antes de cada despliegue, después de cambiar migraciones o lógica de negocio.
  **Nunca** contra producción ni Supabase.

---

## 5. Diagnóstico de datos

### 5.1 Alumno no aparece en asistencia/notas

```sql
SELECT id_alumno, nombres, apellidos, estado_matricula, id_grado, anio_lectivo
FROM alumnos WHERE dni = 'XXXXXXXX';
```

Debe estar `Matriculado`. Si está `PendientePago`, cobrar matrícula.

### 5.2 Docente no ve cursos

```sql
SELECT cc.*, c.nombre_curso, g.nombre_grado
FROM carga_curricular cc
JOIN cursos c ON c.id_curso = cc.id_curso
JOIN grados g ON g.id_grado = cc.id_grado
JOIN personal p ON p.id_personal = cc.id_personal
JOIN usuarios u ON u.id_usuario = p.id_usuario
WHERE u.dni = '10293847' AND cc.anio_lectivo = 2026;
```

### 5.3 No hay notas finales

```sql
SELECT a.dni, c.nombre_curso, nf.bimestre, nf.nota_final
FROM alumnos a
CROSS JOIN cursos c
LEFT JOIN notas_finales_area nf
  ON nf.id_alumno = a.id_alumno AND nf.id_curso = c.id_curso
 AND nf.bimestre = 2 AND nf.anio_lectivo = 2026
WHERE a.id_grado = 2 AND a.estado_matricula = 'Matriculado';
```

Si `nota_final` es NULL, ejecutar el cálculo por alumno/curso o revisar si el docente guardó.

### 5.4 Caja descuadrada

```sql
SELECT tipo, medio_pago, SUM(monto)
FROM movimientos_caja
WHERE id_apertura = 2
GROUP BY tipo, medio_pago;
```

Comparar con el cierre. Revisar pagos sin caja abierta:

```sql
SELECT p.* FROM pagos p
LEFT JOIN movimientos_caja m ON m.id_pago = p.id_pago
WHERE m.id_movimiento IS NULL;
```

### 5.5 Notificaciones no llegan por correo

- Revisar `RESEND_API_KEY`.
- Revisar `EMAIL_FROM`.
- Revisar que el usuario tenga `correo_personal` o `correo_institucional`.
- Revisar logs `📧`/`❌`.
- En modo prueba de Resend, el destinatario debe estar autorizado.

---

## 6. Mantenimiento de datos

| Tarea | SQL/Acción |
|---|---|
| Alumnos por estado | `SELECT estado_matricula, COUNT(*) FROM alumnos GROUP BY 1;` |
| Pensiones pendientes | `SELECT COUNT(*), SUM(monto_final) FROM pensiones WHERE estado='PENDIENTE';` |
| Pagos sin boleta | `SELECT p.* FROM pagos p LEFT JOIN boletas_electronicas b ON b.id_pago=p.id_pago WHERE b.id_boleta IS NULL;` |
| Movimientos sin pago | `SELECT * FROM movimientos_caja WHERE tipo='INGRESO' AND id_pago IS NULL;` |
| Bitácora por módulo | `SELECT modulo_afectado, COUNT(*) FROM bitacora_auditoria GROUP BY 1;` |
| Usuarios sin QR | `SELECT u.id_usuario FROM usuarios u LEFT JOIN credenciales_qr c ON c.id_usuario=u.id_usuario WHERE c.id_credencial IS NULL;` |
| Alumnos sin expediente | `SELECT a.id_alumno FROM alumnos a LEFT JOIN expediente_alumno e ON e.id_alumno=a.id_alumno WHERE e.id_expediente IS NULL;` |

---

## 7. Incidentes y recuperación

### 7.1 La API no arranca

1. Revisar que `.env` exista y tenga `DB_*` + `JWT_SECRET`.
2. `npm install`.
3. Verificar PostgreSQL.
4. Revisar puerto.
5. Revisar logs.
6. Ejecutar `npm run smoke`: distingue health, configuración, login y permisos.

### 7.2 La API arranca pero todo da 500

- BD caída o credenciales mal.
- Esquema incompleto (faltan tablas/funciones).
- `pgcrypto` ausente.

### 7.3 Pérdida de datos

1. Detener aplicación.
2. Restaurar último backup.
3. Verificar integridad (conteos, FKs).
4. Revisar causa.

### 7.4 Token comprometido

1. Rotar `JWT_SECRET` (invalida todos los tokens).
2. Cambiar contraseñas afectadas.
3. Revisar bitácora (limitada).
4. Revisar logs.

### 7.5 Correo masivo accidental

- No hay cancelación; el envío es síncrono por notificación.
- Revisar `notificaciones` y logs.
- Comunicar a los afectados.

---

## 8. Calidad y mejoras de testeo

| Mejora | Beneficio |
|---|---|
| ~~Smoke test de solo lectura~~ ✅ | Valida entorno, BD, auth, RBAC y PDF antes de desplegar (`npm run smoke`) |
| ~~Integridad de datos~~ ✅ | 20 invariantes de solo lectura sobre cualquier base (`npm run test:integridad`) |
| ~~E2E de flujos críticos~~ ✅ | 72 flujos sobre base desechable (`npm run test:e2e`) |
| Tests unitarios de services | Validar reglas sin BD |
| Tests de integración de endpoints | Contratos y permisos |
| Tests E2E de UI (Playwright/Cypress) | Flujos por rol en el navegador |
| Seed reproducible | Tests consistentes |
| CI en GitHub Actions | Build + lint + tests |
| Cobertura de autorización | Evitar GET amplios |
| Pruebas de carga | 150 alumnos / 17 docentes es bajo, pero validar concurrencia |

---

## 9. Contacto y responsabilidades

| Rol | Responsable | Ámbito |
|---|---|---|
| Product Owner/PM | Yarol Bello Coquil | Alcance, prioridades, despliegue |
| Arquitecto/Backend | Alexander Grados Castro | API, BD, seguridad |
| Frontend | Franz Roger Ramón Ayala | Angular, UI/UX |
| Analista/QA | Jeanfranco Jesús Ramos Uñaupe | Pruebas, documentación |
| Docente del curso | Mg. Mora Bonilla, Anthony | Evaluación académica |
