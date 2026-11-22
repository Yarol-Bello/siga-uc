# 19 — Diseño multi-año y promoción de alumnos

> **Estado:** propuesta de diseño. **No implementada, no migrada y no ejecutada.**
> Este documento no cambia el esquema ni el código. Cualquier SQL incluido es un
> bosquejo para revisión, no un script listo para producción.
>
> **Alcance:** diseñar la convivencia de varios años lectivos y la promoción anual de
> alumnos en SIGA-UC. **No** se codifica la norma peruana de promoción: los criterios
> legales deben confirmarse con la UGEL y la dirección del colegio.

---

## 0. Resumen ejecutivo

Hoy `alumnos` es a la vez **identidad del estudiante** y **matrícula del año**. Eso
funciona para un solo año, pero impide que un alumno tenga una fila por año y hace que
consultas como `getContextoUsuario` elijan una fila arbitraria cuando existan varias.

La propuesta separa conceptualmente:

- **Identidad/login:** `usuarios` (un DNI, un usuario, una credencial QR).
- **Matrícula anual:** `alumnos` (una fila por usuario y año lectivo).
- **Oferta del año:** `grados`, `conceptos_pago`, `carga_curricular`, `periodos_clase`.
- **Decisión anual:** nueva tabla `promociones`.
- **Catálogo de años:** nueva tabla `anios_lectivos` (recomendada).
- **Secuencia de grados:** nueva columna `grados.orden`.

`cursos`, `competencias` y la escala de calificaciones siguen siendo **globales**. No se
duplican por año.

La migración debe ser **idempotente**, con preflight de duplicados y backup previo. La
promoción debe ser **previsualizable**, **transaccional**, **idempotente** y **auditada**.
La regla académica concreta (notas, asistencia, repitencia, egreso) queda en una política
configurable; el sistema solo sugiere y exige confirmación humana.

---

## 1. Modelo propuesto y migración

### 1.1 Decisión central: `alumnos` pasa a ser matrícula anual

Se mantiene `usuarios` como identidad global. Un estudiante tendrá:

```text
usuarios (1)
  └── alumnos (1 por año lectivo)
        ├── expediente_alumno (1 por año)
        ├── notas / asistencia / conclusiones (por año)
        ├── pensiones / pagos / pre_tickets (por año)
        └── promociones (origen → destino)
```

Consecuencia importante: **`id_alumno` deja de ser un identificador permanente del
estudiante** y pasa a ser el identificador de su matrícula anual. Para historial se usa
`id_usuario`, DNI o la combinación `(dni, anio_lectivo)`. El frontend debe usar el
`id_alumno` del año activo para acciones actuales y nunca reutilizar uno histórico.

`codigo_estudiante` se recomienda **estable entre años** (se copia al promover). Su
unicidad pasa a ser por año. Si el colegio prefiere un código nuevo por año, el modelo
lo permite, pero debe decidirse antes de migrar.

### 1.2 Cambios en `alumnos`

Situación actual verificada:

```text
UNIQUE (dni)
UNIQUE (id_usuario)
UNIQUE (codigo_estudiante)
```

Propuesta:

```text
QUITAR:
  alumnos_dni_key
  alumnos_id_usuario_key
  alumnos_codigo_estudiante_key

AGREGAR:
  UNIQUE (dni, anio_lectivo)
  UNIQUE (id_usuario, anio_lectivo)
  UNIQUE (codigo_estudiante, anio_lectivo)
  INDEX  (anio_lectivo, id_grado, estado_matricula)
  INDEX  (id_usuario, anio_lectivo)
```

Notas:

- `dni` sigue siendo único en `usuarios`; no se permite un segundo login para el mismo
  DNI.
- `codigo_estudiante` puede ser `NULL`; el índice compuesto permite varios `NULL` en el
  mismo año. Se recomienda completar códigos antes de promover.
- No se propone añadir `Egresado` al CHECK de `estado_matricula` en esta fase. El egreso
  se representa en `promociones.resultado`. Si la UI necesita mostrar “Egresado”, se
  deriva de la última promoción confirmada.
- No se propone borrar filas anuales: el histórico se conserva. Las FKs existentes siguen
  apuntando a la matrícula anual correcta.

### 1.3 `grados.orden`

`grados` no tiene un orden confiable. Se agrega:

```text
grados.orden INTEGER NOT NULL
  CHECK (orden > 0)
  UNIQUE (anio_lectivo, nivel, seccion, orden)
```

Interpretación:

- El orden es secuencial **dentro del mismo nivel y sección**.
- El grado siguiente se busca con `orden + 1`, mismo `nivel`, misma `seccion` y año
  destino.
- Si no existe siguiente, el resultado sugerido es **EGRESADO** (o el que defina la
  política).
- El paso de primaria a secundaria **no se hardcodea**: se configura una transición
  explícita por año o se confirma manualmente. Confirmar con dirección/UGEL.

Backfill:

1. Parsear el número inicial de `nombre_grado` (`1ro`, `2do`, etc.) cuando sea inequívoco.
2. Para nombres no numéricos o ambiguos, usar una tabla temporal de mapeo manual incluida
   en la revisión de la migración.
3. Si queda algún `orden` nulo o se viola la unicidad, **abortar** y pedir corrección;
   no inventar un orden.

### 1.4 `anios_lectivos` (recomendada)

Aunque el sistema puede seguir usando `ANIO_LECTIVO` como respaldo, se recomienda una
tabla explícita para que el año activo no dependa de una variable de entorno.

```text
anios_lectivos
  anio            INTEGER PRIMARY KEY  (CHECK 2000..2100)
  estado          VARCHAR  CHECK ('PLANIFICADO','ACTIVO','CERRADO')
  fecha_inicio    DATE
  fecha_fin       DATE
  creado_por      INTEGER FK usuarios
  fecha_creacion  TIMESTAMP
  cerrado_por     INTEGER FK usuarios
  fecha_cierre    TIMESTAMP
  observacion     TEXT
```

Reglas:

- Solo un año puede estar `ACTIVO`; índice único parcial
  `UNIQUE (estado) WHERE estado = 'ACTIVO'`.
- `ANIO_LECTIVO` del `.env` se mantiene como **bootstrap/fallback** durante la
  transición. La fuente principal pasa a ser la tabla.
- `GET /api/configuracion` debe devolver el año activo de la tabla.
- `getAnioLectivo()` puede cachear el valor corto tiempo, pero debe invalidar al activar
  o cerrar un año.
- Las consultas históricas siguen aceptando `?anio=YYYY` explícito.

### 1.5 `promociones`

```text
promociones
  id_promocion          BIGSERIAL PK
  id_alumno_origen      INTEGER NOT NULL FK alumnos(id_alumno)
  id_alumno_destino     INTEGER NULL FK alumnos(id_alumno)
  anio_origen           INTEGER NOT NULL
  anio_destino          INTEGER NULL
  id_grado_origen       INTEGER NOT NULL FK grados(id_grado)
  id_grado_destino      INTEGER NULL FK grados(id_grado)
  estado                VARCHAR NOT NULL
                        CHECK ('PREVISUALIZADA','CONFIRMADA','ANULADA','ERROR')
  resultado             VARCHAR NULL
                        CHECK ('PROMOVIDO','REPITENTE','EGRESADO','RETIRADO','PENDIENTE')
  es_override           BOOLEAN NOT NULL DEFAULT FALSE
  motivo                TEXT
  observacion           TEXT
  id_usuario            INTEGER NULL FK usuarios(id_usuario)
  fecha_creacion        TIMESTAMP NOT NULL DEFAULT now()
  fecha_confirmacion    TIMESTAMP NULL
  id_promocion_reversa  INTEGER NULL FK promociones(id_promocion)
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb
```

Restricciones e invariantes:

- **Unicidad parcial:** `UNIQUE (id_alumno_origen) WHERE estado = 'CONFIRMADA'`. Una
  matrícula origen solo puede tener **una promoción confirmada**, pero puede tener filas
  `PREVISUALIZADA`, `ANULADA` o `ERROR` sin bloquear un reintento.
