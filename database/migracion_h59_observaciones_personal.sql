-- ============================================================
-- H59 / Fase 7 — Observaciones de cese del personal
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Agrega `personal.observaciones` para no perder el texto que el ADMIN
-- escribe al registrar un cese. Es idempotente.
--
-- EJECUCIÓN:
--   psql -U postgres -d siga_uc -f database/migracion_h59_observaciones_personal.sql
--
-- No modifica datos existentes. Las observaciones quedan NULL hasta el
-- siguiente cese. Aplicar ANTES de desplegar el código que las lee.
-- ============================================================

BEGIN;

ALTER TABLE public.personal
  ADD COLUMN IF NOT EXISTS observaciones text;

COMMENT ON COLUMN public.personal.observaciones IS
  'Sustento o detalle del cese registrado por el ADMIN (H59).';

COMMIT;
