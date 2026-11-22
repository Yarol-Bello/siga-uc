-- ============================================================
-- H48 — Actas reales: bimestre, reapertura y unicidad
-- SIGA-UC
--
-- Idempotente. Se puede ejecutar dos veces sobre la misma base.
-- No modifica el algoritmo del hash de integridad.
--
-- Uso:
--   psql -U postgres -d siga_uc -f database/migracion_h48_actas.sql
--
-- La migración:
--   1. Agrega bimestre, reabierto_por, fecha_reapertura y motivo_reapertura.
--   2. Deriva bimestre desde periodo con las variantes 1er/1ro/I, 2do/2°/II,
--      3er/3ro/III y 4to/4°/IV. Aborta si queda alguna fila sin bimestre.
--   3. Exige bimestre 1-4.
--   4. Agrega la FK de reabierto_por.
--   5. Aborta si hay duplicados (año, bimestre, grado) antes de crear el índice.
--   6. Crea el índice único con NULLS NOT DISTINCT para que el acta global
--      (id_grado NULL) también sea única por año/bimestre.
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. Columnas nuevas
ALTER TABLE actas_bimestrales
  ADD COLUMN IF NOT EXISTS bimestre integer;

ALTER TABLE actas_bimestrales
  ADD COLUMN IF NOT EXISTS reabierto_por integer;

ALTER TABLE actas_bimestrales
  ADD COLUMN IF NOT EXISTS fecha_reapertura timestamp without time zone;

ALTER TABLE actas_bimestrales
  ADD COLUMN IF NOT EXISTS motivo_reapertura varchar(250);

-- 2. Backfill de bimestre desde periodo
UPDATE actas_bimestrales
SET bimestre = CASE
  WHEN periodo ~* '(^|[^a-z0-9])(4to|4°|iv)[[:space:]]*bimestre' THEN 4
  WHEN periodo ~* '(^|[^a-z0-9])(3er|3ro|3°|iii)[[:space:]]*bimestre' THEN 3
  WHEN periodo ~* '(^|[^a-z0-9])(2do|2°|ii)[[:space:]]*bimestre' THEN 2
  WHEN periodo ~* '(^|[^a-z0-9])(1er|1ro|1°|i)[[:space:]]*bimestre' THEN 1
  ELSE NULL
END
WHERE bimestre IS NULL;

DO $$
DECLARE
  v_pendientes text;
BEGIN
  SELECT string_agg(
           id_acta || ' ("' || periodo || '")',
           ', ' ORDER BY id_acta
         )
    INTO v_pendientes
    FROM actas_bimestrales
   WHERE bimestre IS NULL;

  IF v_pendientes IS NOT NULL THEN
    RAISE EXCEPTION
      'H48: no se pudo derivar el bimestre de estas actas: %',
      v_pendientes;
  END IF;
END $$;

-- 3. Bimestre obligatorio y válido
ALTER TABLE actas_bimestrales
  ALTER COLUMN bimestre SET NOT NULL;

ALTER TABLE actas_bimestrales
  DROP CONSTRAINT IF EXISTS chk_acta_bimestre;

ALTER TABLE actas_bimestrales
  ADD CONSTRAINT chk_acta_bimestre CHECK (bimestre BETWEEN 1 AND 4);

-- 4. FK de reapertura
ALTER TABLE actas_bimestrales
  DROP CONSTRAINT IF EXISTS actas_bimestrales_reabierto_por_fkey;

ALTER TABLE actas_bimestrales
  ADD CONSTRAINT actas_bimestrales_reabierto_por_fkey
  FOREIGN KEY (reabierto_por) REFERENCES usuarios(id_usuario)
  ON DELETE SET NULL;

-- 5. Duplicados antes del índice único
DO $$
DECLARE
  v_duplicados text;
BEGIN
  SELECT string_agg(
           anio_lectivo || '/' || bimestre || '/grado=' ||
           COALESCE(id_grado::text, 'NULL') || ' (' || total || ' filas)',
           ', ' ORDER BY anio_lectivo, bimestre, id_grado NULLS FIRST
         )
    INTO v_duplicados
    FROM (
      SELECT anio_lectivo, bimestre, id_grado, COUNT(*) AS total
        FROM actas_bimestrales
       GROUP BY anio_lectivo, bimestre, id_grado
      HAVING COUNT(*) > 1
    ) d;

  IF v_duplicados IS NOT NULL THEN
    RAISE EXCEPTION
      'H48: hay actas duplicadas por (año, bimestre, grado): %',
      v_duplicados;
  END IF;
END $$;

-- 6. Unicidad por año/bimestre/grado, incluyendo el acta global (NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_acta_anio_bimestre_grado
  ON actas_bimestrales (anio_lectivo, bimestre, id_grado)
  NULLS NOT DISTINCT;

COMMIT;

\echo 'H48 aplicado: bimestre, reapertura y unicidad de actas.'
