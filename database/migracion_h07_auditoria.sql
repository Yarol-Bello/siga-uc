-- ============================================================
-- H07 — Infraestructura de auditoría
-- Índices para consultas por fecha y por usuario.
-- Idempotente.
-- ============================================================

BEGIN;

CREATE INDEX IF NOT EXISTS ix_bitacora_fecha
  ON public.bitacora_auditoria (fecha_hora DESC);

CREATE INDEX IF NOT EXISTS ix_bitacora_usuario
  ON public.bitacora_auditoria (id_usuario, fecha_hora DESC);

COMMIT;
