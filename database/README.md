# Base de Datos SIGA-UC

Base de datos PostgreSQL 18 del Sistema Integrado de Gestión Académica de la
I.E.P. Unión Científica.

## Dos escenarios de instalación

### A. Desarrollo / demostración

`siga_uc_completo.sql` es un **dump completo**: crea el esquema (40 tablas) y, tras aplicar
las migraciones H49, H73 y H74–H80, queda en **48 tablas base** (49 en local con
`horarios_h47_backup`), funciones, triggers, índices y carga los **datos ficticios de
demostración** (21 alumnos, apoderados, pagos y pensiones de ejemplo). **Nunca debe usarse
como base de producción.**

```powershell
createdb -U postgres siga_uc
psql -U postgres -d siga_uc -f database/siga_uc_completo.sql
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
psql -U postgres -d siga_uc -f database/migracion_h74_configuracion_base.sql
psql -U postgres -d siga_uc -f database/migracion_h75_tarifas.sql
psql -U postgres -d siga_uc -f database/migracion_h76_academico.sql
psql -U postgres -d siga_uc -f database/migracion_h77_horario_jornada.sql
psql -U postgres -d siga_uc -f database/migracion_h78_becas.sql
psql -U postgres -d siga_uc -f database/migracion_h79_setup_inicial.sql
psql -U postgres -d siga_uc -f database/migracion_h80_conclusiones_estructuradas.sql
psql -U postgres -d siga_uc -f database/migracion_h81_rendimiento_paginacion.sql
# ...y las migraciones futuras, en orden.
```

### B. Producción (base nueva, sin datos ficticios)