- **Unicidad parcial del destino:** `UNIQUE (id_alumno_destino)
  WHERE estado = 'CONFIRMADA' AND id_alumno_destino IS NOT NULL`. Una matrícula destino
  no puede ser creada por dos promociones confirmadas.
- `anio_destino` y `id_grado_destino` son `NULL` para egresados o retirados.
- `resultado` se completa al confirmar; la previsualización no crea filas definitivas.
  **No se agrega `TRASLADADO`** al CHECK en esta fase: un traslado externo se representa
  como `RETIRADO` y se distingue con `alumnos.condicion = 'Traslado'`,
  `motivo_retiro`, `colegio_destino` y `metadata.motivo = 'TRASLADO'`.
- `metadata` guarda evidencia de la decisión: actas consultadas, notas faltantes,
  porcentaje de asistencia, deuda, política aplicada y hash de previsualización. No debe
  guardar datos sensibles innecesarios.
- No usar `ON DELETE CASCADE` desde `promociones` hacia `alumnos`; el historial no debe
  desaparecer al borrar una matrícula. Usar `RESTRICT`/`SET NULL` según el campo.

**Reversa y reintento:** al anular una promoción confirmada se conserva la fila con
`estado='ANULADA'` para auditoría. Si el año destino no tiene actividad, se puede
desvincular/eliminar la matrícula destino y volver a promover; el nuevo intento crea una
fila `CONFIRMADA` nueva y enlaza la anterior con `id_promocion_reversa`. El índice parcial
no impide ese reintento porque la fila anterior ya no está `CONFIRMADA`.

### 1.6 Política de promoción configurable (recomendada)

Para no codificar la norma peruana, la decisión se separa en una política versionable:

```text
politicas_promocion
  id_politica             SERIAL PK
  anio_origen             INTEGER NOT NULL
  anio_destino            INTEGER NULL
  nombre                  VARCHAR NOT NULL
  activo                  BOOLEAN NOT NULL DEFAULT TRUE
  requiere_actas_cerradas BOOLEAN NOT NULL DEFAULT TRUE
  requiere_notas_finales  BOOLEAN NOT NULL DEFAULT TRUE
  umbral_asistencia       NUMERIC NULL
  criterio_academico      JSONB NOT NULL DEFAULT '{}'::jsonb
  permite_override        BOOLEAN NOT NULL DEFAULT FALSE
  creado_por              INTEGER FK usuarios
  fecha_creacion          TIMESTAMP NOT NULL DEFAULT now()
  -- Unicidad con anio_destino NULL:
  --   UNIQUE (anio_origen, nombre) WHERE anio_destino IS NULL
  --   UNIQUE (anio_origen, anio_destino, nombre) WHERE anio_destino IS NOT NULL
```

`permite_override` queda en **FALSE por defecto**. Un override solo se habilita en una
política concreta y por decisión del ADMIN; no se asume permiso global. Si la política no
lo permite, el sistema no debe ofrecer el override en la UI ni aceptarlo en la API.

`criterio_academico` es un JSON **descriptivo**, no una fórmula legal escondida. Ejemplo
de contenido a validar con dirección/UGEL:

```json
{
  "modo": "manual",
  "observacion": "La dirección revisa caso por caso",
  "fuente": "notas_finales_area"
}
```

o, si la dirección define un criterio:

```json
{
  "modo": "configurable",
  "min_bimestres": 4,
  "min_notas_finales_por_curso": "todas",
  "umbral_asistencia_pct": 85,
  "observacion": "Criterio pendiente de validar con UGEL"
}
```

El sistema **no** debe interpretar ese JSON como una norma nacional. La UI debe mostrar
“sugerencia según la política del colegio” y exigir confirmación.

### 1.7 Impacto en tablas relacionadas

| Tabla | Impacto | Acción propuesta |
|---|---|---|
| `usuarios` | Sin cambio de esquema | Un usuario por persona; no crear usuario nuevo al promover |
| `apoderados` | Sin cambio de esquema; sí cambio de código | `alumnoDao.crear` hoy inserta siempre un apoderado nuevo (no busca por DNI). Con `apoderados.dni` único, dos hermanos fallan. Fase 6.0: find-or-create por DNI y reutilizar `id_apoderado` entre años; tabla puente queda para fase posterior |
| `expediente_alumno` | Ya es único por `id_alumno` | Crear uno nuevo por matrícula anual; el histórico queda congelado |
| `becas` | Referencia a matrícula anual | Decidir si se clonan becas activas al año siguiente; recomendación: clonar solo con confirmación y vigencia |
| `credenciales_qr` | Única por `id_usuario` | No clonar ni regenerar por año; el carné es de la persona |
| `pre_tickets` | Referencia a matrícula anual | No arrastrar pendientes; preflight y regularización antes de promover |
| `pensiones` | Ya tiene `anio_lectivo` | Crear cronograma nuevo para la matrícula destino; no copiar estados `PAGADO`/`ANULADO` |
| `pagos` | Referencia a matrícula anual | El histórico queda en la fila anual de origen; reportes consolidados deben agrupar por `id_usuario`/DNI |
| `notas_finales_area` | Ya tiene `anio_lectivo` | Sin cambio; la matrícula anual ya separa los registros |
| `calificaciones` / `conclusiones_descriptivas` | Ya tienen `anio_lectivo` | Sin cambio; conservar histórico |
| `asistencia_alumnos` | **No tiene columna `anio_lectivo`**; el año se deriva de `fecha` | Mantener `EXTRACT(YEAR FROM fecha)` en Fase 6.0; no agregar columna. La matrícula anual ya separa `id_alumno`. Agregar/verificar índices `(id_alumno, fecha)` e `(id_grado, fecha)` |
| `actas_bimestrales` | Por año/grado | No clonar; el año nuevo empieza sin actas |
| `grados` | Añadir `orden` | Backfill y validación antes de crear el año siguiente |
| `conceptos_pago` | Por año | Clonar MATRICULA/PENSION; OTROS con confirmación |
| `carga_curricular` | Por año | Clonar docentes/cursos; preflight de docentes inactivos o sin capacidad |
| `periodos_clase` | Por año | Clonar malla; permitir ajustes antes de confirmar |
| `tutores_grado` | Por año | Clonar solo tutores activos; permitir dejar vacío |
| `horarios` | Por año/carga | **No** publicar ni clonar automáticamente; generar en BORRADOR si se desea |
| `cursos`, `competencias`, escala | Globales | Sin cambio; si cambia el plan curricular, evaluar versionado futuro |

#### Apoderados: limitación actual y corrección necesaria

`apoderados.dni` es único global y `alumnos.id_apoderado` es una FK simple. El problema
no es solo multi-año: `alumnoDao.crear` **hoy inserta un apoderado nuevo cada vez** que se
crea un alumno con apoderado y no busca uno existente por DNI (bloque de creación del
apoderado en `alumnoDao.crear`). Por eso, con `apoderados.dni` único, **dos hermanos con
el mismo apoderado fallan** al intentar insertar el mismo DNI dos veces.

Decisión para Fase 6.0:

- **No cambiar el esquema de `apoderados`** en la migración multi-año.
- Cambiar `alumnoDao.crear` a un flujo **find-or-create por DNI**:
  1. Si viene DNI y ya existe, reutilizar `id_apoderado`.
  2. Si no existe, crear una sola fila.
  3. Si no viene DNI, crear una fila nueva (no se puede deduplicar sin documento).
- La promoción y el reingreso **reutilizan** el `id_apoderado` de la matrícula origen; no
  crean uno nuevo por año.
- Si se actualizan teléfono/correo del apoderado, hacerlo de forma explícita y auditada;
  no sobrescribir nombres silenciosamente.
- Una tabla puente `alumnos_apoderados` (para varios apoderados por alumno o varios
  alumnos por apoderado con roles distintos) queda para una fase posterior. No se incluye
  en la migración de multi-año.
