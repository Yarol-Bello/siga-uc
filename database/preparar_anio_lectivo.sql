-- ============================================================
-- Preparar conceptos de pago para un nuevo año lectivo
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Uso:
--   psql -U postgres -d siga_uc -v anio=2027 -f database/preparar_anio_lectivo.sql
--
-- Copia los conceptos MATRICULA y PENSION del año anterior al nuevo año.
-- Es idempotente: compara por nombre + año y no duplica filas.
-- No actualiza ni elimina datos históricos.
-- ============================================================

BEGIN;

INSERT INTO public.conceptos_pago (
  nombre,
  monto_base,
  tipo,
  mes,
  anio_lectivo
)
SELECT
  replace(c.nombre, c.anio_lectivo::text, (:anio)::text) AS nombre,
  c.monto_base,
  c.tipo,
  c.mes,
  (:anio)::int AS anio_lectivo
FROM public.conceptos_pago c
WHERE c.anio_lectivo = (:anio)::int - 1
  AND c.tipo IN ('MATRICULA', 'PENSION')
  AND NOT EXISTS (
    SELECT 1
    FROM public.conceptos_pago x
    WHERE x.anio_lectivo = (:anio)::int
      AND x.nombre = replace(c.nombre, c.anio_lectivo::text, (:anio)::text)
  );

COMMIT;
