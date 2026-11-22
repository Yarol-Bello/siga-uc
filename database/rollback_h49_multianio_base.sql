-- ============================================================
-- Rollback H49 / Fase 6.1 — SOLO BASE DESECHABLE
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Este rollback NO debe ejecutarse en Supabase. En Supabase, el rollback
-- real es restaurar el backup previo a la migración.
--
-- Aborta si existen varias matrículas del mismo DNI, id_usuario o código
-- entre años, porque los UNIQUE globales no podrían restaurarse sin perder
-- o fusionar datos. También aborta si hay promociones con filas.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_dni text;
  v_usuario integer;
  v_codigo text;
  v_filas integer;
BEGIN
  SELECT dni INTO v_dni
  FROM public.alumnos
  GROUP BY dni
  HAVING COUNT(*) > 1
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Rollback H49: el DNI % tiene varias matrículas; no se puede restaurar el UNIQUE global.', v_dni;
  END IF;

  SELECT id_usuario INTO v_usuario
  FROM public.alumnos
  GROUP BY id_usuario
  HAVING COUNT(*) > 1
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Rollback H49: el id_usuario % tiene varias matrículas; no se puede restaurar el UNIQUE global.', v_usuario;
  END IF;

  SELECT codigo_estudiante INTO v_codigo
  FROM public.alumnos
  WHERE codigo_estudiante IS NOT NULL
  GROUP BY codigo_estudiante
  HAVING COUNT(*) > 1
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Rollback H49: el código % tiene varias matrículas; no se puede restaurar el UNIQUE global.', v_codigo;
  END IF;

  IF to_regclass('public.promociones') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.promociones' INTO v_filas;
    IF v_filas > 0 THEN
      RAISE EXCEPTION 'Rollback H49: existen % promoción(es); no se puede revertir 6.1 sin resolver 6.3.', v_filas;
    END IF;
  END IF;
END $$;

DROP INDEX IF EXISTS public.uq_alumno_dni_anio;
DROP INDEX IF EXISTS public.uq_alumno_usuario_anio;
DROP INDEX IF EXISTS public.uq_alumno_codigo_anio;
DROP INDEX IF EXISTS public.ix_alumno_anio_grado_estado;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alumnos_dni_key'
      AND conrelid = 'public.alumnos'::regclass
  ) THEN
    ALTER TABLE public.alumnos
      ADD CONSTRAINT alumnos_dni_key UNIQUE (dni);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alumnos_id_usuario_key'
      AND conrelid = 'public.alumnos'::regclass
  ) THEN
    ALTER TABLE public.alumnos
      ADD CONSTRAINT alumnos_id_usuario_key UNIQUE (id_usuario);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alumnos_codigo_estudiante_key'
      AND conrelid = 'public.alumnos'::regclass
  ) THEN
    ALTER TABLE public.alumnos
      ADD CONSTRAINT alumnos_codigo_estudiante_key UNIQUE (codigo_estudiante);
  END IF;
END $$;

DROP INDEX IF EXISTS public.uq_grado_anio_nivel_seccion_orden;
ALTER TABLE public.grados
  DROP CONSTRAINT IF EXISTS chk_grado_orden;
ALTER TABLE public.grados
  DROP COLUMN IF EXISTS orden;

DROP TABLE IF EXISTS public.anios_lectivos;
DROP TABLE IF EXISTS _param_anio;

COMMIT;