- Mientras no exista la tabla puente, dos hermanos comparten la misma fila de apoderado;
  es aceptable para el caso actual y evita el fallo de DNI duplicado.

### 1.8 Migración idempotente (bosquejo, no ejecutar)

> Requisitos previos: backup completo, ventana sin escrituras, revisión de duplicados y
> prueba en una base desechable. Ejecutar en una transacción si el volumen lo permite.

```sql
BEGIN;

-- 0. Preflight: deben devolver 0 filas antes de crear los índices compuestos.
--    (Con los UNIQUE globales actuales deberían ser 0; se valida por si hubo SQL manual.)
SELECT dni, anio_lectivo, COUNT(*)
FROM alumnos GROUP BY dni, anio_lectivo HAVING COUNT(*) > 1;
SELECT id_usuario, anio_lectivo, COUNT(*)
FROM alumnos GROUP BY id_usuario, anio_lectivo HAVING COUNT(*) > 1;
SELECT codigo_estudiante, anio_lectivo, COUNT(*)
FROM alumnos WHERE codigo_estudiante IS NOT NULL
GROUP BY codigo_estudiante, anio_lectivo HAVING COUNT(*) > 1;

-- 1. Catálogo de años (recomendado).
CREATE TABLE IF NOT EXISTS anios_lectivos (
  anio INTEGER PRIMARY KEY CHECK (anio BETWEEN 2000 AND 2100),
  estado VARCHAR(20) NOT NULL DEFAULT 'PLANIFICADO'
    CHECK (estado IN ('PLANIFICADO','ACTIVO','CERRADO')),
  fecha_inicio DATE,
  fecha_fin DATE,
  creado_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT now(),
  cerrado_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  fecha_cierre TIMESTAMP,
  observacion TEXT
);

-- Sembrar años ya usados por datos existentes (idempotente).
INSERT INTO anios_lectivos (anio)
SELECT DISTINCT anio_lectivo FROM alumnos
ON CONFLICT (anio) DO NOTHING;

INSERT INTO anios_lectivos (anio)
SELECT DISTINCT anio_lectivo FROM grados
ON CONFLICT (anio) DO NOTHING;

INSERT INTO anios_lectivos (anio)
SELECT DISTINCT anio_lectivo FROM conceptos_pago
ON CONFLICT (anio) DO NOTHING;

-- Repetir el mismo INSERT ... SELECT para cada tabla con año explícito:
--   carga_curricular, periodos_clase, actas_bimestrales,
--   notas_finales_area, pensiones, conclusiones_descriptivas.
-- Si se desea reconstruir años desde fechas, derivar de pagos.fecha_pago o
-- asistencia_alumnos.fecha; no es obligatorio para el modelo.

-- Activar el año indicado solo si no hay otro activo:
-- psql -v anio_activo=2026
UPDATE anios_lectivos
SET estado = 'ACTIVO'
WHERE anio = :anio_activo
  AND NOT EXISTS (
    SELECT 1 FROM anios_lectivos WHERE estado = 'ACTIVO' AND anio <> :anio_activo
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_anio_activo
  ON anios_lectivos (estado) WHERE estado = 'ACTIVO';

-- 2. Orden de grados: agregar nullable, backfill, validar y recién después NOT NULL.
ALTER TABLE grados ADD COLUMN IF NOT EXISTS orden INTEGER;

UPDATE grados
SET orden = substring(nombre_grado FROM '^([1-6])')::INTEGER
WHERE orden IS NULL
  AND substring(nombre_grado FROM '^([1-6])') IS NOT NULL;

-- Si quedan nulos, la migración debe abortar y usar un mapeo manual revisado.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM grados WHERE orden IS NULL) THEN
    RAISE EXCEPTION 'H49: hay grados sin orden; complete el mapeo manual antes de continuar';
  END IF;
END $$;

ALTER TABLE grados ALTER COLUMN orden SET NOT NULL;

ALTER TABLE grados DROP CONSTRAINT IF EXISTS chk_grado_orden;
ALTER TABLE grados
  ADD CONSTRAINT chk_grado_orden CHECK (orden > 0);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grado_anio_nivel_seccion_orden
  ON grados (anio_lectivo, nivel, seccion, orden);

-- 3. Alumnos: quitar UNIQUE globales y crear UNIQUE por año.
ALTER TABLE alumnos DROP CONSTRAINT IF EXISTS alumnos_dni_key;
ALTER TABLE alumnos DROP CONSTRAINT IF EXISTS alumnos_id_usuario_key;
ALTER TABLE alumnos DROP CONSTRAINT IF EXISTS alumnos_codigo_estudiante_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alumno_dni_anio
  ON alumnos (dni, anio_lectivo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumno_usuario_anio
  ON alumnos (id_usuario, anio_lectivo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumno_codigo_anio
  ON alumnos (codigo_estudiante, anio_lectivo);

CREATE INDEX IF NOT EXISTS ix_alumno_anio_grado_estado
  ON alumnos (anio_lectivo, id_grado, estado_matricula);
CREATE INDEX IF NOT EXISTS ix_alumno_usuario_anio
  ON alumnos (id_usuario, anio_lectivo);

-- 4. Promociones.
CREATE TABLE IF NOT EXISTS promociones (
  id_promocion BIGSERIAL PRIMARY KEY,
  id_alumno_origen INTEGER NOT NULL REFERENCES alumnos(id_alumno) ON DELETE RESTRICT,
  id_alumno_destino INTEGER REFERENCES alumnos(id_alumno) ON DELETE RESTRICT,
  anio_origen INTEGER NOT NULL,
  anio_destino INTEGER,
  id_grado_origen INTEGER NOT NULL REFERENCES grados(id_grado) ON DELETE RESTRICT,
  id_grado_destino INTEGER REFERENCES grados(id_grado) ON DELETE RESTRICT,
  estado VARCHAR(20) NOT NULL DEFAULT 'PREVISUALIZADA'
    CHECK (estado IN ('PREVISUALIZADA','CONFIRMADA','ANULADA','ERROR')),
  resultado VARCHAR(20)
    CHECK (resultado IN ('PROMOVIDO','REPITENTE','EGRESADO','RETIRADO','PENDIENTE')),
  es_override BOOLEAN NOT NULL DEFAULT FALSE,
  motivo TEXT,
  observacion TEXT,
  id_usuario INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT now(),
  fecha_confirmacion TIMESTAMP,
  id_promocion_reversa INTEGER REFERENCES promociones(id_promocion) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Solo una promoción CONFIRMADA por matrícula origen.
-- Las filas PREVISUALIZADA/ANULADA/ERROR no bloquean un reintento.
CREATE UNIQUE INDEX IF NOT EXISTS uq_promocion_origen_confirmada
  ON promociones (id_alumno_origen) WHERE estado = 'CONFIRMADA';
CREATE UNIQUE INDEX IF NOT EXISTS uq_promocion_destino_confirmada
  ON promociones (id_alumno_destino)
  WHERE estado = 'CONFIRMADA' AND id_alumno_destino IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_promocion_anios
  ON promociones (anio_origen, anio_destino, estado);

-- 5. Política configurable (opcional/recomendada antes de usar promoción real).
CREATE TABLE IF NOT EXISTS politicas_promocion (
  id_politica SERIAL PRIMARY KEY,
  anio_origen INTEGER NOT NULL,
  anio_destino INTEGER,
  nombre VARCHAR(120) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  requiere_actas_cerradas BOOLEAN NOT NULL DEFAULT TRUE,
  requiere_notas_finales BOOLEAN NOT NULL DEFAULT TRUE,
  umbral_asistencia NUMERIC,
  criterio_academico JSONB NOT NULL DEFAULT '{}'::jsonb,
  permite_override BOOLEAN NOT NULL DEFAULT FALSE,
  creado_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT now()
);

-- anio_destino NULL no puede duplicar la misma política:
CREATE UNIQUE INDEX IF NOT EXISTS uq_politica_con_destino
  ON politicas_promocion (anio_origen, anio_destino, nombre)
  WHERE anio_destino IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_politica_sin_destino
  ON politicas_promocion (anio_origen, nombre)
  WHERE anio_destino IS NULL;

COMMIT;
```

