-- ============================================================
-- H32 — Anulación de pagos
-- Migración idempotente para bases existentes.
-- No vuelve a crear el esquema ni toca datos.
-- ============================================================

BEGIN;

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS motivo_anulacion varchar(250);

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS fecha_anulacion timestamp without time zone;

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS id_usuario_anulacion integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pagos_id_usuario_anulacion_fkey'
      AND conrelid = 'public.pagos'::regclass
  ) THEN
    ALTER TABLE public.pagos
      ADD CONSTRAINT pagos_id_usuario_anulacion_fkey
      FOREIGN KEY (id_usuario_anulacion)
      REFERENCES public.usuarios(id_usuario)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.boletas_electronicas
  DROP CONSTRAINT IF EXISTS chk_boleta_estado;

ALTER TABLE public.boletas_electronicas
  ADD CONSTRAINT chk_boleta_estado
  CHECK (
    estado_sunat IS NULL OR
    estado_sunat::text = ANY (
      ARRAY['ACEPTADO', 'PENDIENTE', 'RECHAZADO', 'ANULADO']::text[]
    )
  );

COMMIT;
