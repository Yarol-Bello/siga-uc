-- ============================================================
-- H49 / Fase 6.1 — Base multi-año
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- NO crea promociones, NO hace rollover de grados/carga/períodos y NO
-- promueve alumnos. Solo separa identidad (usuarios) de matrícula anual
-- (alumnos), agrega el catálogo de años y el orden de grados.
--
-- EJECUCIÓN:
--   * Pegar completo en el SQL Editor de Supabase, o
--   * psql -U postgres -d siga_uc -f database/migracion_h49_multianio_base.sql
--
-- Editar SOLO la línea de INSERT INTO _param_anio y dejar el año activo
-- que corresponda. En la demo actual: 2026.
--
-- Es idempotente: se puede ejecutar dos veces. Si el preflight detecta
-- duplicados o grados sin orden, aborta y no modifica nada.
-- ============================================================

BEGIN;

-- Tabla temporal de una sola fila. Evita variables psql para que el archivo
-- funcione también pegado en el SQL Editor de Supabase.
DROP TABLE IF EXISTS _param_anio;
CREATE TEMP TABLE _param_anio (anio integer NOT NULL);
INSERT INTO _param_anio VALUES (2026);  -- EDITAR SOLO ESTA LÍNEA

-- ============================================================
-- 0. PREFLIGHT (si algo falla, RAISE EXCEPTION y ROLLBACK)
-- ============================================================
-- Consultas equivalentes para revisar a mano antes de aplicar en Supabase:
--
-- SELECT dni, anio_lectivo, COUNT(*) AS filas
-- FROM alumnos GROUP BY dni, anio_lectivo HAVING COUNT(*) > 1;
--
-- SELECT id_usuario, anio_lectivo, COUNT(*) AS filas
-- FROM alumnos GROUP BY id_usuario, anio_lectivo HAVING COUNT(*) > 1;
--
-- SELECT codigo_estudiante, anio_lectivo, COUNT(*) AS filas
-- FROM alumnos
-- WHERE codigo_estudiante IS NOT NULL
-- GROUP BY codigo_estudiante, anio_lectivo HAVING COUNT(*) > 1;
--
-- SELECT id_grado, nombre_grado, anio_lectivo
-- FROM grados
-- WHERE substring(nombre_grado FROM '^([1-6])') IS NULL;
--
-- SELECT anio_lectivo, nivel, seccion, orden, COUNT(*) AS filas
-- FROM grados
-- GROUP BY anio_lectivo, nivel, seccion, orden HAVING COUNT(*) > 1;

DO $$
DECLARE
  v_dni text;
  v_usuario integer;
  v_codigo text;
  v_anio integer;
  v_filas integer;
BEGIN
  SELECT dni INTO v_dni
  FROM alumnos
  GROUP BY dni, anio_lectivo
  HAVING COUNT(*) > 1
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'H49: hay DNI duplicado dentro del mismo año: %', v_dni;
  END IF;

  SELECT id_usuario INTO v_usuario
  FROM alumnos
  GROUP BY id_usuario, anio_lectivo
  HAVING COUNT(*) > 1
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'H49: hay id_usuario duplicado dentro del mismo año: %', v_usuario;
  END IF;

  SELECT codigo_estudiante INTO v_codigo
  FROM alumnos
  WHERE codigo_estudiante IS NOT NULL
  GROUP BY codigo_estudiante, anio_lectivo
  HAVING COUNT(*) > 1
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'H49: hay codigo_estudiante duplicado dentro del mismo año: %', v_codigo;
  END IF;

  SELECT COUNT(*) INTO v_filas
  FROM alumnos
  WHERE anio_lectivo IS NULL;
  IF v_filas > 0 THEN
    RAISE EXCEPTION 'H49: hay % alumno(s) sin anio_lectivo', v_filas;
  END IF;
END $$;

-- ============================================================
-- 1. Catálogo de años lectivos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.anios_lectivos (
  anio integer PRIMARY KEY CHECK (anio BETWEEN 2000 AND 2100),
  estado varchar(20) NOT NULL DEFAULT 'PLANIFICADO'
    CHECK (estado IN ('PLANIFICADO', 'ACTIVO', 'CERRADO')),
  fecha_inicio date,
  fecha_fin date,
  creado_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  fecha_creacion timestamp NOT NULL DEFAULT now(),
  cerrado_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  fecha_cierre timestamp,
  observacion text
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_anio_activo
  ON public.anios_lectivos (estado)
  WHERE estado = 'ACTIVO';

-- Se siembra solo desde tablas que existan: así la migración también
-- funciona en una base que todavía no aplicó H47/H48, sin fallar por una
-- tabla opcional ausente. Las tablas se listan de forma fija, no dinámica.
DO $$
DECLARE
  v_tabla text;
BEGIN
  FOR v_tabla IN
    SELECT unnest(ARRAY[
      'alumnos',
      'grados',
      'conceptos_pago',
      'carga_curricular',
      'periodos_clase',
      'actas_bimestrales',
      'notas_finales_area',
      'pensiones',
      'conclusiones_descriptivas'
    ])
  LOOP
    IF to_regclass('public.' || v_tabla) IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO public.anios_lectivos (anio)
         SELECT DISTINCT anio_lectivo
         FROM public.%I
         WHERE anio_lectivo IS NOT NULL
         ON CONFLICT (anio) DO NOTHING',
        v_tabla
      );
    END IF;
  END LOOP;
