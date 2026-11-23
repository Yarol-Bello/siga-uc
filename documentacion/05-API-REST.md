# 05 — API REST

**Base URL local:** `http://localhost:3000` · **Prefijo:** `/api`
**Formato:** JSON (excepto la exportación interna SIAGIE, que responde un `.xlsx`)
**Autenticación:** `Authorization: Bearer <JWT>` en todos los endpoints privados
**Total verificado:** **129 endpoints** - 71 GET, 36 POST, 17 PUT, 5 DELETE.

---

## 1. Convenciones

### 1.1 Respuesta uniforme

```json
{ "success": true, "message": "Operación exitosa", "data": {}, "timestamp": "2026-11-19T..." }
```

**Listados paginados:** cuando el cliente envía `page`, la respuesta añade el bloque
`pagination` y `data` sigue siendo el arreglo de la página:

```json
{
  "success": true,
  "message": "20 de 45 alumnos",
  "data": [ ... ],
  "pagination": { "total": 45, "page": 1, "pageSize": 20, "totalPages": 3 },
  "timestamp": "..."
}
```

Sin `page` no se agrega `pagination` y se mantiene el comportamiento histórico (arreglo
completo, o el `limit` del buscador).

Error:

```json
{ "success": false, "message": "Descripción del error", "errors": null, "timestamp": "..." }
```

### 1.2 Códigos HTTP

| Código | Uso |
|---|---|
| 200 | Consulta/actualización exitosa |
| 201 | Creación exitosa |
| 400 | Validación o regla de negocio |
| 401 | Token ausente, inválido o expirado |
| 403 | Rol no autorizado o usuario no activo |
| 404 | Recurso no encontrado |
| 409 | Conflicto (DNI duplicado, caja ya abierta, previsualización desactualizada) |
| 422 | Regla de negocio que impide completar la operación (activación u rollover bloqueado) |
| 500 | Error interno |
| 503 | Dependencia no disponible; en 6.2, migración H49 no aplicada (`H49_NO_APLICADO`) |

### 1.3 Leyenda de acceso

| Leyenda | Significado |
|---|---|
| **Público** | Sin token |
| **Autenticado** | Cualquier usuario con JWT válido |
| **ADMIN** | Solo rol ADMIN |
| **ADMIN/SECRETARIA** | Ambos roles |
| **ADMIN/DOCENTE** | Ambos roles |
| **ADMIN/DOCENTE/ESTUDIANTE** | Cualquiera autenticado; la UI restringe |

> **Importante:** “Autenticado” no significa “solo sus datos”. Salvo notificaciones y
> libretas, la mayoría de GET no valida pertenencia. Ver `15-HALLAZGOS`.

---

## 2. Generales

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/` | Público | Bienvenida + versión |
| GET | `/api/health` | Público | Health check (`app`, `version`, `environment`, `timestamp`) |
| GET | `/api/configuracion` | Público | Año lectivo activo (`anio_lectivo`): `anios_lectivos.estado='ACTIVO'` o, si falta, `ANIO_LECTIVO` |

### 2.1 Años lectivos y rollover — `/api/anios-lectivos` (5; lectura ADMIN/SECRETARIA, escritura ADMIN)

Todos exigen `verificarAutenticacion`. El `GET` acepta ADMIN y SECRETARIA (selector de año
e históricos); las escrituras exigen `verificarRol("ADMIN")`. Si la base no tiene
aplicada H49, responden **503** con `errors.codigo = "H49_NO_APLICADO"` (no un 500).

| Método | Ruta | Cuerpo | Descripción |
|---|---|---|---|
| GET | `/api/anios-lectivos` | - | Catálogo de años con estado, marcas de cierre y conteos de grados, conceptos, MATRICULA, períodos, carga, tutores, alumnos, pagos, notas, asistencia, pensiones, pre-tickets, actas y horarios |
| POST | `/api/anios-lectivos/preview` | `{ anio_origen, anio_destino, incluir_otros? }` | **Solo lectura.** Devuelve `resumen`, `detalle`, `bloqueos`, `advertencias`, `actividad_destino` y `preview_hash` (SHA-256) |
| POST | `/api/anios-lectivos/rollover` | `{ anio_origen, anio_destino, preview_hash, confirmar: true, incluir_otros? }` | Clonado transaccional e idempotente de grados → conceptos → períodos → carga → tutores. No crea alumnos, matrículas, pagos, notas, asistencia, actas ni horarios |
| PUT | `/api/anios-lectivos/:anio/activar` | `{ confirmar: true }` | Activa un año `PLANIFICADO`; el `ACTIVO` anterior pasa a `CERRADO`. Actualiza la caché del backend y audita `ACTIVAR` |
| DELETE | `/api/anios-lectivos/:anio/rollover` | `{ motivo, confirmar: true }` | Revierte la oferta de un año `PLANIFICADO`, no activo y sin actividad. Audita `REVERTIR_ROLLOVER` |

Reglas verificadas:

- Años válidos entre 2000 y 2100 y `anio_origen < anio_destino`.
- `preview` no escribe. El confirm recalcula el hash dentro de la transacción; si cambió,
  responde **409 `PREVIEW_DESACTUALIZADA`**.
- El confirm es idempotente: con el mismo hash y los mismos datos devuelve `200` con
  `creados = 0` y `existentes > 0`.
- Son bloqueos: origen inexistente o sin grados, falta de `MATRICULA`, destino con
  actividad, oferta del destino distinta, docentes inactivos, docente sobre la capacidad
  (`períodos CLASE activos × 5 días`), grados sin `orden` o duplicados.
- `incluir_otros` es `false` por defecto: solo se copian `MATRICULA` y `PENSION`. Los
  conceptos `OTROS` se omiten con advertencia.
- La activación exige al menos 1 grado y 1 concepto `MATRICULA`; no reactiva `CERRADO` en
  6.2. Solo puede quedar un año `ACTIVO` (índice parcial `uq_anio_activo`).
- La reversión solo procede si la oferta coincide exactamente con la clonada; no borra
  oferta manual distinta.
- Auditoría: acciones `ROLLOVER`, `ACTIVAR` y `REVERTIR_ROLLOVER` en el módulo
  `Años Lectivos`, siempre **después del COMMIT**.

### 2.2 Promociones anuales — `/api/promociones` (8)

Requiere JWT. **ADMIN** puede escribir, confirmar y anular; **SECRETARIA** puede listar
políticas, previsualizar y consultar promociones; **DOCENTE/ESTUDIANTE reciben 403**.
Si faltan las tablas H73, responden **503 `PROMOCIONES_NO_APLICADAS`**; si falta H49,
**503 `H49_NO_APLICADO`**.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/promociones/politicas` | ADMIN/SECRETARIA | Lista políticas; filtros `anio_origen`, `anio_destino`, `activo` |
| POST | `/api/promociones/politicas` | ADMIN | Crea política configurable; `permite_override` es `false` por defecto |
| PUT | `/api/promociones/politicas/:id` | ADMIN | Actualiza una política |
| POST | `/api/promociones/preview` | ADMIN/SECRETARIA | **Solo lectura.** `{ anio_origen, anio_destino, id_politica, id_grado?, incluir_retirados?, decisiones?, copiar_becas? }`; devuelve alumnos, sugerencias, bloqueos, advertencias y `preview_hash` |
| POST | `/api/promociones/confirmar` | ADMIN | Mismos datos + `preview_hash`, `confirmar:true`, `decisiones[]` y `copiar_becas?`; transacción única |
| GET | `/api/promociones` | ADMIN/SECRETARIA | Lista promociones por años, estado, resultado o grado |
| GET | `/api/promociones/:id` | ADMIN/SECRETARIA | Detalle de una promoción |
| PUT | `/api/promociones/:id/anular` | ADMIN | Body `{ motivo }`; anula y revierte si el destino no tiene actividad |