#### Orden de ejecución recomendado

1. Backup y prueba en base desechable.
2. Preflight de duplicados y de `grados` sin orden.
3. Crear `anios_lectivos` y sembrar años.
4. Agregar/backfillar `grados.orden`.
5. Quitar UNIQUE globales de `alumnos` **después** de validar que no hay duplicados por
   año.
6. Crear `promociones` y, si se usará, `politicas_promocion`.
7. Ejecutar la migración dos veces en la base de prueba: la segunda debe ser inocua.
8. Validar conteos: una fila por alumno/año, sin pérdida de filas, mismos `id_alumno`
   históricos y FKs intactas.

#### Rollback

- Si falla antes del `COMMIT`, la transacción revierte.
- Si se confirmó, restaurar backup o ejecutar un rollback explícito **solo** si no se han
  creado matrículas nuevas: volver a crear los UNIQUE globales, eliminar `promociones` y
  `anios_lectivos` y quitar `grados.orden`. No hacerlo con datos nuevos sin un plan de
  reconciliación.
- La migración no debe eliminar columnas ni tablas existentes.

---

## 2. Cambios de autenticación

### 2.1 Resolver la matrícula por año activo

`autorizacionDao.getContextoUsuario` debe recibir el año activo y resolver **una** fila
anual:

```sql
LEFT JOIN alumnos a
  ON a.id_usuario = u.id_usuario
 AND a.anio_lectivo = $2
```

No usar `LIMIT 1` sin filtro de año. Si el rol es ESTUDIANTE y no hay fila:

- `id_alumno` queda `NULL`.
- La API debe devolver un error controlado en endpoints que requieren matrícula:
  `403` con código `SIN_MATRICULA_ACTIVA` y mensaje
  “No tienes matrícula en el año lectivo {año}. Contacta a Secretaría.”
- No se debe caer silenciosamente a otro año.

### 2.2 Login y perfil

- `authService.login` obtiene `getAlumnoInfo(id_usuario, anioActivo)`.
- `getPerfil` hace lo mismo.
- `info_adicional` debe incluir: `id_alumno`, `anio_lectivo`, `id_grado`, `nombre_grado`,
  `seccion`, `estado_matricula`, `codigo_estudiante` y `matricula_activa`.
- Si no hay matrícula activa, se recomienda **permitir el login** con
  `matricula_activa: false` y mostrar una pantalla informativa. Así el alumno egresado o
  pendiente puede ver el mensaje sin quedar bloqueado en el login. La alternativa es
  rechazar el login con `409`; decisión del dueño (ver sección 8).
- El JWT sigue llevando `id_usuario` y rol. `id_alumno` se resuelve en cada request desde
  la base; nunca se confía en un `id_alumno` del token para permisos.

### 2.3 Guards y permisos

- `checkAlumnoPropio` compara contra `req.usuario.id_alumno` (matrícula activa). Si es
  `NULL`, responde `403`.
- `docenteTieneAlumno` sigue funcionando con la matrícula anual, porque ya cruza
  `a.anio_lectivo = cc.anio_lectivo`. Para consultas históricas, el servicio debe recibir
  el año explícito y validar la matrícula de ese año.
- No se debe permitir que un estudiante consulte la matrícula de otro año por cambiar un
  `id_alumno` en la URL.

### 2.4 Frontend

- El sidebar y el dashboard usan `info_adicional` de la matrícula activa.
- Si `matricula_activa` es `false`, mostrar un aviso claro y no renderizar notas,
  asistencia ni horario del año.
- El cambio de año activo debe invalidar la sesión o refrescar el perfil para evitar que
  un `id_alumno` viejo quede en memoria.

---

## 3. Rollover anual

El rollover prepara la **oferta del año siguiente**. No promueve alumnos por sí solo.

### 3.1 Qué se clona

| Elemento | ¿Clonar? | Condición |
|---|---|---|
| `anios_lectivos` | Crear fila | Año destino nuevo; estado `PLANIFICADO` |
| `grados` | Sí | Copiar nombre, nivel, sección y `orden`; permitir ajustes |
| `conceptos_pago` | Sí | MATRICULA y PENSION obligatorios; OTROS con confirmación |
| `carga_curricular` | Sí | Copiar curso/grado/docente/horas; preflight de docente activo |
| `periodos_clase` | Sí | Copiar malla y orden; permitir cambios de horas |
| `tutores_grado` | Sí | Solo tutores activos; permitir vacío |
| `horarios` | No automático | Se generan en BORRADOR después; nunca publicar solos |
| `actas_bimestrales` | No | Año nuevo sin actas |
| `notas`, `asistencia`, `conclusiones` | No | Histórico permanece en el año origen |
| `pensiones`, `pagos`, `pre_tickets` | No | Se crean al matricular/promover |
| `becas` | No automático | Se evalúan por alumno en la promoción |
| `credenciales_qr` | No | Una por usuario; no cambia por año |
| `cajas` / movimientos | No | La caja no es anual en el modelo actual |

### 3.2 Previsualización

Antes de escribir, el ADMIN debe ver un resumen:

- Año origen y destino.
- Grados que se crearán y su `orden`.
- Conceptos que se copiarán, con montos actuales.
- Carga curricular: total de asignaciones, docentes activos/inactivos, docentes sin
  capacidad horaria y cursos sin docente.
- Períodos: cantidad y solapamientos de horario.
- Tutores: asignados y faltantes.
- Conflictos: nombres duplicados, grados sin orden, conceptos faltantes, año destino ya
  existente con datos.

La previsualización debe ser **de solo lectura** y devolver un hash/`preview_id` con el
conjunto de datos revisado.

### 3.3 Confirmación

- Transacción única con advisory lock por `(anio_origen, anio_destino)`.
- Crear `anios_lectivos` si no existe.
- Clonar en orden: grados → conceptos → períodos → carga → tutores.
- Usar `ON CONFLICT` por las claves naturales existentes (`grados` nombre/sección/año,
  `conceptos` nombre/año, `periodos` año/orden, `carga` grado/curso/año, tutor
  grado/año) y **no sobrescribir** filas existentes sin confirmación.
- Si el año destino ya tiene datos incompatibles, abortar y mostrar el detalle. No hacer
  “merge” silencioso.
- No activar el año destino automáticamente; activarlo es una acción separada y auditada.
- Al finalizar: auditoría con conteos y enlace al año creado.

### 3.4 Idempotencia y reversión

- Repetir la confirmación con el mismo `preview_id` no debe duplicar filas.
- Si se canceló antes del `COMMIT`, no queda nada.
- Si se confirmó por error y el año destino no tiene matrículas, pagos, notas ni
  asistencia, se puede eliminar en una transacción auditada. Si ya tiene actividad, no se
  borra: se corrige manualmente con un plan de reconciliación.

---

## 4. Promoción de alumnos

La promoción es el paso **después** del rollover y antes de la matrícula del año nuevo.

### 4.1 Previsualización por alumno

Para cada matrícula del año origen, mostrar:

- Alumno, DNI, código, grado y sección actuales.
- Estado de matrícula (`Matriculado`, `PendientePago`, `Retirado`).
- Grado destino sugerido (por `orden`), o `EGRESADO` si no hay siguiente.
- Estado de las actas del grado: cerradas, abiertas o faltantes.
- Notas finales: cursos con nota, cursos faltantes y bimestres incompletos.
- Asistencia: porcentaje y umbral de la política.
- Deuda/pensiones/pre-tickets pendientes, solo como advertencia.
- Becas activas que podrían continuar.
- Resultado sugerido: `PROMOVIDO`, `REPITENTE`, `EGRESADO`, `RETIRADO` o `PENDIENTE`.
- Bloqueos y overrides necesarios.