END $$;

INSERT INTO public.anios_lectivos (anio)
SELECT anio FROM _param_anio
ON CONFLICT (anio) DO NOTHING;

DO $$
DECLARE
  v_anio integer;
  v_activo integer;
BEGIN
  SELECT anio INTO v_anio FROM _param_anio;

  SELECT anio INTO v_activo
  FROM public.anios_lectivos
  WHERE estado = 'ACTIVO'
  ORDER BY anio
  LIMIT 1;

  IF v_activo IS NULL THEN
    UPDATE public.anios_lectivos
    SET estado = 'ACTIVO'
    WHERE anio = v_anio;
    RAISE NOTICE 'H49: año % marcado como ACTIVO.', v_anio;
  ELSIF v_activo <> v_anio THEN
    RAISE NOTICE 'H49: ya existe un año ACTIVO (%) distinto de _param_anio (%); no se cambia el año activo.',
      v_activo, v_anio;
  ELSE
    RAISE NOTICE 'H49: año % ya es ACTIVO.', v_anio;
  END IF;
END $$;

-- ============================================================
-- 2. grados.orden
-- ============================================================
ALTER TABLE public.grados
  ADD COLUMN IF NOT EXISTS orden integer;

UPDATE public.grados
SET orden = substring(nombre_grado FROM '^([1-6])')::integer
WHERE orden IS NULL
  AND substring(nombre_grado FROM '^([1-6])') IS NOT NULL;

DO $$
DECLARE
  v_nombres text;
BEGIN
  SELECT string_agg(DISTINCT nombre_grado, ', ')
  INTO v_nombres
  FROM public.grados
  WHERE orden IS NULL;

  IF v_nombres IS NOT NULL THEN
    RAISE EXCEPTION 'H49: hay grados sin orden mapeado: %. Use el mapeo manual antes de continuar.',
      v_nombres;
  END IF;
END $$;

ALTER TABLE public.grados
  ALTER COLUMN orden SET NOT NULL;

ALTER TABLE public.grados
  DROP CONSTRAINT IF EXISTS chk_grado_orden;
ALTER TABLE public.grados
  ADD CONSTRAINT chk_grado_orden CHECK (orden > 0);

DO $$
DECLARE
  v_anio integer;
  v_nivel varchar;
  v_seccion varchar;
  v_orden integer;
  v_filas integer;
BEGIN
  SELECT anio_lectivo, nivel, seccion, orden, COUNT(*)
  INTO v_anio, v_nivel, v_seccion, v_orden, v_filas
  FROM public.grados
  GROUP BY anio_lectivo, nivel, seccion, orden
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'H49: grado duplicado en año %, nivel %, sección %, orden % (% filas).',
      v_anio, v_nivel, v_seccion, v_orden, v_filas;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_grado_anio_nivel_seccion_orden
  ON public.grados (anio_lectivo, nivel, seccion, orden);

-- uq_grado (nombre_grado, seccion, anio_lectivo) se conserva.

-- ============================================================
-- 3. alumnos: uniques por año
-- ============================================================
ALTER TABLE public.alumnos
  DROP CONSTRAINT IF EXISTS alumnos_dni_key;
ALTER TABLE public.alumnos
  DROP CONSTRAINT IF EXISTS alumnos_id_usuario_key;
ALTER TABLE public.alumnos
  DROP CONSTRAINT IF EXISTS alumnos_codigo_estudiante_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alumno_dni_anio
  ON public.alumnos (dni, anio_lectivo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumno_usuario_anio
  ON public.alumnos (id_usuario, anio_lectivo);
-- Varios codigo_estudiante NULL por año están permitidos: PostgreSQL no
-- considera iguales los NULL en un índice UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumno_codigo_anio
  ON public.alumnos (codigo_estudiante, anio_lectivo);

CREATE INDEX IF NOT EXISTS ix_alumno_anio_grado_estado
  ON public.alumnos (anio_lectivo, id_grado, estado_matricula);

DROP TABLE IF EXISTS _param_anio;

COMMIT;