Reglas verificadas:

- La oferta del destino debe existir (grados del año destino); si falta, **422
  `DESTINO_SIN_OFERTA`**. No activa el año destino.
- Sugerencias: `RETIRADO` (retirado o traslado), `EGRESADO` (último grado), `REPITENTE`
  (política de umbral), `PENDIENTE` (actas/notas faltantes o transición no configurada) y
  `PROMOVIDO` (resto).
- Actas: se reutiliza la regla H48 (bimestres configurados y acta global `CERRADO`).
  Notas: `notas_finales_area` en **todos** los `notas_bimestres` configurados (arreglo 1–4,
  default `[4]`; se acepta el legado `notas_bimestre` y se normaliza a `[n]`). Un curso falta
  si no tiene nota en cualquiera de los bimestres requeridos. Asistencia y deuda son
  **advertencias**, no exclusiones automáticas.
- Actas/notas se exigen para **PROMOVIDO, REPITENTE y EGRESADO**; RETIRADO está exento. Si
  faltan, el resultado es `PENDIENTE` con bloqueo.
- Override: solo si la política lo permite, con motivo obligatorio y `es_override=true`.
  Exime las actas/notas faltantes y deja evidencia en `metadata`. Sin permiso o sin motivo,
  el confirm responde **422 `PROMOCION_PENDIENTE`/`PROMOCION_BLOQUEADA`**.
- Confirmación: advisory lock `promocion:origen:destino`, hash recalculado dentro de la
  transacción; hash viejo → **409 `PREVIEW_DESACTUALIZADA`**. El hash incluye
  `copiar_becas`; cambiarlo sin re-preview invalida el confirm. Crea matrícula, expediente y
  pre-ticket de matrícula; no copia notas, asistencia, pagos, pensiones ni pre-tickets.
- **PENDIENTE no se confirma**: si el lote contiene un alumno PENDIENTE (no `ya_confirmada`),
  responde **422 `PROMOCION_PENDIENTE`** y no crea filas `CONFIRMADA` con ese resultado.
  Conserva `id_usuario`, DNI, código y QR; no crea usuarios ni QR.
- Idempotencia: repetir el confirm con el mismo hash devuelve `ya_confirmada=true` o `409`;
  el índice parcial impide dos promociones confirmadas por matrícula origen.
- Anulación: solo promociones `CONFIRMADA`; si el destino no tiene pagos, notas, asistencia,
  pensiones ni pre-tickets pagados, desvincula y borra matrícula/expediente/pre-ticket; si
  tiene actividad, **409 `PROMOCION_CON_ACTIVIDAD`**. El reintento enlaza la promoción
  anterior con `id_promocion_reversa`.
- Auditoría: `PREVISUALIZAR`, `CONFIRMAR`, `ANULAR`, `CREAR_POLITICA` y
  `ACTUALIZAR_POLITICA` en el módulo `Promociones`, después del COMMIT.
- No se agrega `TRASLADADO`: un traslado es `RETIRADO` + `alumnos.condicion='Traslado'` y
  `metadata.retiro.motivo='TRASLADO'`.

---

## 3. Autenticación — `/api/auth` (9)

| # | Método | Ruta | Acceso | Descripción | Body / params |
|---|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | Público | Login DNI + contraseña; emite JWT 8 h | `{ dni, password }` |
| 2 | GET | `/api/auth/perfil` | Autenticado | Perfil + `info_adicional` + `credencial_qr`; para ESTUDIANTE incluye la matrícula del año activo, `anio_lectivo` y `matricula_activa` (H49/H57) | — |
| 3 | GET | `/api/auth/verify` | Autenticado | Verifica token y devuelve payload | — |
| 4 | POST | `/api/auth/logout` | Autenticado | Logout lógico (el cliente borra token) | — |
| 5 | PUT | `/api/auth/cambiar-password` | Autenticado | Cambia la contraseña propia; exige la actual y limpia `requiere_cambio_password` | `{ password_actual, password_nueva, confirmar_password }` (≥6) |
| 6 | PUT | `/api/auth/reset-password` | ADMIN | Restablece contraseña por DNI a `UC<DNI>` | `{ dni }` |
| 7 | POST | `/api/auth/recuperar-password` | Público | Solicita token por correo | `{ identificador }` (DNI o correo) |
| 8 | GET | `/api/auth/validar-token/:token` | Público | Valida token de recuperación | path |
| 9 | POST | `/api/auth/restablecer-password` | Público | Cambia contraseña con token | `{ token, password }` (≥6) |