La previsualización no debe escribir matrículas nuevas. Debe poder exportarse para
revisión de dirección. Si se decide persistirla para revisión, se guarda **solo** una
fila de `promociones` en estado `PREVISUALIZADA` (sin `id_alumno_destino` y sin tocar
`alumnos`). La confirmación puede ser efímera o reutilizar esa fila; en ambos casos se
recalcula el hash antes de escribir.

### 4.2 Sugerencia configurable

El sistema no decide la norma. La sugerencia se calcula con la política activa:

1. Si `estado_matricula` es `Retirado` **o** `condicion` es `Traslado` →
   `RETIRADO`, sin destino. Guardar `metadata.motivo = 'RETIRO' | 'TRASLADO'` y
   conservar `motivo_retiro`/`colegio_destino`.
2. Si no hay grado siguiente y el origen es último grado → `EGRESADO`.
3. Si la política marca repitencia por notas/asistencia → `REPITENTE`, mismo grado.
4. Si faltan actas/notas y la política exige completarlas → `PENDIENTE`/bloqueado.
5. Si el paso de nivel no tiene transición configurada → `PENDIENTE`; no adivinar.
6. En los demás casos → `PROMOVIDO` al grado siguiente.

La sugerencia debe ser **editable** por el ADMIN/Dirección con un motivo si la política
lo permite (`es_override=true`, `motivo` obligatorio). El override no puede saltarse la
transacción ni la auditoría.

### 4.3 Confirmación y creación de la ficha del año siguiente

En una sola transacción por lote (o por grado, si el volumen lo exige):

1. Bloquear con advisory lock `promocion:{anio_origen}:{anio_destino}`.
2. Recalcular/validar el hash de previsualización. Si cambiaron notas, actas o
   matrículas, abortar y pedir nueva previsualización.
3. Para cada alumno con resultado `PROMOVIDO` o `REPITENTE`:
   - Crear nueva fila en `alumnos` con el mismo `id_usuario`, DNI, nombres, apellidos,
     fecha de nacimiento, `id_apoderado`, `codigo_estudiante` y `condicion`.
   - `anio_lectivo = anio_destino`.
   - `id_grado = id_grado_destino` (`orden+1` o el mismo si repite).
   - `estado_matricula`: recomendación `PendientePago` si hay concepto de matrícula;
     `Matriculado` solo si se decide no cobrar o si la matrícula ya está pagada.
   - Crear `expediente_alumno` nuevo (`congelado=false`, nivel/asistencia iniciales).
   - Copiar becas activas solo si la política/confirmación lo indica; no copiar becas
     vencidas.
   - Crear el pre-ticket de matrícula del año nuevo si existe concepto, reutilizando el
     flujo actual de matrícula (sin crear un usuario nuevo).
   - No crear una nueva `credenciales_qr`; el usuario ya tiene la suya.
   - No copiar notas, asistencia, pagos, pensiones ni pre-tickets del año anterior.
4. Para `EGRESADO`: no crear fila destino; registrar `promociones.resultado='EGRESADO'`.
5. Para `RETIRADO`: no crear fila destino; conservar el retiro y registrar el resultado.
6. Insertar/actualizar `promociones` con `estado='CONFIRMADA'`, `resultado`, `metadata`,
   usuario y fecha.
7. Auditoría y `COMMIT`.

La matrícula destino debe poder generarse también de forma manual (alumno nuevo,
reingreso o traslado) sin pasar por promoción.

### 4.4 Egresados, repitentes y retirados

| Caso | Resultado | ¿Nueva fila? | Observación |
|---|---|---|---|
| Aprueba y hay grado siguiente | `PROMOVIDO` | Sí | Mismo usuario, código, apoderado |
| Último grado (5to) | `EGRESADO` | No | El histórico queda en la última matrícula |
| Repite | `REPITENTE` | Sí, mismo grado | Requiere motivo si es override |
| Retirado | `RETIRADO` | No | No se reactiva automáticamente |
| Sin datos/actas | `PENDIENTE` | No hasta resolver | Se bloquea o requiere override |
| Traslado externo | `RETIRADO` | No | Usar `alumnos.condicion='Traslado'` (ya existe), `motivo_retiro`, `colegio_destino` y `metadata.motivo='TRASLADO'`. **No se agrega `TRASLADADO`** al CHECK de `promociones.resultado` |

**Decisión explícita sobre traslados:** no se crea un resultado `TRASLADADO` ni se amplía
`alumnos.condicion`. El traslado externo es un retiro con condición `Traslado`; el sistema
lo muestra como tal y conserva el colegio de destino. Si en el futuro se necesita un
reporte diferenciado, se deriva de `condicion`/`motivo_retiro` o se agrega una tabla de
motivos, sin cambiar el significado de `estado_matricula`.

No se propone agregar `Egresado` a `estado_matricula` en esta fase. Si se necesita en
reportes, derivarlo de `promociones` o de la ausencia de matrícula activa.

### 4.5 Idempotencia, auditoría y reversión

- `UNIQUE (id_alumno_origen) WHERE estado='CONFIRMADA'` impide dos promociones
  confirmadas de la misma matrícula, pero **no** impide reintentar después de una
  `ANULADA`.
- Confirmar dos veces el mismo lote devuelve la promoción confirmada existente
  (`ya_confirmada=true`) o `409`; no duplica filas.
- Si una fila falla, **todo el lote hace ROLLBACK**. No dejar promociones parciales.
- Auditoría:
  - `PREVISUALIZAR`: año origen/destino, cantidad de alumnos, política aplicada.
  - `CONFIRMAR`: conteos por resultado, IDs de promociones, overrides y motivos.
  - `ANULAR`: motivo y validación de que no hay actividad en el año destino.
- Reversión:
  1. Marcar la promoción como `ANULADA`; conservar la fila para auditoría.
  2. Si la matrícula destino no tiene pagos, notas, asistencia ni pre-tickets pagados,
     desvincular (`id_alumno_destino = NULL`) y eliminar la matrícula/expediente destino
     en la misma transacción.
  3. Si ya tiene actividad, **no borrar**; corregir con un procedimiento auditado y no
     permitir un segundo confirmado mientras exista actividad.
  4. Un reintento posterior crea una nueva fila `CONFIRMADA` y enlaza la anterior con
     `id_promocion_reversa`; el índice parcial lo permite porque la anterior está
     `ANULADA`.

---

## 5. Reglas de negocio y validaciones

| Regla | Comportamiento propuesto |
|---|---|
| Actas cerradas | Exigir las actas de los bimestres configurados (por defecto los 4) del grado origen. Un acta global `CERRADO` de H48 bloquea todo el grado. Si falta, bloquear salvo override permitido |
| Notas finales | Verificar `notas_finales_area` por curso/bimestre según política. Faltantes = advertencia o bloqueo, configurable |
| Asistencia | Calcular porcentaje del año origen; comparar con `umbral_asistencia` de la política. No hardcodear 85% ni otra cifra |
| Nota final / promedio | No definir una fórmula nacional en código. La política puede usar notas finales existentes o modo manual; la decisión final es humana |
| Retirados | Nunca se promueven; resultado `RETIRADO` |
| Último grado | `EGRESADO` por defecto; confirmar con dirección/UGEL |
| Repitencia | Configurable; si se aplica, nueva matrícula en el mismo grado |
| Deuda | Solo advertencia académica; no bloquear la promoción por deuda salvo decisión expresa del dueño |
| Pre-tickets pendientes | Preflight y regularización; no arrastrar al año siguiente |
| Override | Solo ADMIN/Dirección, con motivo obligatorio y auditoría. No relaja FKs ni transacción |
| Doble promoción | Bloqueada por `UNIQUE (id_alumno_origen) WHERE estado='CONFIRMADA'`. Tras `ANULADA`, se permite reintento auditado |
| Año destino | Debe existir o crearse en el rollover; no se promueve a un año sin grados |
| Sección | Se conserva por defecto; el preview permite cambiarla con justificación |
| Transición de nivel | Configuración explícita; si no existe, `PENDIENTE`, no adivinar |