La base de producción se construye con **esquema + seed de catálogos + migraciones**:

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
psql -U postgres -d siga_uc -f database/migracion_h74_configuracion_base.sql
psql -U postgres -d siga_uc -f database/migracion_h75_tarifas.sql
psql -U postgres -d siga_uc -f database/migracion_h76_academico.sql
psql -U postgres -d siga_uc -f database/migracion_h77_horario_jornada.sql
psql -U postgres -d siga_uc -f database/migracion_h78_becas.sql
psql -U postgres -d siga_uc -f database/migracion_h79_setup_inicial.sql
psql -U postgres -d siga_uc -f database/migracion_h80_conclusiones_estructuradas.sql
psql -U postgres -d siga_uc -f database/migracion_h81_rendimiento_paginacion.sql
```

> **H49:** antes de ejecutar la migración, editar `_param_anio` en
> `migracion_h49_multianio_base.sql` al año de la instalación (`2027` en este ejemplo;
> `2026` en la demo).
>
> **H73:** aplicar **después** de H49. Crea `politicas_promocion` y `promociones`; es
> idempotente y se pega completo en el SQL Editor. No se aplica en Supabase sin backup y
> autorización.

`seed_produccion.sql` crea únicamente catálogos y configuración: 4 roles, 5 grados, 11 cursos,
29 competencias, escala AD/A/B/C, 11 conceptos de pago del año indicado, carga curricular
inicial, una caja principal y **un único usuario ADMIN** con `requiere_cambio_password = TRUE`.
No crea alumnos, apoderados, pagos, pensiones, calificaciones, asistencias, movimientos de
caja, bitácora ni becas.

- El DNI del administrador inicial es `74829102`.
- La contraseña se pasa con `-v admin_password`; si falta o está vacía, el script aborta.
- El año se pasa con `-v anio_lectivo=YYYY` (si falta, aborta). Ese valor se usa en grados,
  conceptos, carga y períodos.
- El admin debe cambiarla en el primer inicio de sesión.
- El seed es idempotente: se puede volver a ejecutar sin duplicar catálogos.
- La carga curricular inicial se asigna al administrador porque `id_personal` es NOT NULL;
  al crear docentes reales, reasignarla desde el módulo correspondiente.

> **No mezclar los escenarios.** `siga_uc.sql` y `siga_uc_completo.sql` son excluyentes:
> el dump completo ya trae esquema y datos de demo. Cargar ambos duplica objetos. El dump
> de demo **no** debe usarse en producción porque contiene 21 alumnos ficticios y más de
> 140 pensiones marcadas `PAGADO` sin un pago que las respalde (144 medidas por
> `test:integridad` en la base local).
>
> **Entrega al cliente sin admin:** si se omite `seed_produccion.sql` y solo se aplican
> esquema + migraciones H32…H79, el backend habilita `/setup` con `SETUP_TOKEN` y crea el
> primer ADMIN, institución, año, grados y caja. Es la ruta recomendada para una instalación
> nueva. El seed técnico queda para demo/pruebas.

## Archivos

| Archivo | Uso |
|---|---|
| `siga_uc_completo.sql` | **Solo desarrollo/demo**: esquema + datos ficticios + funciones/índices. No usar en producción. |
| `siga_uc.sql` | **Esquema base** (40 tablas, sin datos); H49/H73/H74/H76/H78 lo llevan a 48. Primer paso de una instalación de producción. |
| `seed_produccion.sql` | **Catálogos y configuración** para producción + admin inicial. Requiere `-v anio_lectivo=YYYY -v admin_password=...`. |
| `demo_reset_seed_v2.sql` | **Solo demo**: limpia alumnos, pagos, pensiones, notas y usuarios ESTUDIANTE para volver a ejecutar `npm run uat:seed`. Conserva catálogos, configuración, personal y carga. |
| `migracion_*.sql` | Parches **idempotentes** para bases existentes. Se aplican en orden después del esquema o de la migración anterior. |
| `migracion_h32_anulacion_pagos.sql` | Añade campos de anulación en `pagos` y `ANULADO` en `boletas_electronicas`. |
| `migracion_h10_h38_concurrencia_pagos.sql` | Crea `UNIQUE (serie, numero)` y `ux_pago_pension_activo` si no hay duplicados; avisa y omite el índice si los hay. |
| `migracion_h07_auditoria.sql` | Índices `ix_bitacora_fecha` e `ix_bitacora_usuario` para la bitácora. |
| `migracion_h45_pensiones_anuladas.sql` | Añade `ANULADO` al CHECK de `pensiones` y regulariza deuda futura de alumnos ya retirados. |
| `migracion_h47_horarios.sql` | Crea `periodos_clase`, reemplaza `horarios` por el modelo con `id_carga`/período/estado, migra las filas antiguas a `horarios_h47_backup` y agrega restricciones y triggers. |
| `migracion_h48_actas.sql` | Agrega `bimestre`, reapertura y unicidad por año/bimestre/grado a `actas_bimestrales`; backfill de bimestre y aborto ante vacíos/duplicados. Idempotente. |
| `migracion_h61_dia_semana.sql` | Solo datos: normaliza `asistencia_alumnos.dia_semana` a español y lo alinea con `fecha`. Idempotente; no cambia el esquema. |
| `migracion_h49_multianio_base.sql` | Crea `anios_lectivos`, agrega `grados.orden` y reemplaza los UNIQUE globales de `alumnos` por UNIQUE por año. No crea promociones ni clona oferta. Se pega completo en SQL Editor (sin variables psql). Idempotente. |
| `migracion_h73_promociones.sql` | Crea `politicas_promocion` y `promociones` (H73/6.3). Requiere H49. Idempotente; no agrega `TRASLADADO` ni toca el CHECK de alumnos. |
| `migracion_h59_observaciones_personal.sql` | Agrega `personal.observaciones` (H59). Idempotente; no cambia el número de tablas. |
| `migracion_h71_retirados_historicos.sql` | Backfill H71: congela el expediente de los alumnos `Retirado` y desactiva al usuario solo si no conserva otra matrícula no retirada. Idempotente; no toca alumnos no retirados. |
| `migracion_h74_configuracion_base.sql` | Crea `configuracion_institucional` (una fila), `configuracion_anio` (una por año), el trigger que crea la configuración de años nuevos y `bitacora_auditoria.motivo`. Requiere H49; toma la jornada de `periodos_clase` si H47 está aplicada. Idempotente; no toca tarifas, cursos, becas ni horarios. |
| `migracion_h75_tarifas.sql` | Amplía `conceptos_pago` con nivel, grado, vigencia, estado y orden; crea `resolver_concepto_pago` y respalda `id_concepto` en pensiones/pre-tickets. Requiere H74. Idempotente. |
| `migracion_h76_academico.sql` | Crea `areas_academicas` y agrega activo/orden/timestamps a cursos, competencias y carga curricular. Requiere H74. Idempotente. |
| `migracion_h77_horario_jornada.sql` | Amplía los días válidos a lunes–domingo y valida períodos contra la jornada y la duración mínima configuradas. Requiere H47 y H74. Idempotente. |
| `migracion_h78_becas.sql` | Crea `tipos_beca` y `aplicaciones_beca`, amplía `becas` y `pre_tickets.descuento`, y agrega `EXONERADO` a pensión/pre-ticket. Requiere H74 y H75. Idempotente. |
| `migracion_h79_setup_inicial.sql` | Agrega `setup_completado`, fecha y admin a `configuracion_institucional`; marca completas las instalaciones con ADMIN. Requiere H74 y H49. Idempotente. |
| `migracion_h80_conclusiones_estructuradas.sql` | Agrega nivel, avance, dificultad, sugerencia, estado y auditoría a conclusiones; código/hash/detalle a exportaciones SIAGIE. Requiere H48. Idempotente. |
| `migracion_h81_rendimiento_paginacion.sql` | Índices para pensiones por año/alumno/mes, pagos por fecha, alumnos por año/grado, personal/usuarios y pre-tickets. No crea tablas ni cambia datos. Idempotente. |
| `rollback_h73_promociones.sql` | Solo base desechable: elimina `promociones` y `politicas_promocion`. En producción se restaura el backup. |
| `rollback_h49_multianio_base.sql` | Solo para base desechable: restaura los UNIQUE globales y elimina `anios_lectivos`/`grados.orden`. Aborta si hay varias matrículas por persona o promociones con filas. |
| `preparar_anio_lectivo.sql` | Utilidad **histórica y parcial**: solo copia conceptos `MATRICULA`/`PENSION` y períodos. No crea grados, carga ni tutores. La reemplaza la pantalla ADMIN de 6.2 (años lectivos y rollover). |
| `siga_uc_backup.sql` | Backup local con datos. Ignorado por Git; no se usa para instalar. |

## Verificación

```sql
-- 48 tablas base (después de H49, H73, H74, H76 y H78; 49 en local con horarios_h47_backup)
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Índice de doble pago (si no había duplicados históricos)
SELECT indexname FROM pg_indexes
WHERE indexname = 'ux_pago_pension_activo';

