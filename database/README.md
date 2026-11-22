# Base de Datos SIGA-UC

Base de datos PostgreSQL 18 del Sistema Integrado de Gestión Académica de la
I.E.P. Unión Científica.

## Dos escenarios de instalación

### A. Desarrollo / demostración

`siga_uc_completo.sql` es un **dump completo**: crea el esquema (40 tablas) y, tras aplicar
la migración H49, queda en **41 tablas base** (42 en local con `horarios_h47_backup`), funciones,
triggers, índices y carga los **datos ficticios de demostración** (21 alumnos, apoderados,
pagos y pensiones de ejemplo). **Nunca debe usarse como base de producción.**

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
```

> **H49:** antes de ejecutar la migración, editar `_param_anio` en
> `migracion_h49_multianio_base.sql` al año de la instalación (`2027` en este ejemplo;
> `2026` en la demo).

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

## Archivos

| Archivo | Uso |
|---|---|
| `siga_uc_completo.sql` | **Solo desarrollo/demo**: esquema + datos ficticios + funciones/índices. No usar en producción. |
| `siga_uc.sql` | **Esquema base** (40 tablas, sin datos); H49 lo lleva a 41. Primer paso de una instalación de producción. |
| `seed_produccion.sql` | **Catálogos y configuración** para producción + admin inicial. Requiere `-v anio_lectivo=YYYY -v admin_password=...`. |
| `migracion_*.sql` | Parches **idempotentes** para bases existentes. Se aplican en orden después del esquema o de la migración anterior. |
| `migracion_h32_anulacion_pagos.sql` | Añade campos de anulación en `pagos` y `ANULADO` en `boletas_electronicas`. |
| `migracion_h10_h38_concurrencia_pagos.sql` | Crea `UNIQUE (serie, numero)` y `ux_pago_pension_activo` si no hay duplicados; avisa y omite el índice si los hay. |
| `migracion_h07_auditoria.sql` | Índices `ix_bitacora_fecha` e `ix_bitacora_usuario` para la bitácora. |
| `migracion_h45_pensiones_anuladas.sql` | Añade `ANULADO` al CHECK de `pensiones` y regulariza deuda futura de alumnos ya retirados. |
| `migracion_h47_horarios.sql` | Crea `periodos_clase`, reemplaza `horarios` por el modelo con `id_carga`/período/estado, migra las filas antiguas a `horarios_h47_backup` y agrega restricciones y triggers. |
| `migracion_h48_actas.sql` | Agrega `bimestre`, reapertura y unicidad por año/bimestre/grado a `actas_bimestrales`; backfill de bimestre y aborto ante vacíos/duplicados. Idempotente. |
| `migracion_h61_dia_semana.sql` | Solo datos: normaliza `asistencia_alumnos.dia_semana` a español y lo alinea con `fecha`. Idempotente; no cambia el esquema. |
| `migracion_h49_multianio_base.sql` | Crea `anios_lectivos`, agrega `grados.orden` y reemplaza los UNIQUE globales de `alumnos` por UNIQUE por año. No crea promociones ni clona oferta. Se pega completo en SQL Editor (sin variables psql). Idempotente. |
| `rollback_h49_multianio_base.sql` | Solo para base desechable: restaura los UNIQUE globales y elimina `anios_lectivos`/`grados.orden`. Aborta si hay varias matrículas por persona o promociones con filas. |
| `preparar_anio_lectivo.sql` | Utilidad **parcial** e histórica: solo copia conceptos `MATRICULA`/`PENSION` y períodos. No crea grados, carga ni tutores; no es el rollover de 6.2. |
| `siga_uc_backup.sql` | Backup local con datos. Ignorado por Git; no se usa para instalar. |

## Verificación

```sql
-- 41 tablas base (después de H49; 42 en local con horarios_h47_backup)
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
npm run test:integridad   # 14 invariantes; debe dar 14 PASS en una base de producción limpia
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