---

## 6. Qué pasa con el histórico

### 6.1 Login del alumno

- El alumno conserva su `usuarios.dni`, contraseña y credencial QR.
- Al cambiar el año activo, el login resuelve la matrícula de ese año.
- Si no tiene matrícula activa (egresado, retirado o aún no promovido), se muestra el
  mensaje correspondiente. Recomendación: permitir login con `matricula_activa=false` y
  vista informativa, sin acceso a módulos académicos.
- El `id_alumno` del año anterior no se reutiliza en la sesión actual.

### 6.2 Reportes por año

- Los reportes deben seguir aceptando `?anio=YYYY` y resolver la matrícula anual de ese
  año.
- `GET /alumnos?anio=` ya filtra; debe ser la vía para que Secretaría/Admin elija una
  matrícula histórica.
- Las libretas usan `id_alumno` + `anio` (ya existe en H56/H51). Para histórico, el
  ADMIN/SECRETARÍA selecciona el año y luego el alumno.
- Un reporte consolidado por estudiante a través de varios años requiere agrupar por
  `id_usuario`/DNI; no se debe sumar por `id_alumno` porque cambia cada año.

### 6.3 Libretas y PDF

- La libreta de un año usa la matrícula de ese año; el PDF conserva el grado, sección y
  notas de ese período.
- No se regenera una libreta histórica con datos del año actual.
- Si un alumno repite, tendrá dos libretas del mismo grado en años distintos; se
  diferencian por `anio_lectivo`.

### 6.4 Pagos, pensiones y caja

- Cada matrícula anual tiene sus propias pensiones, pagos y pre-tickets.
- El estado de cuenta histórico se consulta por año; el consolidado por estudiante se
  agrupa por `id_usuario`.
- La caja no se duplica por año; los movimientos conservan su fecha y referencia al pago
  anual.
- Una deuda impaga del año anterior no se transfiere automáticamente al año nuevo; si se
  quiere bloquear la matrícula por deuda, es una regla separada que debe aprobar el dueño.

### 6.5 Becas y apoderados

- Las becas históricas quedan ligadas a la matrícula anual de origen.
- Las becas activas pueden clonarse al año siguiente solo con confirmación y dentro de su
  vigencia.
- El apoderado se reutiliza; si cambia el contacto, el histórico puede reflejar el
  contacto actual.
- `alumnoDao.crear` debe cambiar de “insertar siempre” a **find-or-create por DNI**. Sin
  ese cambio, dos hermanos con el mismo apoderado seguirán fallando por
  `apoderados.dni` único, incluso antes de multi-año.
- Si se necesita una foto histórica del apoderado o varios apoderados por alumno, se
  requiere una tabla puente/historial adicional (fuera de esta fase).

---

## 7. Plan de pruebas

### 7.1 Migración

1. Base desechable con el dump actual: ejecutar la migración y comparar conteos antes/después.
2. Ejecutarla dos veces: la segunda no debe fallar ni duplicar índices/tablas.
3. Insertar dos matrículas del mismo DNI en años distintos: debe permitirlo.
4. Intentar dos matrículas del mismo DNI en el mismo año: debe fallar.
5. Insertar dos matrículas del mismo `id_usuario` en años distintos: debe permitirlo.
6. Insertar dos matrículas del mismo `id_usuario` en el mismo año: debe fallar.
7. Verificar que un `codigo_estudiante` se repite entre años pero no dentro del mismo año.
8. Verificar `grados.orden` en 1ro–5to y que un grado sin orden aborta la migración.
9. Verificar que ningún `id_alumno` histórico cambió y que las FKs siguen válidas.
10. Insertar dos políticas con `anio_destino = NULL` y mismo `(anio_origen, nombre)`: debe
    fallar por el índice parcial. Con destino no nulo, también debe fallar el duplicado.
11. Rollback en base desechable y restauración desde backup.

### 7.2 Autenticación y permisos

1. Alumno con matrícula 2026 y 2027: login en 2026 resuelve la fila 2026; login en 2027
   resuelve la fila 2027.
2. Alumno con dos filas: `getContextoUsuario` no elige al azar; devuelve la del año activo.
3. Alumno sin matrícula en el año activo: mensaje claro y endpoints protegidos.
4. Estudiante no puede consultar el `id_alumno` de otro año ni de otro alumno.
5. Docente sigue viendo solo alumnos de sus cursos del año correspondiente.
6. Perfil devuelve grado, sección y año de la matrícula activa.
7. Token emitido antes del cambio de año: al usarlo, el contexto se resuelve con el año
   activo y no con el año viejo.

### 7.3 Rollover

1. Preview de 2026→2027: muestra grados, conceptos, carga, períodos y conflictos.
2. Confirmación: crea solo la oferta; no crea alumnos, notas ni actas.
3. Confirmación repetida: no duplica.
4. Docente inactivo en la carga: el preview lo marca y bloquea/advierte.
5. Año destino con datos: no sobrescribe; muestra conflicto.
6. Activar 2027: solo un año activo; `GET /configuracion` lo refleja.
7. Desactivar/cerrar 2027: el histórico 2026 sigue consultable.

### 7.4 Promoción

1. **Promoción normal:** 1ro→2do, crea matrícula destino, expediente nuevo y pre-ticket de
   matrícula; no copia notas/asistencia/pagos.
2. **5to:** resultado `EGRESADO`, no crea matrícula destino, no crea pre-ticket.
3. **Repitente:** 2do→2do, nueva matrícula en el mismo grado, motivo si es override.
4. **Retirado:** resultado `RETIRADO`, no crea matrícula destino.
5. **Traslado externo:** resultado `RETIRADO`, `condicion='Traslado'`, motivo y colegio de
   destino; no crea matrícula destino ni usa un resultado `TRASLADADO`.
6. **Sin notas finales:** bloqueo por defecto; con override permitido, registra motivo y
   evidencia.
7. **Sin actas cerradas:** bloqueo por defecto; con override, registra qué actas faltan.
8. **Doble promoción:** segundo intento con la misma promoción confirmada no duplica;
   devuelve idempotencia o 409.
9. **Anulación y reintento:** anular una promoción sin actividad, verificar que se puede
   volver a confirmar y que la nueva fila enlaza la anterior con `id_promocion_reversa`.
10. **Doble clic en confirmar:** una sola transacción, un solo conjunto de filas nuevas.
11. **Rollback:** forzar un error en una fila; ninguna matrícula del lote debe quedar
    creada.
12. **Histórico:** después de promover, la libreta del año anterior sigue mostrando las
    notas y el grado anteriores.
13. **Becas:** beca activa se clona solo si se confirma; beca vencida no se clona.
14. **QR:** el alumno promovido conserva el mismo `codigo_qr`; no se genera uno nuevo.
15. **Pensiones:** el año nuevo no hereda pensiones `PAGADO` del año anterior.
16. **Pre-ticket pendiente:** el preview lo advierte; no se arrastra al año nuevo.
17. **Auditoría:** `PREVISUALIZAR`, `CONFIRMAR` y `ANULAR` quedan con usuario, conteos y
    motivos.

### 7.5 Regresión

1. `npm run test:e2e` en 19 PASS.
2. `npm run build` sin errores.
3. `node --check` en los JS modificados.
4. Libretas, boletas y actas PDF siguen funcionando.
5. Caja, tesorería y asistencia no mezclan años.
6. Un alumno con una sola matrícula sigue funcionando igual que hoy.
7. Dos hermanos con el mismo apoderado: `alumnoDao.crear` reutiliza el `id_apoderado`
   por DNI y no falla por el UNIQUE de `apoderados.dni`.
8. Asistencia histórica: las consultas siguen usando `EXTRACT(YEAR FROM fecha)` y no
   requieren una columna `anio_lectivo` nueva.