-- Producción recién sembrada: 1 usuario y cero datos operativos
SELECT
  (SELECT COUNT(*) FROM usuarios) AS usuarios,
  (SELECT COUNT(*) FROM alumnos) AS alumnos,
  (SELECT COUNT(*) FROM pagos) AS pagos,
  (SELECT COUNT(*) FROM pensiones) AS pensiones;
```

Además, desde `siga-uc-backend`:

```powershell
npm run test:integridad   # 21 invariantes; debe dar 21 PASS en una base de producción limpia
```

## Migraciones sobre una base existente

1. Hacer backup: `cd siga-uc-backend && npm run backup`.
2. Ejecutar solo las migraciones pendientes, en orden.
3. Verificar que no queden objetos duplicados ni errores.

Las migraciones no eliminan datos ni vuelven a crear el esquema. **Excepción H47:**
reemplaza la tabla `horarios` después de copiar sus filas a `horarios_h47_backup`; revise
ese respaldo antes de eliminarlo.

**H49 (multi-año base)** se puede pegar completo en el SQL Editor de Supabase porque no usa
variables `psql`: crea una tabla temporal `_param_anio` (2026 por defecto; **editar al año de
la instalación**, 2027 en producción), marca ese año como
`ACTIVO` solo si no hay otro y usa `current_setting`. Es idempotente y no crea promociones ni
clona oferta. Aplicarla solo con backup previo y ventana sin usuarios.

**H71 (retirados históricos)** se aplica después de H49 y H59. Es un backfill de datos:
no crea tablas. En local corrige la inconsistencia de alumnos `Retirado` con usuario
`ACTIVO` o expediente sin congelar. En Supabase demo no se aplicó porque no hay alumnos
retirados; aplicar antes de cargar datos reales o al detectar el invariante 21 en
`test:integridad`.

**Fase 6.2 (rollover) no agrega una migración.** Se opera desde la pantalla ADMIN
`/admin/anios-lectivos` después de aplicar H49: preview, confirmación idempotente, activación
auditada y reversión. El script `preparar_anio_lectivo.sql` queda como utilidad histórica y
no reemplaza al rollover (no copia grados, carga ni tutores).
`rollback_h49_multianio_base.sql` es **exclusivo de bases desechables**; no ejecutarlo en
producción.

## Tecnología

| Componente | Versión |
|---|---|
| PostgreSQL | 18.4 |
| Encoding | UTF8 |
| Zona horaria | America/Lima |
| Extensiones | `pgcrypto`, `unaccent`, `uuid-ossp` |

Los usuarios y contraseñas de ejemplo están en `docs/CREDENCIALES.md` y solo
aplican a bases de demostración. En producción no se cargan: el único usuario inicial
es el admin creado por `seed_produccion.sql`, con contraseña temporal y cambio obligatorio.