> Si `requiere_cambio_password = TRUE`, todos los endpoints autenticados salvo
> `/auth/cambiar-password`, `/auth/logout`, `/auth/perfil` y `/auth/verify` responden `403`
> con `errors.codigo = "CAMBIO_PASSWORD_REQUERIDO"`.

**Login — respuesta:**

```json
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "usuario": {
      "id_usuario": 1, "dni": "74829102", "nombres": "Yarol", "apellidos": "Bello Coquil",
      "nombre_completo": "Yarol Bello Coquil", "correo_institucional": "...",
      "telefono": "...", "rol": "ADMIN", "id_rol": 1,
      "requiere_cambio_password": false,
      "info_adicional": null
    },
    "token": "eyJ...",
    "expires_in": "8h"
  }
}
```

Para un ESTUDIANTE, `info_adicional` siempre es un objeto, incluso sin matrícula en el año
activo:

```json
{
  "id_alumno": null,
  "codigo_estudiante": null,
  "id_grado": null,
  "nombre_grado": null,
  "seccion": null,
  "estado_matricula": null,
  "anio_lectivo": 2027,
  "matricula_activa": false
}
```

**Reglas:** DNI de 8 dígitos numéricos; contraseña ≥6; usuario `ACTIVO`; bcrypt;
actualiza `ultimo_login`; `info_adicional` = matrícula del año activo (ESTUDIANTE) o
personal (DOCENTE/SECRETARIA). Un estudiante **sin matrícula en el año activo puede iniciar
sesión** (`matricula_activa=false`), pero los endpoints académicos que resuelven su propia
matrícula responden `403` con `errors.codigo = "SIN_MATRICULA_ACTIVA"`.

**Recuperación:** token aleatorio de 64 hex, expira en 2 h, un solo uso, invalida tokens
anteriores. Respuesta genérica; si el usuario existe pero no tiene correo devuelve
`{ tieneCorreo: false }`.

---

## 4. Gestión académica — `/api` (7)

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 9 | GET | `/api/grados?anio=2026` | Autenticado | Grados del año con total de alumnos |
| 10 | GET | `/api/grados/:id` | Autenticado | Grado + tutor |
| 11 | GET | `/api/horarios/mi-horario` | DOCENTE/ESTUDIANTE | Horario propio derivado del token (H47) |
| 12 | GET | `/api/cursos` | Autenticado | Cursos + total de competencias |
| 13 | GET | `/api/cursos/:id` | Autenticado | Curso + competencias |
| 14 | GET | `/api/cursos/:id/competencias` | Autenticado | Competencias del curso |
| 15 | GET | `/api/escala-calificacion` | Autenticado | Escala AD/A/B/C |

### 4.1 Horarios — `/api/horarios` (H47, 12 endpoints)