---

## 8. Preguntas abiertas para el dueño

Cada pregunta incluye una recomendación, pero **ninguna se implementa sin confirmación**.

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Qué criterio de promoción exige hoy la UGEL/dirección? | No hardcodear. Cargar una política configurable y validar el texto con UGEL/dirección |
| 2 | ¿Se permite repetir el mismo grado? ¿Cuántas veces? | Configurable; permitir repitencia con motivo y auditoría |
| 3 | ¿Qué estado tiene un egresado de 5to? | No crear matrícula nueva; registrar `EGRESADO` en `promociones`, no ampliar `estado_matricula` todavía |
| 4 | ¿El alumno promovido queda `PendientePago` hasta pagar matrícula? | Sí, si existe concepto de matrícula; si no existe, `Matriculado` con advertencia |
| 5 | ¿La deuda del año anterior bloquea la promoción o solo la matrícula? | No bloquear la promoción por deuda; tratarla como advertencia y regla separada de matrícula |
| 6 | ¿Se reutiliza el mismo apoderado entre años? | Sí. Implementar find-or-create por DNI; no duplicar por año. La tabla puente solo si se necesitan varios apoderados por alumno |
| 7 | ¿Se clonan becas activas al año siguiente? | Solo con confirmación y si están vigentes; no copiar vencidas |
| 8 | ¿Se conserva la sección al promover? | Sí por defecto; permitir cambio justificado en la previsualización |
| 9 | ¿Cómo se pasa de primaria a secundaria? | Configuración explícita por año; si falta, dejar `PENDIENTE`, no adivinar |
| 10 | ¿El alumno egresado puede entrar al portal? | Permitir login con `matricula_activa=false` y vista informativa; acceso histórico read-only en fase posterior |
| 11 | ¿El código de estudiante es permanente o nuevo por año? | Permanente entre años; único por `(codigo, anio)` |
| 12 | ¿El `id_usuario` es uno por alumno para siempre? | Sí; el login y el QR son de la persona, no de la matrícula |
| 13 | ¿Se exigen las 4 actas cerradas o solo algunas? | Configurable; por defecto las 4, con override auditado si dirección lo autoriza |
| 14 | ¿La asistencia es criterio de promoción o solo advertencia? | Configurable; recomendación: advertencia, no exclusión automática |
| 15 | ¿Se genera la matrícula/pre-ticket del año nuevo automáticamente? | Sí, reutilizando el flujo actual; no generar pensiones hasta el pago de matrícula |
| 16 | ¿Se clonan horarios? | No publicar ni clonar automáticamente; generar BORRADOR si se solicita |
| 17 | ¿Qué pasa con un alumno que se retira y vuelve? | Flujo de reingreso: nueva matrícula anual con el mismo usuario, sin duplicar QR |
| 18 | ¿Se conserva el histórico de apoderado si cambia el contacto? | Contacto actual compartido; si se necesita snapshot, agregar tabla de historial después |
| 19 | ¿Quién puede confirmar promociones? | ADMIN; SECRETARÍA solo previsualiza/exporta. Dirección puede aprobar fuera del sistema |
| 20 | ¿Qué se hace si se confirma una promoción por error? | Anular solo si el año destino no tiene actividad; si tiene, reconciliación manual auditada |

---

## 9. Fases de implementación sugeridas (sin ejecutar ahora)

1. **Diseño y validación** con dirección/UGEL de la política de promoción.
2. **Migración** de esquema en base desechable + pruebas de idempotencia.
3. **Autenticación multi-año** y perfil por año.
4. **Rollover** con preview/confirmación y activación de año.
5. **Promoción** con preview, confirmación transaccional y auditoría.
6. **Histórico** en reportes/libretas y ajustes de UI.
7. **Pruebas de regresión** y despliegue controlado.

---

## Anexo A — Consultas y endpoints que deben revisarse

| Lugar | Cambio esperado |
|---|---|
| `autorizacionDao.getContextoUsuario` | Filtrar `alumnos` por año activo |
| `usuarioDao.getAlumnoInfo` | Recibir año y devolver matrícula de ese año |
| `authService.login` / `getPerfil` | Resolver matrícula activa; `matricula_activa` |
| `alumnoDao.findByDni` / `alumnoService.buscarPorDni` | Aceptar `anio`; no usar `LIMIT 1` sin año |
| `alumnoDao.crear` | Reservado para primera matrícula; la promoción/reingreso usan un flujo de continuidad. Implementar find-or-create de apoderado por DNI |
| `alumnoDao.retirar` | Seguir afectando solo la matrícula anual y sus pensiones/pre-tickets |
| `GET /alumnos` | Ya filtra por año; revisar orden y paginación con varias filas |
| `GET /alumnos/dni/:dni` | Añadir `?anio=` y definir default activo |
| `GET /reportes/libreta/:id_alumno` | Mantener `anio`; el `id_alumno` es anual |
| `GET /asistencias/alumno/:id_alumno` | Mantener `anio`; el `id_alumno` es anual |
| `GET /tesoreria/pensiones/alumno/:id_alumno` | Mantener `anio`; no mezclar años |
| `checkAlumnoPropio` | Usar solo `id_alumno` activo del contexto |
| `credenciales_qr` | No duplicar por año; una por usuario |
| Reportes consolidados | Agrupar por `id_usuario`/DNI, no por `id_alumno` |

## Anexo B — Invariantes que deben quedar garantizados

1. Un `usuarios.id_usuario` puede tener como máximo una matrícula por año.
2. Un DNI puede tener como máximo una matrícula por año.
3. Un `codigo_estudiante` puede repetirse entre años, pero no dentro del mismo año.
4. Cada matrícula anual tiene como máximo un expediente.
5. Cada matrícula anual puede tener como máximo una promoción **confirmada**; las
   `ANULADA` no bloquean un reintento.
6. Una matrícula destino no puede ser creada por dos promociones confirmadas.
7. Un egresado o retirado no tiene matrícula destino.
8. Un alumno con actas/notas pendientes no se promueve sin override auditado.
9. No se crean pensiones/pagos/pre-tickets del año nuevo por el simple hecho de
   previsualizar.
10. El año activo es único; el histórico siempre se consulta con año explícito.

---

## Anexo C — Inventario de consultas por DNI/usuario

Esta lista es el **checklist de implementación**. Cualquier consulta que hoy asume “un
alumno por persona” debe resolverse de una de estas dos formas:

- **Operativa:** el backend resuelve la matrícula del **año activo**. El cliente no elige
  el año para acciones actuales.
- **Histórica:** el endpoint exige `?anio=YYYY` o un `id_alumno` anual validado contra ese
  año. No se permite un fallback silencioso a otro año.

Regla transversal: `usuarios.dni` identifica el login; `alumnos.dni` requiere año. Los
JOIN a `alumnos` deben incluir `anio_lectivo` o partir de un `id_alumno` anual ya validado.

