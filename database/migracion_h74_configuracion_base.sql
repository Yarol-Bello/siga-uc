-- ============================================================
-- H74 / Fase 1 — Núcleo de configuración del sistema
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Crea:
--   1. configuracion_institucional (una sola fila)
--   2. configuracion_anio (una fila por año lectivo)
--   3. bitacora_auditoria.motivo
--
-- No modifica tarifas, cursos, competencias, becas ni horarios.
-- Es idempotente y compatible con el SQL Editor de Supabase.
-- Requiere H49 (anios_lectivos) y el esquema base.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Preflight
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.anios_lectivos') IS NULL THEN
    RAISE EXCEPTION 'H74 requiere H49 (anios_lectivos). Aplique H49 primero.';
  END IF;
  IF to_regclass('public.usuarios') IS NULL
     OR to_regclass('public.bitacora_auditoria') IS NULL THEN
    RAISE EXCEPTION 'H74 requiere el esquema base de usuarios y bitacora_auditoria.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. Configuración institucional global
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracion_institucional (
  id_configuracion smallint PRIMARY KEY DEFAULT 1,
  nombre_institucion varchar(200) NOT NULL,
  nombre_corto varchar(100),
  ruc varchar(11),
  direccion varchar(250),
  distrito varchar(100),
  provincia varchar(100),
  departamento varchar(100),
  pais varchar(100) DEFAULT 'Perú',
  telefono varchar(30),
  correo_contacto varchar(150),
  sitio_web varchar(200),
  logo_url text,
  moneda char(3) NOT NULL DEFAULT 'PEN',
  simbolo_moneda varchar(5) NOT NULL DEFAULT 'S/',
  zona_horaria varchar(50) NOT NULL DEFAULT 'America/Lima',
  locale varchar(10) NOT NULL DEFAULT 'es-PE',
  nombre_remitente varchar(150),
  texto_boleta text,
  texto_libreta text,
  texto_acta text,
  texto_pie text,
  serie_boleta varchar(10) DEFAULT 'B001',
  numero_boleta_inicial integer DEFAULT 4820,
  actualizado_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  actualizado_en timestamp NOT NULL DEFAULT now(),
  CONSTRAINT chk_configuracion_unica CHECK (id_configuracion = 1),
  CONSTRAINT chk_configuracion_ruc CHECK (ruc IS NULL OR ruc ~ '^[0-9]{11}$'),
  CONSTRAINT chk_configuracion_moneda CHECK (moneda ~ '^[A-Z]{3}$'),
  CONSTRAINT chk_configuracion_simbolo CHECK (btrim(simbolo_moneda) <> ''),
  CONSTRAINT chk_configuracion_locale CHECK (locale ~ '^[a-z]{2}-[A-Z]{2}$'),
  CONSTRAINT chk_configuracion_serie CHECK (
    serie_boleta IS NULL OR serie_boleta ~ '^[A-Z0-9]{1,10}$'
  ),
  CONSTRAINT chk_configuracion_boleta_inicial CHECK (
    numero_boleta_inicial IS NULL
    OR (numero_boleta_inicial >= 0 AND numero_boleta_inicial <= 999999)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_configuracion_institucional_unica
  ON public.configuracion_institucional (id_configuracion);

INSERT INTO public.configuracion_institucional (
  id_configuracion,
  nombre_institucion,
  nombre_corto,
  distrito,
  provincia,
  departamento,
  pais,
  moneda,
  simbolo_moneda,
  zona_horaria,
  locale,
  nombre_remitente,
  texto_pie,
  serie_boleta,
  numero_boleta_inicial
)
VALUES (
  1,
  'I.E.P. Unión Científica',
  'Unión Científica',
  'Huancayo',
  'Huancayo',
  'Junín',
  'Perú',
  'PEN',
  'S/',
  'America/Lima',
  'es-PE',
  'I.E.P. Unión Científica',
  'SIGA-UC — Sistema Integrado de Gestión Académica',
  'B001',
  4820
)
ON CONFLICT (id_configuracion) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Configuración por año lectivo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracion_anio (
  anio integer PRIMARY KEY
    REFERENCES public.anios_lectivos(anio) ON DELETE CASCADE,
  dias_clase varchar(15)[] NOT NULL
    DEFAULT ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes']::varchar(15)[],
  hora_inicio_jornada time without time zone,
  hora_fin_jornada time without time zone,
  duracion_min_bloque integer NOT NULL DEFAULT 45,
  max_bloques_curso_dia integer NOT NULL DEFAULT 2,
  horas_default_carga integer NOT NULL DEFAULT 2,
  politica_inicio_pension varchar(30) NOT NULL DEFAULT 'MES_MATRICULA',
  mes_inicio_pension integer,
  version integer NOT NULL DEFAULT 1,
  actualizado_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  actualizado_en timestamp NOT NULL DEFAULT now(),
  CONSTRAINT chk_configuracion_anio_dias CHECK (
    cardinality(dias_clase) >= 1
    AND dias_clase <@ ARRAY[
      'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'
    ]::varchar(15)[]
  ),
  CONSTRAINT chk_configuracion_anio_jornada CHECK (
    hora_inicio_jornada IS NULL
    OR hora_fin_jornada IS NULL
    OR hora_fin_jornada > hora_inicio_jornada
  ),
  CONSTRAINT chk_configuracion_anio_duracion CHECK (duracion_min_bloque > 0),
  CONSTRAINT chk_configuracion_anio_max_bloques CHECK (max_bloques_curso_dia > 0),
  CONSTRAINT chk_configuracion_anio_horas_default CHECK (horas_default_carga > 0),
  CONSTRAINT chk_configuracion_anio_politica CHECK (
    politica_inicio_pension IN (
      'MES_MATRICULA', 'PRIMER_MES_CONFIGURADO', 'MES_FIJO'
    )
  ),
  CONSTRAINT chk_configuracion_anio_mes CHECK (
    mes_inicio_pension IS NULL
    OR (mes_inicio_pension >= 1 AND mes_inicio_pension <= 12)
  ),
  CONSTRAINT chk_configuracion_anio_mes_fijo CHECK (
    politica_inicio_pension <> 'MES_FIJO'
    OR mes_inicio_pension IS NOT NULL
  ),
  CONSTRAINT chk_configuracion_anio_version CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS idx_configuracion_anio_anio
  ON public.configuracion_anio (anio);

-- Backfill: una fila por año. Si H47 ya existe, toma la jornada de los períodos.
DO $$
BEGIN
  IF to_regclass('public.periodos_clase') IS NOT NULL THEN
    INSERT INTO public.configuracion_anio (
      anio,
      dias_clase,
      hora_inicio_jornada,
      hora_fin_jornada,
      duracion_min_bloque,
      max_bloques_curso_dia,
      horas_default_carga,
      politica_inicio_pension
    )
    SELECT
      a.anio,
      ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes']::varchar(15)[],
      COALESCE(
        (SELECT MIN(p.hora_inicio) FROM public.periodos_clase p
         WHERE p.anio_lectivo = a.anio),
        TIME '07:30'
      ),
      COALESCE(
        (SELECT MAX(p.hora_fin) FROM public.periodos_clase p
         WHERE p.anio_lectivo = a.anio),
        TIME '14:30'
      ),
      45,
      2,
      2,
      'MES_MATRICULA'
    FROM public.anios_lectivos a
    ON CONFLICT (anio) DO NOTHING;
  ELSE
    INSERT INTO public.configuracion_anio (
      anio,
      dias_clase,
      hora_inicio_jornada,
      hora_fin_jornada,
      duracion_min_bloque,
      max_bloques_curso_dia,
      horas_default_carga,
      politica_inicio_pension
    )
    SELECT
      a.anio,
      ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes']::varchar(15)[],
      TIME '07:30',
      TIME '14:30',
      45,
      2,
      2,
      'MES_MATRICULA'
    FROM public.anios_lectivos a
    ON CONFLICT (anio) DO NOTHING;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Alta automática de configuración para años nuevos
--    El rollover y cualquier creación de año reciben una fila default.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_configuracion_anio_crear()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.configuracion_anio (anio)
  VALUES (NEW.anio)
  ON CONFLICT (anio) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anio_configuracion ON public.anios_lectivos;
CREATE TRIGGER trg_anio_configuracion
AFTER INSERT ON public.anios_lectivos
FOR EACH ROW
EXECUTE FUNCTION public.trg_configuracion_anio_crear();

-- ------------------------------------------------------------
-- 4. Motivo de auditoría
-- ------------------------------------------------------------
ALTER TABLE public.bitacora_auditoria
  ADD COLUMN IF NOT EXISTS motivo varchar(500);

COMMENT ON TABLE public.configuracion_institucional IS
  'Configuración global editable del colegio. Una sola fila.';
COMMENT ON TABLE public.configuracion_anio IS
  'Configuración operativa por año lectivo: días, jornada y límites.';
COMMENT ON COLUMN public.bitacora_auditoria.motivo IS
  'Motivo declarado por el usuario para cambios de configuración.';

COMMIT;

\echo 'H74 aplicada: configuración institucional, configuración por año y motivo de auditoría.'
