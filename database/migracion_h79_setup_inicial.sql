-- ============================================================
-- H79 / Fase 7 — Primera configuración del sistema
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Marca si el sistema ya fue inicializado. Mientras esté pendiente,
-- el frontend muestra el asistente /setup y bloquea el login.
-- Requiere H74 (configuración institucional), H49 (años lectivos)
-- y usuarios/roles. Idempotente.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.configuracion_institucional') IS NULL THEN
    RAISE EXCEPTION 'H79 requiere H74: falta configuracion_institucional';
  END IF;
  IF to_regclass('public.anios_lectivos') IS NULL THEN
    RAISE EXCEPTION 'H79 requiere H49: falta anios_lectivos';
  END IF;
  IF to_regclass('public.usuarios') IS NULL THEN
    RAISE EXCEPTION 'H79 requiere la tabla usuarios';
  END IF;
END $$;

ALTER TABLE public.configuracion_institucional
  ADD COLUMN IF NOT EXISTS setup_completado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_completado_en timestamp,
  ADD COLUMN IF NOT EXISTS setup_completado_por integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_configuracion_setup_por'
      AND conrelid = 'public.configuracion_institucional'::regclass
  ) THEN
    ALTER TABLE public.configuracion_institucional
      ADD CONSTRAINT fk_configuracion_setup_por
      FOREIGN KEY (setup_completado_por)
      REFERENCES public.usuarios(id_usuario)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Instalaciones existentes con algún ADMIN ya están inicializadas.
UPDATE public.configuracion_institucional c
SET setup_completado = true,
    setup_completado_en = COALESCE(c.setup_completado_en, now()),
    setup_completado_por = COALESCE(
      c.setup_completado_por,
      (
        SELECT u.id_usuario
        FROM public.usuarios u
        INNER JOIN public.roles r ON r.id_rol = u.id_rol
        WHERE r.nombre_rol = 'ADMIN'
        ORDER BY u.id_usuario
        LIMIT 1
      )
    )
WHERE c.setup_completado = false
  AND EXISTS (
    SELECT 1
    FROM public.usuarios u
    INNER JOIN public.roles r ON r.id_rol = u.id_rol
    WHERE r.nombre_rol = 'ADMIN'
  );

COMMENT ON COLUMN public.configuracion_institucional.setup_completado IS
  'TRUE cuando el asistente de primera configuración ya creó el admin inicial.';
COMMENT ON COLUMN public.configuracion_institucional.setup_completado_en IS
  'Fecha y hora en que se completó la primera configuración.';
COMMENT ON COLUMN public.configuracion_institucional.setup_completado_por IS
  'Administrador que completó la primera configuración.';

COMMIT;

\echo 'H79 aplicada: primera configuración del sistema habilitada.'
