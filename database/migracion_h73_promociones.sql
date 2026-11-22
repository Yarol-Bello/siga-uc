-- ============================================================
-- H73 — Promociones anuales y políticas de promoción (Fase 6.3)
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Requiere H49 aplicada: usa anios_lectivos, grados.orden y la
-- matrícula anual de alumnos. No modifica CHECK de alumnos,
-- no crea usuarios ni credenciales QR.
--
-- Idempotente y compatible con el SQL Editor de Supabase: no usa
-- variables psql. Ejecutar SIEMPRE después de H49 y con backup.
--
-- No incluye TRASLADADO: un traslado es RETIRADO + condición
-- 'Traslado' en alumnos y metadata.motivo='TRASLADO'.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.anios_lectivos') IS NULL THEN
    RAISE EXCEPTION 'H73 requiere la migración H49 (anios_lectivos). Aplique H49 primero.';
  END IF;
  IF to_regclass('public.alumnos') IS NULL OR to_regclass('public.grados') IS NULL THEN
    RAISE EXCEPTION 'H73 requiere el esquema base de alumnos y grados.';
  END IF;
END $$;

-- ============================================================
-- 1. Políticas de promoción configurables
-- ============================================================
CREATE TABLE IF NOT EXISTS public.politicas_promocion (
  id_politica serial PRIMARY KEY,
  anio_origen integer NOT NULL
    CHECK (anio_origen BETWEEN 2000 AND 2100),
  anio_destino integer
    CHECK (anio_destino IS NULL OR anio_destino BETWEEN 2000 AND 2100),
  nombre varchar(120) NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  requiere_actas_cerradas boolean NOT NULL DEFAULT true,
  requiere_notas_finales boolean NOT NULL DEFAULT true,
  umbral_asistencia numeric(5,2)
    CHECK (umbral_asistencia IS NULL OR (umbral_asistencia >= 0 AND umbral_asistencia <= 100)),
  criterio_academico jsonb NOT NULL DEFAULT '{}'::jsonb,
  permite_override boolean NOT NULL DEFAULT false,
  creado_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  fecha_creacion timestamp NOT NULL DEFAULT now(),
  CONSTRAINT chk_politica_anio_destino
    CHECK (anio_destino IS NULL OR anio_destino > anio_origen)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_politica_con_destino
  ON public.politicas_promocion (anio_origen, anio_destino, nombre)
  WHERE anio_destino IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_politica_sin_destino
  ON public.politicas_promocion (anio_origen, nombre)
  WHERE anio_destino IS NULL;

CREATE INDEX IF NOT EXISTS ix_politica_anio_activo
  ON public.politicas_promocion (anio_origen, anio_destino, activo);

-- Política estándar para el año ACTIVO de la instalación. El ADMIN puede
-- editarla o crear otras variantes. No se crea si ya existe una política
-- para ese año con el mismo nombre.
INSERT INTO public.politicas_promocion (
  anio_origen,
  anio_destino,
  nombre,
  activo,
  requiere_actas_cerradas,
  requiere_notas_finales,
  umbral_asistencia,
  criterio_academico,
  permite_override
)
SELECT
  a.anio,
  NULL,
  'Política estándar',
  true,
  true,
  true,
  NULL,
  '{
    "modo": "manual",
    "modo_repitencia": "DESACTIVADA",
    "notas_bimestres": [4],
    "bimestres_requeridos": [1, 2, 3, 4],
    "transiciones": [],
    "observacion": "La dirección revisa caso por caso. No se codifica la norma nacional."
  }'::jsonb,
  false
FROM public.anios_lectivos a
WHERE a.estado = 'ACTIVO'
  AND NOT EXISTS (
    SELECT 1
    FROM public.politicas_promocion p
    WHERE p.anio_origen = a.anio
      AND p.anio_destino IS NULL
      AND p.nombre = 'Política estándar'
  );

-- ============================================================
-- 2. Promociones por matrícula anual
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promociones (
  id_promocion bigserial PRIMARY KEY,
  id_alumno_origen integer NOT NULL
    REFERENCES public.alumnos(id_alumno) ON DELETE RESTRICT,
  id_alumno_destino integer
    REFERENCES public.alumnos(id_alumno) ON DELETE SET NULL,
  anio_origen integer NOT NULL
    CHECK (anio_origen BETWEEN 2000 AND 2100),
  anio_destino integer
    CHECK (anio_destino IS NULL OR anio_destino BETWEEN 2000 AND 2100),
  id_grado_origen integer NOT NULL
    REFERENCES public.grados(id_grado) ON DELETE RESTRICT,
  id_grado_destino integer
    REFERENCES public.grados(id_grado) ON DELETE RESTRICT,
  estado varchar(20) NOT NULL DEFAULT 'PREVISUALIZADA'
    CHECK (estado IN ('PREVISUALIZADA', 'CONFIRMADA', 'ANULADA', 'ERROR')),
  resultado varchar(20)
    CHECK (resultado IN ('PROMOVIDO', 'REPITENTE', 'EGRESADO', 'RETIRADO', 'PENDIENTE')),
  es_override boolean NOT NULL DEFAULT false,
  motivo text,
  observacion text,
  id_usuario integer
    REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  fecha_creacion timestamp NOT NULL DEFAULT now(),
  fecha_confirmacion timestamp,
  id_promocion_reversa integer
    REFERENCES public.promociones(id_promocion) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_promocion_anio_destino
    CHECK (anio_destino IS NULL OR anio_destino > anio_origen)
);

-- Una sola promoción CONFIRMADA por matrícula de origen.
CREATE UNIQUE INDEX IF NOT EXISTS uq_promocion_origen_confirmada
  ON public.promociones (id_alumno_origen)
  WHERE estado = 'CONFIRMADA';

-- Una matrícula destino no puede provenir de dos promociones confirmadas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_promocion_destino_confirmada
  ON public.promociones (id_alumno_destino)
  WHERE estado = 'CONFIRMADA' AND id_alumno_destino IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_promocion_anios
  ON public.promociones (anio_origen, anio_destino, estado);

CREATE INDEX IF NOT EXISTS ix_promocion_destino
  ON public.promociones (id_alumno_destino)
  WHERE id_alumno_destino IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_promocion_usuario
  ON public.promociones (id_usuario, fecha_creacion DESC);

COMMIT;
