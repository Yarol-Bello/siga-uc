-- ============================================================
-- H80 / Opción A — Conclusiones descriptivas estructuradas
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Agrega nivel de logro, avance, dificultad, sugerencia, estado y
-- auditoría a conclusiones_descriptivas. Agrega el código/hash de
-- control interno a exportaciones_siagie.
--
-- No crea tablas nuevas. No es una integración oficial con SIAGIE.
-- El código de control es interno y no reemplaza al código que
-- genera SIAGIE en su plantilla oficial.
--
-- Requiere el esquema base. Idempotente y compatible con Supabase.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Preflight
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.conclusiones_descriptivas') IS NULL
     OR to_regclass('public.notas_finales_area') IS NULL
     OR to_regclass('public.exportaciones_siagie') IS NULL
     OR to_regclass('public.usuarios') IS NULL THEN
    RAISE EXCEPTION 'H80 requiere conclusiones_descriptivas, notas_finales_area, exportaciones_siagie y usuarios.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. Conclusiones estructuradas
-- ------------------------------------------------------------
ALTER TABLE public.conclusiones_descriptivas
  ADD COLUMN IF NOT EXISTS nivel_logro varchar(2),
  ADD COLUMN IF NOT EXISTS avance text,
  ADD COLUMN IF NOT EXISTS dificultad text,
  ADD COLUMN IF NOT EXISTS sugerencia text,
  ADD COLUMN IF NOT EXISTS estado varchar(20) NOT NULL DEFAULT 'PUBLICADO',
  ADD COLUMN IF NOT EXISTS actualizado_por integer,
  ADD COLUMN IF NOT EXISTS actualizado_en timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS publicado_por integer,
  ADD COLUMN IF NOT EXISTS publicado_en timestamp;

-- Las filas existentes nacen PUBLICADO; las nuevas, BORRADOR.
ALTER TABLE public.conclusiones_descriptivas
  ALTER COLUMN estado SET DEFAULT 'BORRADOR';

-- Backfill del nivel desde la nota final cuando existe.
UPDATE public.conclusiones_descriptivas cd
SET nivel_logro = nf.nota_final
FROM public.notas_finales_area nf
WHERE cd.nivel_logro IS NULL
  AND nf.id_alumno = cd.id_alumno
  AND nf.id_curso = cd.id_curso
  AND nf.bimestre = cd.bimestre
  AND nf.anio_lectivo = cd.anio_lectivo
  AND nf.nota_final IN ('AD', 'A', 'B', 'C');

-- ------------------------------------------------------------
-- 2. FKs de auditoría
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_conclusion_actualizado_por'
      AND conrelid = 'public.conclusiones_descriptivas'::regclass
  ) THEN
    ALTER TABLE public.conclusiones_descriptivas
      ADD CONSTRAINT fk_conclusion_actualizado_por
      FOREIGN KEY (actualizado_por) REFERENCES public.usuarios(id_usuario)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_conclusion_publicado_por'
      AND conrelid = 'public.conclusiones_descriptivas'::regclass
  ) THEN
    ALTER TABLE public.conclusiones_descriptivas
      ADD CONSTRAINT fk_conclusion_publicado_por
      FOREIGN KEY (publicado_por) REFERENCES public.usuarios(id_usuario)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Checks idempotentes
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_conclusion_nivel'
      AND conrelid = 'public.conclusiones_descriptivas'::regclass
  ) THEN
    ALTER TABLE public.conclusiones_descriptivas
      ADD CONSTRAINT chk_conclusion_nivel
      CHECK (nivel_logro IS NULL OR nivel_logro IN ('AD', 'A', 'B', 'C'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_conclusion_estado'
      AND conrelid = 'public.conclusiones_descriptivas'::regclass
  ) THEN
    ALTER TABLE public.conclusiones_descriptivas
      ADD CONSTRAINT chk_conclusion_estado
      CHECK (estado IN ('BORRADOR', 'PUBLICADO'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_conclusion_longitud'
      AND conrelid = 'public.conclusiones_descriptivas'::regclass
  ) THEN
    ALTER TABLE public.conclusiones_descriptivas
      ADD CONSTRAINT chk_conclusion_longitud
      CHECK (char_length(descripcion) <= 350)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_conclusion_publicada'
      AND conrelid = 'public.conclusiones_descriptivas'::regclass
  ) THEN
    ALTER TABLE public.conclusiones_descriptivas
      ADD CONSTRAINT chk_conclusion_publicada
      CHECK (
        estado <> 'PUBLICADO'
        OR (nivel_logro IS NOT NULL AND btrim(descripcion) <> '')
      )
      NOT VALID;
  END IF;
END $$;

-- Valida los checks si los datos existentes ya cumplen. Si no,
-- quedan NOT VALID y siguen protegiendo las escrituras nuevas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conclusiones_descriptivas
    WHERE nivel_logro IS NOT NULL
      AND nivel_logro NOT IN ('AD', 'A', 'B', 'C')
  ) THEN
    ALTER TABLE public.conclusiones_descriptivas
      VALIDATE CONSTRAINT chk_conclusion_nivel;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conclusiones_descriptivas
    WHERE estado NOT IN ('BORRADOR', 'PUBLICADO')
  ) THEN
    ALTER TABLE public.conclusiones_descriptivas
      VALIDATE CONSTRAINT chk_conclusion_estado;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conclusiones_descriptivas
    WHERE char_length(descripcion) > 350
  ) THEN
    ALTER TABLE public.conclusiones_descriptivas
      VALIDATE CONSTRAINT chk_conclusion_longitud;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conclusiones_descriptivas
    WHERE estado = 'PUBLICADO'
      AND (nivel_logro IS NULL OR btrim(descripcion) = '')
  ) THEN
    ALTER TABLE public.conclusiones_descriptivas
      VALIDATE CONSTRAINT chk_conclusion_publicada;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conclusion_estado
  ON public.conclusiones_descriptivas (anio_lectivo, bimestre, estado);

