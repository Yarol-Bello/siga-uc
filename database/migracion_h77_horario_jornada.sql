-- ============================================================
-- H77 / Fase 4 — Jornada, días y límites de horario
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Completa la configuración por año, amplía los días válidos de
-- horarios y valida que los períodos estén dentro de la jornada.
-- Requiere H47, H74 y H76. Idempotente.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.configuracion_anio') IS NULL
     OR to_regclass('public.periodos_clase') IS NULL
     OR to_regclass('public.horarios') IS NULL THEN
    RAISE EXCEPTION 'H77 requiere H74, H47 y el esquema de horarios.';
  END IF;
END $$;

-- Jornada por defecto para años creados antes de H77.
UPDATE public.configuracion_anio c
SET hora_inicio_jornada = COALESCE(
      c.hora_inicio_jornada,
      (SELECT MIN(p.hora_inicio) FROM public.periodos_clase p
       WHERE p.anio_lectivo = c.anio),
      TIME '07:30'
    ),
    hora_fin_jornada = COALESCE(
      c.hora_fin_jornada,
      (SELECT MAX(p.hora_fin) FROM public.periodos_clase p
       WHERE p.anio_lectivo = c.anio),
      TIME '14:30'
    ),
    actualizado_en = now()
WHERE c.hora_inicio_jornada IS NULL OR c.hora_fin_jornada IS NULL;

-- El trigger de año nuevo debe crear la jornada completa.
CREATE OR REPLACE FUNCTION public.trg_configuracion_anio_crear()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.configuracion_anio (
    anio, hora_inicio_jornada, hora_fin_jornada
  )
  VALUES (NEW.anio, TIME '07:30', TIME '14:30')
  ON CONFLICT (anio) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Días válidos: se alinean con la configuración (Lunes–Domingo).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_horario_dia'
      AND conrelid = 'public.horarios'::regclass
  ) THEN
    ALTER TABLE public.horarios DROP CONSTRAINT chk_horario_dia;
  END IF;

  ALTER TABLE public.horarios
    ADD CONSTRAINT chk_horario_dia CHECK (
      dia_semana::text = ANY (ARRAY[
        'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'
      ]::text[])
    );
END $$;

-- Validación de período: además de solapes, respeta jornada y duración mínima.
CREATE OR REPLACE FUNCTION public.fn_periodo_clase_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_config record;
  v_duracion_minutos numeric;
BEGIN
  IF NEW.hora_fin <= NEW.hora_inicio THEN
    RAISE EXCEPTION 'La hora de fin debe ser mayor que la hora de inicio.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.periodos_clase p
    WHERE p.anio_lectivo = NEW.anio_lectivo
      AND p.id_periodo <> NEW.id_periodo
      AND NEW.hora_inicio < p.hora_fin
      AND NEW.hora_fin > p.hora_inicio
  ) THEN
    RAISE EXCEPTION 'El período se solapa con otro período del año %.', NEW.anio_lectivo
      USING ERRCODE = '23514';
  END IF;

  SELECT hora_inicio_jornada, hora_fin_jornada, duracion_min_bloque
    INTO v_config
  FROM public.configuracion_anio
  WHERE anio = NEW.anio_lectivo;

  IF FOUND AND v_config.hora_inicio_jornada IS NOT NULL
     AND v_config.hora_fin_jornada IS NOT NULL THEN
    IF NEW.hora_inicio < v_config.hora_inicio_jornada
       OR NEW.hora_fin > v_config.hora_fin_jornada THEN
      RAISE EXCEPTION 'El período % está fuera de la jornada %–%.',
        NEW.nombre, v_config.hora_inicio_jornada, v_config.hora_fin_jornada
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.tipo = 'CLASE' AND v_config.duracion_min_bloque IS NOT NULL THEN
    v_duracion_minutos := EXTRACT(EPOCH FROM (NEW.hora_fin - NEW.hora_inicio)) / 60;
    IF v_duracion_minutos < v_config.duracion_min_bloque THEN
      RAISE EXCEPTION 'El bloque % dura % minutos; el mínimo es %.',
        NEW.nombre, v_duracion_minutos, v_config.duracion_min_bloque
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1 FROM public.horarios h WHERE h.id_periodo = OLD.id_periodo
    ) AND (
      NEW.anio_lectivo <> OLD.anio_lectivo
      OR NEW.hora_inicio <> OLD.hora_inicio
      OR NEW.hora_fin <> OLD.hora_fin
      OR NEW.tipo <> OLD.tipo
    ) THEN
      RAISE EXCEPTION 'No se puede cambiar el año, horario o tipo de un período que ya tiene bloques asignados.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_periodo_clase_validar ON public.periodos_clase;
CREATE TRIGGER trg_periodo_clase_validar
BEFORE INSERT OR UPDATE ON public.periodos_clase
FOR EACH ROW
EXECUTE FUNCTION public.fn_periodo_clase_validar();

COMMENT ON COLUMN public.configuracion_anio.dias_clase IS
  'Días de clase del año; el frontend y el generador los usan.';
COMMENT ON COLUMN public.configuracion_anio.max_bloques_curso_dia IS
  'Máximo de bloques del mismo curso en un día (H77).';
COMMENT ON COLUMN public.configuracion_anio.horas_default_carga IS
  'Horas de carga cuando horas_asignadas es NULL (H77).';

COMMIT;

\echo 'H77 aplicada: jornada, días válidos y límites de horario.'
