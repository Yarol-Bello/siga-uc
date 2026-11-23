-- ============================================================
-- Rollback H59 — Observaciones de cese del personal
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- SOLO para bases desechables o con backup verificado.
-- Elimina la columna y, con ella, las observaciones de cese guardadas.
-- NO ejecutar en Supabase ni en producción sin autorización.
-- ============================================================

BEGIN;

ALTER TABLE public.personal
  DROP COLUMN IF EXISTS observaciones;

COMMIT;
