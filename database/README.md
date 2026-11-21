# Base de Datos SIGA-UC

Base de datos PostgreSQL 18 del Sistema Integrado de Gestión Académica de la
I.E.P. Unión Científica.

## Instalación nueva (secuencia oficial)

`database/siga_uc_completo.sql` es un **dump completo**: crea el esquema (39 tablas),
funciones, triggers, índices y carga los datos de ejemplo. **No se carga junto con
`siga_uc.sql`.**

```powershell
# Windows / PowerShell
createdb -U postgres siga_uc

psql -U postgres -d siga_uc -f database/siga_uc_completo.sql
psql -U postgres -d siga_uc -f database/migracion_h32_anulacion_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h10_h38_concurrencia_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h07_auditoria.sql
# ...y las migraciones futuras, en orden.
```

```bash
# Linux / macOS
createdb -U postgres siga_uc

psql -U postgres -d siga_uc -f database/siga_uc_completo.sql
psql -U postgres -d siga_uc -f database/migracion_h32_anulacion_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h10_h38_concurrencia_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h07_auditoria.sql
```

> Ejecutar `siga_uc.sql` antes del completo **falla**: el dump vuelve a crear
> `calcular_nota_final_area`, triggers e índices que ya existirían.

## Archivos

| Archivo | Uso |
|---|---|
| `siga_uc_completo.sql` | **Instalación completa**: esquema + datos de ejemplo + funciones/índices. Es el archivo que se carga en una BD nueva. |
| `siga_uc.sql` | **Referencia de esquema** (39 tablas, sin datos). Sirve para consultar/versionar la estructura; **no se carga junto con el completo**. |
| `migracion_*.sql` | Parches **idempotentes** para bases existentes. Se aplican en orden después del dump o de la migración anterior. |
| `migracion_h32_anulacion_pagos.sql` | Añade campos de anulación en `pagos` y `ANULADO` en `boletas_electronicas`. |
| `migracion_h10_h38_concurrencia_pagos.sql` | Crea `UNIQUE (serie, numero)` y `ux_pago_pension_activo` si no hay duplicados; avisa y omite el índice si los hay. |
| `migracion_h07_auditoria.sql` | Índices `ix_bitacora_fecha` e `ix_bitacora_usuario` para la bitácora. |
| `fix_tesoreria_pagos.sql` | **Histórico**: corrige el trigger de caja y genera pre-tickets de matrícula. Ya está incorporado en `siga_uc_completo.sql`; no se ejecuta en instalaciones nuevas. |
| `preparar_anio_lectivo.sql` | Utilidad idempotente para copiar conceptos `MATRICULA`/`PENSION` a un año nuevo (`-v anio=2027`). |
| `siga_uc_backup.sql` | Backup local con datos. Ignorado por Git; no se usa para instalar. |

## Verificación

```sql
-- 39 tablas
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Índice de doble pago (si no había duplicados históricos)
SELECT indexname FROM pg_indexes
WHERE indexname = 'ux_pago_pension_activo';
```

## Migraciones sobre una base existente

1. Hacer backup: `cd siga-uc-backend && npm run backup`.
2. Ejecutar solo las migraciones pendientes, en orden.
3. Verificar que no queden objetos duplicados ni errores.

Las migraciones no eliminan datos ni vuelven a crear el esquema.

## Tecnología

| Componente | Versión |
|---|---|
| PostgreSQL | 18.4 |
| Encoding | UTF8 |
| Zona horaria | America/Lima |
| Extensiones | `pgcrypto`, `unaccent`, `uuid-ossp` |

Los usuarios y contraseñas de ejemplo están en `docs/CREDENCIALES.md` y solo
aplican a bases de demostración.