| # | Ubicación | Supuesto actual | Regla propuesta |
|---|---|---|---|
| 1 | `alumnoDao.findByDni` | `WHERE a.dni = $1`, devuelve la primera fila | Añadir `anio`. Operativas: año activo; históricas: `?anio`; nunca devolver una fila arbitraria |
| 2 | `alumnoService.crear` | Verifica DNI con `findByDni` sin año | Validar `(dni, anio)`; separar primera matrícula de reingreso/continuidad |
| 3 | `alumnoDao.listar` / `contar` | `anio_lectivo` opcional; el controller default es el activo | Mantener default activo y exigir `?anio` para histórico. No listar dos años mezclados |
| 4 | `alumnoDao.findById` | Por `id_alumno` anual | Aceptar el ID solo si pertenece al año solicitado cuando el endpoint sea histórico |
| 5 | `usuarioDao.getAlumnoInfo` | `WHERE a.id_usuario = $1 LIMIT 1` | Recibir año activo; devolver la matrícula de ese año o `null`; eliminar el `LIMIT 1` ambiguo |
| 6 | `usuarioDao.findByDni` | Login por `usuarios.dni` | Sin cambio: el DNI del usuario es global. No confundir con `alumnos.dni` |
| 7 | `autorizacionDao.getContextoUsuario` | `LEFT JOIN alumnos ... LIMIT 1` | Añadir `AND a.anio_lectivo = $2`; si no hay fila, `id_alumno=NULL` |
| 8 | `authService.login` / `getPerfil` | Llaman a `getAlumnoInfo` sin año | Pasar año activo; devolver `matricula_activa` y grado del año |
| 9 | `authRoles.checkAlumnoPropio` | Compara `req.usuario.id_alumno` | Mantener, pero si el contexto no tiene matrícula activa, responder `403 SIN_MATRICULA_ACTIVA` |
| 10 | `authRoles.checkAlumnoPorDni` | Compara DNI del token / docente sin año | Para DOCENTE, validar DNI + año activo; para ESTUDIANTE, comparar DNI de identidad (no anual) |
| 11 | `autorizacionDao.docenteTieneAlumnoPorDni` | `WHERE a.dni = $1` y carga del docente | Añadir año; evitar que un docente vea matrículas históricas ajenas |
| 12 | `autorizacionDao.docenteTieneAlumno` | Por `id_alumno` anual | Validar también `a.anio_lectivo` de la consulta |
| 13 | `horarioDao.getAlumnoGrado` | `WHERE a.id_usuario = $1 LIMIT 1` | Añadir año activo; sin fila, `404 SIN_MATRICULA_ACTIVA` |
| 14 | `horarioService.miHorario` | Usa `getAlumnoGrado` | Resolver año activo y no mostrar horario de otro año |
| 15 | `gradoDao.listar` / `findById` | `LEFT JOIN alumnos` solo por `id_grado` | Añadir `a.anio_lectivo = g.anio_lectivo`; el `id_grado` ya es anual, pero la intención debe ser explícita |
| 16 | `asistenciaDao.obtenerPorCursoFecha` | Alumnos por `id_grado` y fecha | Añadir `a.anio_lectivo = EXTRACT(YEAR FROM $2::date)`; el grado ya es anual |
| 17 | `asistenciaDao.obtenerPorAlumno` / resumen / estadísticas | `id_alumno` + año en `fecha` | Mantener; el llamador debe pasar el `id_alumno` anual del año consultado |
| 18 | `calificacionDao.obtenerPorCursoGrado` | Alumnos por `id_grado`, sin `a.anio_lectivo` | Añadir `AND a.anio_lectivo = $4`; las notas ya filtran año |
| 19 | `calificacionDao.obtenerPorAlumnoCurso` / notas finales / conclusiones | `id_alumno` + año | Mantener; validar que el `id_alumno` corresponda al año |
| 20 | `notificacionDao.listarDestinatarios` `GRADO` | Filtra `a.anio_lectivo` | Correcto; conservar |
| 21 | `notificacionDao.listarDestinatarios` `ALUMNO` | `a.id_alumno = $1`, sin año | Recibir/validar año; no enviar a una matrícula histórica por accidente |
| 22 | `notificacionService.crearMasivo` | Pasa año solo para `GRADO` | Pasar año también para `ALUMNO`; decidir si `TODOS` excluye sin matrícula activa |
| 23 | `notificacionDao.listarDestinatariosPorIds` | IDs de usuario | Sin cambio, pero la UI debe enviar `id_usuario`, no `id_alumno` anual |
| 24 | `reporteDao.getDashboardEjecutivo` | Alumnos y pagos por año; **pre-tickets sin año** | Filtrar pre-tickets por `a.anio_lectivo` o `c.anio_lectivo`; no sumar años |
| 25 | `reporteDao.getAlumnosRiesgo` | `id_grado` sin `a.anio_lectivo` | Añadir `a.anio_lectivo = $3`; notas ya filtran año |
| 26 | `reporteDao.getCuadroMerito` | `id_grado` sin `a.anio_lectivo` | Añadir `a.anio_lectivo = $3`; notas ya filtran año |
| 27 | `reporteDao.getLibretaAlumno` / PDF | `id_alumno` sin validar año del alumno | Añadir validación `a.anio_lectivo = $3`; el PDF usa la matrícula anual |
| 28 | `reporteDao.getResumenAsistenciaGrado` | `id_grado` sin `a.anio_lectivo` | Añadir `a.anio_lectivo = $2`; la asistencia ya usa `EXTRACT` |
| 29 | `reporteDao.getAuditoriaDocentes` | Filtra año | Correcto; conservar |
| 30 | `siagieDao.obtenerNotasParaSIAGIE` | Filtra año y agrupa por DNI | Correcto dentro de un año; no reutilizar el mismo grupo para otro año |
| 31 | `tesoreriaDao.listarPreTickets` | Sin filtro de año | Añadir `?anio` y filtrar por `a.anio_lectivo` o `c.anio_lectivo`; crítico para la bandeja |
| 32 | `tesoreriaDao.findPreTicketById` | Por ID anual | Correcto, pero validar año si el endpoint es histórico |
| 33 | `tesoreriaDao.listarPagos` | Sin filtro de año | Añadir `?anio` para listados operativos/históricos; `findPagoById` sigue por ID anual |
| 34 | `tesoreriaDao.listarBecas` | Sin filtro de año | Añadir `?anio` o filtrar por la matrícula anual; no mezclar becas de años |
| 35 | `tesoreriaDao.generarPensionesAlumno` | Usa `id_alumno` y su año | Correcto; validar que la matrícula sea del año y esté `Matriculado` |
| 36 | `tesoreriaDao.generarPensionesMensuales` | Filtra `a.anio_lectivo` | Correcto; conservar |
| 37 | `secretaria-dashboard` (`pre-tickets`) | `GET /tesoreria/pre-tickets?estado=PENDIENTE` sin año | Enviar `?anio` desde `ConfiguracionService`; backend default activo |
| 38 | Tesorería UI (`secretaria-tesoreria`) | `/alumnos?anio` y `/pensiones?anio`, pero pre-tickets sin año | Añadir año a pre-tickets y becas; no mostrar deuda de otro año |
| 39 | Dashboard admin | `/alumnos?search...` default activo | Enviar `anio` explícito y revisar pre-tickets del KPI |
| 40 | Docente ficha (`docente-ficha`) | `GET /alumnos/dni/:dni` sin año | Enviar `?anio` desde `ConfiguracionService`; el endpoint debe aceptarlo |
| 41 | Portal estudiante | Usa `info_adicional.id_alumno` | Mantener; si `matricula_activa=false`, no consultar notas/asistencia/horario |
| 42 | PDFs de libreta/boleta/acta | Usan el `id_alumno`/acta de un año | Correcto si el llamador resolvió ese año; no regenerar históricos con datos actuales |
| 43 | `auditoriaDao` / actas | Filtra `anio_lectivo` | Correcto; conservar |
| 44 | `reporteDao.getDashboardEjecutivo` / notificaciones `TODOS` | Pueden incluir usuarios sin matrícula activa | Decidir política: `TODOS` es identidad; para alumnos usar año activo |

**Nota sobre asistencia:** `asistencia_alumnos` no tiene `anio_lectivo`. En Fase 6.0 se
mantiene `EXTRACT(YEAR FROM fecha)` y la separación por `id_alumno` anual; no se agrega
columna. Si en el futuro se necesita una columna, debe ser generada/backfill y no cambiar
la regla de negocio.

**Implementación recomendada:** centralizar dos helpers en backend:

```text
resolverAnio(req)                 -> ?anio explícito o año activo
resolverMatricula(id_usuario,anio) -> fila anual o null
```

Ningún DAO debe repetir `LEFT JOIN alumnos ... LIMIT 1` sin año. Toda consulta que reciba
`id_alumno` desde la URL debe validar que ese `id_alumno` pertenece al año solicitado
cuando el endpoint sea histórico.