El endpoint anterior `GET /api/horarios/grado/:id_grado` fue retirado por IDOR. El acceso
personal ya no recibe IDs de grado/docente en la URL.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/horarios/mi-horario` | DOCENTE/ESTUDIANTE | Deriva el alcance del token; ADMIN/SECRETARIA → 400 |
| GET | `/api/horarios?anio&id_grado&id_personal&estado` | ADMIN/SECRETARIA | Listado administrativo con borradores y publicados |
| GET | `/api/horarios/periodos?anio` | Autenticado | Malla de períodos del año |
| POST | `/api/horarios` | ADMIN | Crear bloque; deriva grado/curso/docente desde `id_carga` |
| PUT | `/api/horarios/:id` | ADMIN | Editar bloque; publicado exige `confirmar` |
| DELETE | `/api/horarios/:id` | ADMIN | Eliminar bloque; publicado exige `confirmar` |
| POST | `/api/horarios/generar` | ADMIN | Generación automática en BORRADOR; `forzar` para sobrecarga |
| POST | `/api/horarios/publicar` | ADMIN | Publica el año/grado; `permitir_parcial` con advertencia |
| POST | `/api/horarios/despublicar` | ADMIN | Devuelve el alcance a BORRADOR |
| POST | `/api/horarios/periodos` | ADMIN | Crear período de la malla |
| PUT | `/api/horarios/periodos/:id` | ADMIN | Editar período; no permite cambiar horario/tipo si tiene bloques |
| DELETE | `/api/horarios/periodos/:id` | ADMIN | Eliminar período solo si no tiene bloques |

---

## 5. Alumnos — `/api/alumnos` (6)

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 16 | GET | `/api/alumnos?anio=&id_grado=&estado_matricula=&search=&limit=&solo_activos=&page=&pageSize=` | Autenticado | Lista con apoderado y grado; `page` activa paginación (default 1, máx. 100) |
| 17 | GET | `/api/alumnos/dni/:dni?anio=` | Autenticado | Busca la matrícula del DNI en el año (`?anio` o año activo) |
| 18 | GET | `/api/alumnos/:id?anio=` | Autenticado | Ficha completa; con `?anio` distinto responde `404 MATRICULA_NO_ENCONTRADA_EN_ANIO` |
| 19 | POST | `/api/alumnos` | ADMIN/SECRETARIA | Matrícula transaccional |
| 20 | PUT | `/api/alumnos/:id` | ADMIN/SECRETARIA | Actualiza datos |
| 21 | PUT | `/api/alumnos/:id/retirar` | ADMIN/SECRETARIA | Retiro con motivo |

> **Búsqueda:** `search` (o su alias `q`) aplica `ILIKE` sin acentos sobre DNI, nombres,
> apellidos y nombre completo. `limit` (1–50) y `solo_activos=1` son opcionales; el buscador
> del dashboard usa `search=&limit=10&solo_activos=1`.

**POST body:**

```json
{
  "dni": "70000001",
  "nombres": "Luis",
  "apellidos": "García",
  "fecha_nacimiento": "2010-04-11",
  "id_grado": 1,
  "condicion": "Regular",
  "colegio_procedencia": null,
  "anio_lectivo": 2026,
  "apoderado": {
    "nombres": "María", "apellidos": "Quispe", "dni": "12345678",
    "telefono": "999999999", "correo": "madre@correo.com"
  }
}
```

**Respuesta 201:** `id_alumno`, `id_usuario`, `codigo_estudiante`, `dni`,
`nombre_completo`, `password_temporal` (`UC<DNI>`), `correo_institucional`, `correo_personal`.

**Efectos:** reutiliza al apoderado si el DNI ya existe (no sobrescribe sus datos), crea
usuario STUDENT si el DNI no tiene cuenta, matrícula anual `PendientePago`, expediente y
credencial QR. **El alumno no queda matriculado hasta pagar matrícula.** La identidad
(`usuarios`) es única por DNI; la matrícula (`alumnos`) es única por `(DNI, año)`,
`(id_usuario, año)` y `(codigo_estudiante, año)`. El `id_grado` debe pertenecer al año de la
matrícula y el concepto `MATRICULA` debe existir para ese año; si no, responde `400`.

**Retiro body:** `{ motivo_retiro, fecha_retiro, colegio_destino, resolucion_directoral }`.

---

## 6. Personal — `/api/personal` (8)

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 22 | GET | `/api/personal?id_rol=&estado=&search=` | Autenticado | Lista personal con rol |
| 23 | GET | `/api/personal/roles` | Autenticado | Roles disponibles (excluye ESTUDIANTE) |
| 24 | GET | `/api/personal/:id` | Autenticado | Detalle por `id_personal` |
| 25 | POST | `/api/personal` | ADMIN | Crea usuario + personal + QR |
| 26 | PUT | `/api/personal/:id` | ADMIN | Actualiza datos y rol |
| 27 | PUT | `/api/personal/:id/cesar` | ADMIN | Cese con motivo y observación opcional; persiste `personal.observaciones` (H59) |
| 28 | PUT | `/api/personal/:id/reactivar` | ADMIN | Reactiva usuario y limpia cese (incluida la observación) |
| 29 | PUT | `/api/personal/:id/reset-password` | ADMIN | Restablece a `UC<DNI>` |

**POST body:** `{ dni, nombres, apellidos, correo_institucional?, correo_personal, telefono, id_rol, especialidad, cargo, fecha_ingreso, password? }`.
Si no se envía contraseña: `UC2026*`. Genera QR según rol.

**Cese body:** `{ motivo_cese, fecha_cese?, observaciones? }`. `observaciones` se guarda en
`personal.observaciones` (máximo 1000 caracteres) y se devuelve en
`GET /personal` y `GET /personal/:id`. Si H59 no está aplicada y se envía una observación,
responde `503 H59_NO_APLICADO`; un cese sin observación sigue funcionando.

> Orden de rutas: `/roles` está antes de `/:id`, evitando colisión.
> `GET /personal` y `GET /personal/:id` incluyen `codigo_qr` y `tipo_credencial` desde
> `credenciales_qr` (H55); no cambia el esquema.

---

## 7. Carga curricular — `/api/carga-curricular` (9)

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 30 | GET | `/api/carga-curricular?id_grado=&id_personal=&id_curso=&anio=` | Autenticado | Lista asignaciones |
| 31 | GET | `/api/carga-curricular/grado/:id` | Autenticado | Cursos/docentes del grado |
| 32 | GET | `/api/carga-curricular/grado/:id/tutor` | Autenticado | Tutor del grado |
| 33 | GET | `/api/carga-curricular/docente/:id` | Autenticado | Cursos del docente (año activo por defecto) |
| 34 | GET | `/api/carga-curricular/:id` | Autenticado | Asignación por ID |
| 35 | POST | `/api/carga-curricular` | ADMIN | Crea asignación |
| 36 | POST | `/api/carga-curricular/tutor` | ADMIN | Asigna/reemplaza tutor |
| 37 | PUT | `/api/carga-curricular/:id` | ADMIN | Cambia docente/horas |
| 38 | DELETE | `/api/carga-curricular/:id` | ADMIN | Elimina asignación |

**POST body:** `{ id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas }`.
UNIQUE (`id_grado`, `id_curso`, `anio_lectivo`).

**Tutor body:** `{ id_grado, id_personal, anio_lectivo }`; reemplaza al anterior del mismo
grado/año en una transacción.

---

## 8. Asistencias — `/api/asistencias` (9)

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 39 | GET | `/api/asistencias/curso/:id_curso/fecha/:fecha?id_grado=` | Autenticado | Lista de alumnos + asistencia del día |
| 40 | GET | `/api/asistencias/alumno/:id_alumno?id_curso=&desde=&hasta=&anio=` | Autenticado | Historial del alumno filtrado por año |
| 41 | GET | `/api/asistencias/alumno/:id_alumno/resumen?anio=` | Autenticado | Resumen global + por curso filtrado por año |
| 42 | GET | `/api/asistencias/personal/todos?fecha=` | Autenticado | Personal activo + marcación del día |
| 43 | GET | `/api/asistencias/personal/resumen?fecha=` | Autenticado | Totales Puntual/Tardanza/Falta |
| 44 | GET | `/api/asistencias/personal/dni/:dni` | Autenticado | Busca personal por DNI |
| 45 | POST | `/api/asistencias/personal/marcar` | ADMIN/SECRETARIA | Marca asistencia de personal |
| 46 | POST | `/api/asistencias` | ADMIN/DOCENTE | Registra/actualiza una asistencia |
| 47 | POST | `/api/asistencias/masivo` | ADMIN/DOCENTE | Upsert masivo |

**POST individual:** `{ id_alumno, id_curso, id_personal, id_grado, fecha, estado: "P|T|F", observacion?, justificada?, motivo_justificacion? }`. `dia_semana` se deriva en el backend desde `fecha` con `EXTRACT(ISODOW)` y se guarda en español; si el cliente lo envía, se ignora (H61).

**Masivo:** `{ registros: [ ... ] }` → `{ insertados, errores[] }`. Cada registro sigue la misma regla: el backend calcula `dia_semana` y no confía en el valor del frontend (H61). El estado `P|T|F` sigue siendo obligatorio; la UI bloquea una observación sin estado antes de enviarla (H60).

**Año lectivo (H56/H49):** el historial y el resumen aceptan `?anio=YYYY`. Sin el parámetro
se usa el año activo (`anios_lectivos` o `ANIO_LECTIVO` como respaldo); un valor explícito
tiene prioridad. `asistencia_alumnos` no tiene columna `anio_lectivo`: el año se deriva de
`fecha`. La libreta y su PDF reciben `anio`.

**Personal:** `{ id_personal, fecha, hora_ingreso, estado: "Puntual|Tardanza|Falta", observacion? }`.

---

## 9. Calificaciones — `/api/calificaciones` (6)

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 48 | GET | `/api/calificaciones/alumno/:id_alumno/curso/:id_curso?anio=` | Autenticado | Notas por competencia/bimestre |
| 49 | GET | `/api/calificaciones/curso/:id_curso/grado/:id_grado?bimestre=&anio=` | Autenticado | Matriz competencias × alumnos |
| 50 | GET | `/api/calificaciones/notas-finales/alumno/:id_alumno?anio=` | Autenticado | Notas finales agrupadas + conclusiones |
| 51 | POST | `/api/calificaciones` | ADMIN/DOCENTE | Registra/actualiza una nota |
| 52 | POST | `/api/calificaciones/masivo` | ADMIN/DOCENTE | Upsert masivo |
| 53 | POST | `/api/calificaciones/notas-finales` | ADMIN/DOCENTE | Calcula y guarda nota final |

**POST body:** `{ id_alumno, id_curso, id_competencia, id_personal, id_grado, bimestre, anio_lectivo, calificacion, modificado_por?, justificacion_modificacion? }`.

**Nota final body:** `{ id_alumno, id_curso, bimestre, anio }`.

**Respuesta matriz (GET 49):**

```json
{
  "competencias": [{ "id_competencia": 5, "nombre_competencia": "...", "orden": 1 }],
  "alumnos": [{
    "id_alumno": 1, "dni": "...", "nombre_completo": "...", "codigo_estudiante": "EST-041",
    "calificaciones": [{ "id_competencia": 5, "nombre_competencia": "...", "calificacion": "AD" }]
  }]
}
```

---

## 10. Tesorería — `/api/tesoreria` (13)

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 54 | GET | `/api/tesoreria/conceptos?anio=` | Autenticado | Conceptos del año |
| 55 | GET | `/api/tesoreria/pre-tickets?estado=&id_alumno=&anio=` | Autenticado | Lista pre-tickets del año |
| 56 | GET | `/api/tesoreria/pre-tickets/:id` | Autenticado | Detalle |
| 57 | POST | `/api/tesoreria/pre-tickets` | ADMIN/SECRETARIA | Crea pre-ticket `PENDIENTE` |
| 58 | GET | `/api/tesoreria/pagos?id_alumno=&desde=&hasta=&anio=` | Autenticado | Lista pagos + boleta del año |
| 59 | GET | `/api/tesoreria/pagos/:id` | Autenticado | Detalle de pago/boleta |
| 60 | PUT | `/api/tesoreria/pagos/:id/anular` | ADMIN/SECRETARIA | Anula pago, boleta, pensión/pre-ticket y revierte caja |
| 61 | POST | `/api/tesoreria/pagos` | ADMIN/SECRETARIA | Pago + boleta + efectos |
| 62 | GET | `/api/tesoreria/pensiones/alumno/:id_alumno?anio=` | Autenticado | Pensiones del alumno |
| 63 | POST | `/api/tesoreria/pensiones/generar` | ADMIN/SECRETARIA | Genera un mes para todos los alumnos |
| 63b | POST | `/api/tesoreria/pensiones/alumno/:id_alumno/generar` | ADMIN/SECRETARIA | Genera el cronograma de un alumno (H44) |
| 64 | GET | `/api/tesoreria/becas?activo=&anio=` | Autenticado | Lista becas del año |
| 65 | POST | `/api/tesoreria/becas` | ADMIN | Aplica beca |
| 66 | GET | `/api/tesoreria/estadisticas?anio=&mes=` | Autenticado | Recaudación y pendientes |
| 67 | GET | `/api/tesoreria/boletas/:id_pago/pdf` | ADMIN/SECRETARIA | PDF de boleta de pago |

**Anulación de pago:** `PUT /api/tesoreria/pagos/:id/anular` con `{ motivo }` (mínimo 10
caracteres). Solo aplica a pagos `PAGADO`; doble anulación → 409. En una transacción marca el
pago y la boleta como `ANULADO`, devuelve pensión/pre-ticket a `PENDIENTE` y registra un
`EGRESO` con el mismo monto y medio de pago en la apertura abierta (si la original está cerrada,
usa la actual; sin caja abierta → 400).

**Pre-ticket body:** `{ id_alumno, id_concepto, monto }`.

**Pago body:**

```json
{
  "id_alumno": 1,
  "id_concepto": 9,
  "id_preticket": null,
  "id_pension": 42,
  "monto": 250,
  "forma_pago": "Efectivo",
  "nro_operacion": "OP-123"
}
```

**Respuesta 201:** `{ pago, boleta }` con `numero_boleta` `B001-XXXXXX`.

**Efectos:** pago `PAGADO`; boleta `ACEPTADO`; pre-ticket/pensión `PAGADO` (DAO + trigger);
movimiento de caja `INGRESO` (trigger); si el concepto es `MATRICULA`, alumno pasa a
`Matriculado` y se genera su cronograma de pensiones desde el mes de creación hasta
diciembre. La respuesta añade `pensiones_generadas`; si la generación falla, todo el pago
hace `ROLLBACK`.

**Pensiones generar body:** `{ anio, mes, monto_base }` (monto_base por defecto 250).
Genera un mes para todos los alumnos `Matriculado`; **no** cambia su comportamiento.

**Pensiones por alumno (H44):** `POST /api/tesoreria/pensiones/alumno/:id_alumno/generar`
sin body. Es idempotente y genera desde el mes de `fecha_creacion` hasta diciembre, solo
meses con concepto `PENSION`. Responde `{ generadas, total_pensiones }`; `404` si el
alumno no existe y `400` si no está `Matriculado`. Audita `CREAR` en `Tesorería` con
`{ id_alumno, generadas }`.

**Beca body:** `{ id_alumno, tipo, porcentaje_descuento, monto_descuento, fecha_inicio, fecha_fin }`.

---

## 11. Caja — `/api/caja` (9)

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 68 | GET | `/api/caja/actual` | Autenticado | Apertura abierta + totales |
| 69 | GET | `/api/caja/cajas` | Autenticado | Cajas registradas |
| 70 | GET | `/api/caja/aperturas?desde=&hasta=` | Autenticado | Historial de aperturas |
| 71 | GET | `/api/caja/aperturas/:id` | Autenticado | Detalle de apertura |
| 72 | GET | `/api/caja/movimientos/:id_apertura` | Autenticado | Movimientos |
| 73 | GET | `/api/caja/cierres` | Autenticado | Historial de cierres |
| 74 | POST | `/api/caja/aperturar` | ADMIN/SECRETARIA | Abre caja |
| 75 | POST | `/api/caja/egresos` | ADMIN/SECRETARIA | Registra egreso |
| 76 | POST | `/api/caja/cerrar` | ADMIN/SECRETARIA | Cierra con arqueo |

**Aperturar body:** `{ monto_inicial, observaciones?, id_caja? }`. Si no hay caja, crea
“Caja Principal”. Rechaza si ya hay una apertura sin cierre.

**Egreso body:** `{ concepto, monto, nro_comprobante? }`.

**Cerrar body:** `{ efectivo_fisico }`.

**Cálculo:** `efectivo_esperado = monto_inicial + ingresos_efectivo - egresos`;
`diferencia = efectivo_fisico - efectivo_esperado`;
`estado`: `CUADRADO` si |dif| ≤ 0.01, `SOBRANTE` si > 0.01, `FALTANTE` si < -0.01.

---

## 12. Reportes — `/api/reportes` (8)

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 77 | GET | `/api/reportes/dashboard?anio=` | ADMIN/SECRETARIA | KPIs ejecutivos |
| 78 | GET | `/api/reportes/cuadro-merito/:id_grado?bimestre=&anio=` | ADMIN/DOCENTE | Top 10 por promedio ponderado |
| 79 | GET | `/api/reportes/alumnos-riesgo/:id_grado?bimestre=&anio=` | ADMIN/DOCENTE | Alumnos con 2+ cursos en C |
| 80 | GET | `/api/reportes/resumen-asistencia/:id_grado?anio=` | ADMIN/DOCENTE | Asistencia por alumno |
| 81 | GET | `/api/reportes/libreta/:id_alumno?bimestre=&anio=` | Autenticado | Libreta completa |
| 82 | GET | `/api/reportes/auditoria-docentes/:id_grado?bimestre=&anio=` | ADMIN | Avance de notas por docente |
| 83 | GET | `/api/reportes/libreta/:id_alumno/pdf?bimestre=&anio=` | ADMIN/DOCENTE/ESTUDIANTE (propio) | PDF de libreta (`application/pdf`, attachment) |
| 84 | GET | `/api/reportes/consolidado/:dni` | ADMIN/SECRETARIA | Consolidado histórico por estudiante: una fila por año, agrupada por `id_usuario`/DNI (notas AD/A/B/C, asistencia, pagos, deuda y promoción) |

**Dashboard data:** `total_alumnos`, `total_personal`, `total_docentes`, `recaudacion_anual`,
`pre_tickets_pendientes`, `monto_pendiente`, `total_retirados`, `total_grados`, `total_cursos`.
`total_docentes` cuenta usuarios `ACTIVO` con rol DOCENTE y ficha sin cese; `total_personal`
cuenta todo el personal con `fecha_cese IS NULL`.

**Mérito:** AD=4, A=3, B=2, C=1; promedio ponderado; top 10.

**Libreta:** alumno, tutor, notas por curso, conclusión y resumen de asistencia. Con
`?anio=` se valida que el `id_alumno` pertenezca a ese año; una matrícula de otro año
responde `404` con `errors.codigo = "MATRICULA_NO_ENCONTRADA_EN_ANIO"`. Sin el parámetro se
usa el año activo y se mantiene el comportamiento histórico.

**Año lectivo (H49):** en todo el API, `?anio=YYYY` explícito tiene prioridad para consultas
históricas; sin parámetro se usa el año activo de `anios_lectivos` (o `ANIO_LECTIVO` como
respaldo). Los listados operativos (alumnos, pagos, pre-tickets, becas, asistencias,
calificaciones, reportes y horarios) nunca mezclan años.

**Libreta PDF:** `GET /api/reportes/libreta/:id_alumno/pdf` devuelve `application/pdf` con
`Content-Disposition: attachment`. Generado con PDFKit; sin Chromium.

**Consolidado histórico (6.4):** `GET /api/reportes/consolidado/:dni` acepta ADMIN y
SECRETARIA. Devuelve `{ usuario: { id_usuario, dni, nombre_completo }, anios: [...], totales }`.
Cada fila incluye `anio`, `id_alumno`, `id_grado`, grado/sección, `estado_matricula`,
`resultado_promocion`, conteos `notas_ad/a/b/c`, `porcentaje_asistencia`, `total_pagado`,
`deuda_pendiente` (pensiones `PENDIENTE`), `total_pensiones` y `pensiones_pagadas`. La
identidad se agrupa por `id_usuario`/DNI y **no** se suma por `id_alumno`; las notas,
asistencia, pagos y pensiones se calculan por la matrícula anual. Un DNI inexistente responde
`404 ESTUDIANTE_NO_ENCONTRADO`.

**Validación de matrícula anual:** los endpoints históricos de asistencia y calificaciones
(`/asistencias/alumno/:id_alumno`, `/asistencias/alumno/:id_alumno/resumen`,
`/calificaciones/alumno/:id_alumno/curso/:id_curso` y
`/calificaciones/notas-finales/alumno/:id_alumno`) validan que el `id_alumno` pertenezca al
año solicitado. Si es de otro año responden `404` con
`errors.codigo = "MATRICULA_NO_ENCONTRADA_EN_ANIO"` (nunca una lista vacía).

---

## 13. Auditoría — `/api/auditoria` (8)

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 85 | GET | `/api/auditoria?modulo=&accion=&id_usuario=&desde=&hasta=&search=&page=&pageSize=` | ADMIN | Bitácora; `page` activa paginación (default 1, máx. 100); sin `page` máx. 200 |
| 86 | GET | `/api/auditoria/modulos` | ADMIN | Módulos distintos |
| 87 | GET | `/api/auditoria/estadisticas` | ADMIN | Totales por acción |
| 88 | GET | `/api/auditoria/actas` | ADMIN | Actas bimestrales |
| 89 | GET | `/api/auditoria/actas/:id_acta/pdf` | ADMIN | PDF de acta con matriz real de notas (H63) |
| 90 | GET | `/api/auditoria/:id` | ADMIN | Detalle de registro |
| 91 | POST | `/api/auditoria/actas/cerrar` | ADMIN | Cierra o crea un acta con hash (H48) |
| 90b | POST | `/api/auditoria/actas/:id/reabrir` | ADMIN | Reabre un acta CERRADA con motivo (H48) |

> El `COUNT(*)` de la bitácora usa los mismos filtros del listado (`módulo`, `acción`,
> `búsqueda`, fechas), por lo que `total` y `totalPages` reflejan lo filtrado.
> El dashboard de alumnos y la bitácora consumen `pagination`; tesorería, reportes y el
> buscador de notificaciones siguen pidiendo el arreglo completo (sin `page`).

**Cerrar acta body:** `{ bimestre, anio_lectivo, id_grado? }`. `id_grado` omitido o
`null` crea/cierra el acta global. El backend deriva el periodo canónico. Hace
`INSERT ... ON CONFLICT (anio_lectivo, bimestre, id_grado) DO UPDATE` y devuelve **409**
si el acta ya estaba `CERRADO`.
Respuesta: acta con `estado = CERRADO`, `fecha_cierre`, `cerrado_por`,
`hash_integridad` (MD5 de periodo + año + NOW + grado; algoritmo sin cambios), `bimestre`
y `estado_anterior`. Mensaje: **"Acta cerrada correctamente"**.

**Reabrir body:** `{ motivo }`, mínimo 10 y máximo 250 caracteres. Solo actas `CERRADO`;
devuelve **409** si el acta no está cerrada y **404** si no existe. Limpia
`hash_integridad` y guarda `reabierto_por`, `fecha_reapertura` y `motivo_reapertura`.
Mensaje: **"Acta reabierta correctamente"**.

> Un acta global (`id_grado NULL`) en `CERRADO` bloquea las notas de **todos** los grados
> del año/bimestre. Un acta por grado solo bloquea ese grado.

> `GET /api/auditoria/:id` está después de las rutas fijas para evitar colisiones.

---

## 14. SIAGIE interno - `/api/siagie` (2)

> **Exportación interna, no oficial.** No hay integración con el portal del MINEDU, no se
> sube ni se descarga una plantilla oficial y no se simula un análisis de archivo. El
> sistema genera un Excel propio con las notas finales de SIGA-UC.

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 92 | GET | `/api/siagie/resumen?anio=&bimestre=&id_grado=` | ADMIN | Conteos y advertencias de la exportación |
| 93 | GET | `/api/siagie/exportar?anio=&bimestre=&id_grado=` | ADMIN | Descarga el Excel interno |

Parámetros (query string):
- `anio`: año lectivo (default año activo). También se acepta `anio_lectivo`.
- `bimestre`: 1-4.
- `id_grado`: entero del año solicitado.

**Resumen:** devuelve `total_cursos`, `total_alumnos`, `total_notas`,
`total_conclusiones`, `total_combinaciones`, `exportable` y `advertencias`.

**Exportación:** responde
`EXPORTACION_INTERNA_<grado>_BIM<n>_<año>.xlsx` con dos hojas:
- `Notas`: una fila por alumno y curso con DNI, alumno, grado, sección, año, bimestre,
  curso, área, nota final y conclusión descriptiva.
- `Aviso`: "Exportación interna. No es una exportación oficial a SIAGIE/MINEDU." y
  metadatos del archivo.

**Cursos:** se obtienen de `carga_curricular` del grado y año, más los cursos con notas
finales registradas. No se filtra por prefijos (H05). **Alumnos:** matrículas
`Matriculado` o `PendientePago`; se excluyen los `Retirado`. Si no hay cursos o alumnos,
responde `422`. La generación se registra en `exportaciones_siagie` (`GENERADO`) y en la
bitácora (`SIAGIE`/`EXPORTAR`). No escribe archivos temporales ni usa Multer.

---

## 15. Notificaciones — `/api/notificaciones` (8)

| # | Método | Ruta | Acceso | Descripción |
|---|---|---|---|---|
| 94 | GET | `/api/notificaciones?leido=` | Autenticado | Mis notificaciones |
| 95 | GET | `/api/notificaciones/no-leidas` | Autenticado | Contador para campanita |
| 96 | GET | `/api/notificaciones/:id` | Autenticado | Detalle propio |
| 97 | PUT | `/api/notificaciones/:id/leer` | Autenticado | Marca una como leída |
| 98 | PUT | `/api/notificaciones/leer-todas` | Autenticado | Marca todas |
| 99 | DELETE | `/api/notificaciones/:id` | Autenticado | Elimina propia |
| 100 | POST | `/api/notificaciones` | ADMIN/SECRETARIA | Envía a un usuario; DOCENTE recibe 403 (H62) |
| 101 | POST | `/api/notificaciones/masivo` | ADMIN | Envía a TODOS, PERSONAL, ROL, GRADO o ALUMNO |

**Crear body:** `{ id_usuario_destino, asunto, cuerpo }`.

**Masivo body:** `{ asunto, cuerpo, destinatarios: { tipo, id? } }`.

Tipos de destinatario:

| Tipo | `id` | Destinatarios |
|---|---|---|
| `TODOS` | No | Todos los usuarios `ACTIVO` (alumnos y personal) |
| `PERSONAL` | No | Usuarios `ACTIVO` con rol ADMIN, DOCENTE o SECRETARIA |
| `ROL` | Sí (`id_rol`) | Usuarios `ACTIVO` del rol indicado; solo roles 1, 2 o 3 |
| `GRADO` | Sí (`id_grado`) | Alumnos activos del grado y año lectivo |
| `ALUMNO` | Sí (`id_alumno`) | Un alumno activo concreto |

```json
{ "asunto": "Aviso", "cuerpo": "Mensaje", "destinatarios": { "tipo": "PERSONAL" } }
```

```json
{ "asunto": "Aviso", "cuerpo": "Mensaje", "destinatarios": { "tipo": "ROL", "id": 2 } }
```

- `PERSONAL` no debe enviar `id`.
- `ROL` valida que el rol exista y sea 1, 2 o 3. Para rol 4 (ESTUDIANTE) responde
  `400` con `"Para estudiantes use TODOS, GRADO o ALUMNO."`; para un rol inexistente,
  `400` con `"El rol <id> no existe. Para estudiantes use TODOS, GRADO o ALUMNO."`.
- También acepta el formato anterior `{ destinos: [id_usuario,...], asunto, cuerpo }`.

**Respuesta masiva (sin cambios):** `total_destinatarios`, `total_guardadas`,
`correos_enviados`, `correos_fallidos`, `correos_sin_destino` y `total_enviadas`.

**Auditoría:** cada envío masivo registra `accion = ENVIAR` en `bitacora_auditoria` con
`tipo`, `total` y, cuando el tipo es `ROL`, `rol_nombre`. No se incluyen tokens ni
contraseñas.

> Ambos endpoints guardan primero en BD y luego intentan correo a
> `correo_personal || correo_institucional`; si falla un correo, la notificación permanece y
> el envío continúa con los demás destinatarios.

---

## 16. Resumen y conteo

| Módulo | Endpoints |
|---|---|
| Generales | 3 |
| Años lectivos (6.2) | 5 |
| Promociones (6.3) | 8 |
| Auth | 9 |
| Académico | 6 |
| Alumnos | 6 |
| Personal | 8 |
| Carga curricular | 9 |
| Horarios (H47) | 12 |
| Asistencias | 9 |
| Calificaciones | 6 |
| Tesorería | 13 |
| Caja | 9 |
| Reportes | 8 |
| Auditoría | 8 |
| SIAGIE interno | 2 |
| Notificaciones | 8 |
| **Total** | **129** |

| Verbo | Cantidad |
|---|---|
| GET | 71 |
| POST | 36 |
| PUT | 17 |
| DELETE | 5 |

Acceso: el detalle exacto está en la columna **Acceso** de cada tabla. Con H47 se retiró
el endpoint abierto `/api/horarios/grado/:id_grado` y se agregaron 12 endpoints de horarios.
Con 6.2 se agregaron 5 de años lectivos, con 6.3, 8 de promociones, y con 6.4, el
consolidado histórico por DNI. En el cierre de demo, SIAGIE pasó de un `POST`
`multipart/form-data` (plantilla) a dos `GET`: `resumen` y `exportar` interno.

> El mapeo previo (`docs/MAPEO_ENDPOINTS.txt`) indicaba 43/48; ese conteo era impreciso.
> El conteo vigente es 129 (71 GET, 36 POST, 17 PUT, 5 DELETE).

---

## 17. Ejemplos rápidos

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"dni\":\"74829102\",\"password\":\"UC2026*\"}"

# Listar alumnos
curl http://localhost:3000/api/alumnos?anio=2026 \
  -H "Authorization: Bearer $TOKEN"

# Registrar pago
curl -X POST http://localhost:3000/api/tesoreria/pagos \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"id_alumno\":1,\"id_concepto\":9,\"id_pension\":10,\"monto\":250,\"forma_pago\":\"Efectivo\"}"

# SIAGIE interno (exportación, no oficial)
curl -s "http://localhost:3000/api/siagie/resumen?anio=2026&bimestre=2&id_grado=3" \
  -H "Authorization: Bearer $TOKEN"

curl -s "http://localhost:3000/api/siagie/exportar?anio=2026&bimestre=2&id_grado=3" \
  -H "Authorization: Bearer $TOKEN" \
  -o EXPORTACION_INTERNA.xlsx
```
