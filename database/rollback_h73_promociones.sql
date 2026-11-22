-- ============================================================
-- Rollback H73 — SOLO PARA BASES DESECHABLES
-- Elimina promociones y políticas de promoción.
--
-- NO ejecutar en Supabase ni en una base con datos reales.
-- En producción se restaura el backup previo.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS public.promociones;
DROP TABLE IF EXISTS public.politicas_promocion;

COMMIT;
