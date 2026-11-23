-- ============================================================
-- H76 / Fase 3 — Catálogo académico administrable
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Crea areas_academicas y agrega activación/orden/timestamps a
-- cursos, competencias y carga_curricular. No borra datos ni
-- cambia la oferta existente. Requiere H74. Idempotente.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_dup text;
BEGIN
  IF to_regclass('public.cursos') IS NULL
     OR to_regclass('public.competencias') IS NULL
     OR to_regclass('public.carga_curricular') IS NULL THEN
    RAISE EXCEPTION 'H76 requiere el esquema base de cursos, competencias y carga.';
  END IF;

  SELECT string_agg(id_curso || '/' || orden, ', ')
    INTO v_dup
  FROM (
    SELECT id_curso, orden, COUNT(*) AS total
    FROM public.competencias
    WHERE orden IS NOT NULL
    GROUP BY id_curso, orden
    HAVING COUNT(*) > 1
  ) q;

  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'H76: hay competencias con orden duplicado por curso: %', v_dup;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.areas_academicas (
  id_area serial PRIMARY KEY,
  nombre varchar(50) NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  creado_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  actualizado_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  fecha_creacion timestamp NOT NULL DEFAULT now(),
  fecha_actualizacion timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_area_academica_nombre UNIQUE (nombre),
  CONSTRAINT chk_area_academica_orden CHECK (orden >= 0)
);

INSERT INTO public.areas_academicas (nombre, orden)
SELECT DISTINCT btrim(c.area_academica), 0
FROM public.cursos c
WHERE btrim(c.area_academica) <> ''
ON CONFLICT (nombre) DO NOTHING;

ALTER TABLE public.cursos
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descripcion varchar(250),
  ADD COLUMN IF NOT EXISTS creado_por integer,
  ADD COLUMN IF NOT EXISTS actualizado_por integer,
  ADD COLUMN IF NOT EXISTS fecha_creacion timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fecha_actualizacion timestamp NOT NULL DEFAULT now();

ALTER TABLE public.competencias
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS descripcion varchar(250),
  ADD COLUMN IF NOT EXISTS creado_por integer,
  ADD COLUMN IF NOT EXISTS actualizado_por integer,
  ADD COLUMN IF NOT EXISTS fecha_creacion timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fecha_actualizacion timestamp NOT NULL DEFAULT now();

ALTER TABLE public.carga_curricular
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS observacion varchar(250),
  ADD COLUMN IF NOT EXISTS creado_por integer,
  ADD COLUMN IF NOT EXISTS actualizado_por integer,
  ADD COLUMN IF NOT EXISTS fecha_creacion timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fecha_actualizacion timestamp NOT NULL DEFAULT now();

UPDATE public.cursos
SET orden = id_curso
WHERE orden = 0;

UPDATE public.competencias
SET orden = id_competencia
WHERE orden IS NULL OR orden = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_curso_orden' AND conrelid = 'public.cursos'::regclass
  ) THEN
    ALTER TABLE public.cursos ADD CONSTRAINT chk_curso_orden CHECK (orden >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_curso_horas' AND conrelid = 'public.cursos'::regclass
  ) THEN
    ALTER TABLE public.cursos ADD CONSTRAINT chk_curso_horas CHECK (
      horas_semanales IS NULL OR horas_semanales > 0
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_competencia_orden' AND conrelid = 'public.competencias'::regclass
  ) THEN
    ALTER TABLE public.competencias ADD CONSTRAINT chk_competencia_orden CHECK (orden > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_carga_horas' AND conrelid = 'public.carga_curricular'::regclass
  ) THEN
    ALTER TABLE public.carga_curricular ADD CONSTRAINT chk_carga_horas CHECK (
      horas_asignadas IS NULL OR horas_asignadas > 0
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_competencia_curso_orden'
      AND conrelid = 'public.competencias'::regclass
  ) THEN
    ALTER TABLE public.competencias
      ADD CONSTRAINT uq_competencia_curso_orden UNIQUE (id_curso, orden);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_curso_creado_por' AND conrelid = 'public.cursos'::regclass
  ) THEN
    ALTER TABLE public.cursos ADD CONSTRAINT fk_curso_creado_por
      FOREIGN KEY (creado_por) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_curso_actualizado_por' AND conrelid = 'public.cursos'::regclass
  ) THEN
    ALTER TABLE public.cursos ADD CONSTRAINT fk_curso_actualizado_por
      FOREIGN KEY (actualizado_por) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_carga_creado_por' AND conrelid = 'public.carga_curricular'::regclass
  ) THEN
    ALTER TABLE public.carga_curricular ADD CONSTRAINT fk_carga_creado_por
      FOREIGN KEY (creado_por) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_carga_actualizado_por' AND conrelid = 'public.carga_curricular'::regclass
  ) THEN
    ALTER TABLE public.carga_curricular ADD CONSTRAINT fk_carga_actualizado_por
      FOREIGN KEY (actualizado_por) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_areas_academicas_activo
  ON public.areas_academicas (activo, orden, nombre);
CREATE INDEX IF NOT EXISTS idx_cursos_activo
  ON public.cursos (activo, area_academica, nombre_curso);
CREATE INDEX IF NOT EXISTS idx_competencias_activo
  ON public.competencias (id_curso, activo, orden);
CREATE INDEX IF NOT EXISTS idx_carga_activo
  ON public.carga_curricular (anio_lectivo, activo, id_grado);

COMMENT ON TABLE public.areas_academicas IS
  'Catálogo de áreas académicas; cursos.area_academica conserva el nombre.';
COMMENT ON COLUMN public.cursos.activo IS
  'Desactivación lógica; no borra cursos con historial.';
COMMENT ON COLUMN public.competencias.activo IS
  'Desactivación lógica; no borra competencias con notas.';
COMMENT ON COLUMN public.carga_curricular.activo IS
  'Permite dejar de ofrecer una carga sin borrar el histórico del año.';

COMMIT;

\echo 'H76 aplicada: áreas, activación de cursos/competencias y carga.'