-- ------------------------------------------------------------
-- 4. Código de control interno de las exportaciones
-- ------------------------------------------------------------
ALTER TABLE public.exportaciones_siagie
  ADD COLUMN IF NOT EXISTS codigo_control varchar(24),
  ADD COLUMN IF NOT EXISTS hash_integridad varchar(64),
  ADD COLUMN IF NOT EXISTS origen varchar(20) NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN IF NOT EXISTS detalle jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_exportacion_origen'
      AND conrelid = 'public.exportaciones_siagie'::regclass
  ) THEN
    ALTER TABLE public.exportaciones_siagie
      ADD CONSTRAINT chk_exportacion_origen
      CHECK (origen IN ('INTERNO', 'SIAGIE'))
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.exportaciones_siagie
    WHERE origen NOT IN ('INTERNO', 'SIAGIE')
  ) THEN
    ALTER TABLE public.exportaciones_siagie
      VALIDATE CONSTRAINT chk_exportacion_origen;
  END IF;
END $$;

DROP INDEX IF EXISTS public.uq_exportacion_codigo;
CREATE UNIQUE INDEX IF NOT EXISTS uq_exportacion_codigo
  ON public.exportaciones_siagie (codigo_control);

CREATE INDEX IF NOT EXISTS idx_exportacion_fecha
  ON public.exportaciones_siagie (anio_lectivo, bimestre, fecha_generacion DESC);

-- ------------------------------------------------------------
-- 5. Comentarios
-- ------------------------------------------------------------
COMMENT ON COLUMN public.conclusiones_descriptivas.nivel_logro IS
  'Nivel de logro AD/A/B/C de la conclusión (H80).';
COMMENT ON COLUMN public.conclusiones_descriptivas.avance IS
  'Avance observado del estudiante (H80).';
COMMENT ON COLUMN public.conclusiones_descriptivas.dificultad IS
  'Dificultad o aspecto por fortalecer (H80).';
COMMENT ON COLUMN public.conclusiones_descriptivas.sugerencia IS
  'Recomendación o sugerencia para el estudiante y la familia (H80).';
COMMENT ON COLUMN public.conclusiones_descriptivas.estado IS
  'BORRADOR o PUBLICADO. Se bloquea al cerrar el acta (H80).';
COMMENT ON COLUMN public.conclusiones_descriptivas.descripcion IS
  'Texto compuesto para libreta/SIAGIE interna, máximo 350 caracteres (H80).';
COMMENT ON COLUMN public.exportaciones_siagie.codigo_control IS
  'Código de control interno de la exportación. No es el código oficial de SIAGIE (H80).';
COMMENT ON COLUMN public.exportaciones_siagie.hash_integridad IS
  'SHA-256 del contenido exportado para verificación interna (H80).';
COMMENT ON COLUMN public.exportaciones_siagie.origen IS
  'INTERNO para el Excel de SIGA-UC; SIAGIE para una futura plantilla oficial (H80).';

COMMIT;

-- H80 aplicada: conclusiones estructuradas y código de control interno.
