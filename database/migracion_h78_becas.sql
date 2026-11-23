-- ============================================================
-- H78 / Fase 5 — Becas configurables y aplicación
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Crea tipos de beca, amplía becas, agrega aplicaciones_beca y
-- descuento en pre_tickets. No reprecian pagos ni cargos pagados.
-- Requiere H74 y H75. Idempotente.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_negativas integer;
BEGIN
  IF to_regclass('public.becas') IS NULL
     OR to_regclass('public.pensiones') IS NULL
     OR to_regclass('public.pre_tickets') IS NULL THEN
    RAISE EXCEPTION 'H78 requiere el esquema de becas, pensiones y pre_tickets.';
  END IF;

  SELECT COUNT(*)::int INTO v_negativas
  FROM public.pensiones
  WHERE monto_final < 0 OR descuento < 0;

  IF v_negativas > 0 THEN
    RAISE EXCEPTION 'H78: hay % pensión(es) con montos negativos', v_negativas;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tipos_beca (
  id_tipo_beca serial PRIMARY KEY,
  codigo varchar(50) NOT NULL,
  nombre varchar(150) NOT NULL,
  descripcion text,
  alcance varchar(20) NOT NULL DEFAULT 'PENSION',
  modalidad varchar(20) NOT NULL DEFAULT 'PORCENTAJE',
  valor_default numeric(10,2) NOT NULL DEFAULT 0,
  tope_monto numeric(10,2),
  permite_combinacion boolean NOT NULL DEFAULT false,
  grupo_exclusividad varchar(50),
  prioridad integer NOT NULL DEFAULT 0,
  requiere_evidencia boolean NOT NULL DEFAULT false,
  requiere_aprobacion boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  creado_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  actualizado_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  fecha_creacion timestamp NOT NULL DEFAULT now(),
  fecha_actualizacion timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_tipo_beca_codigo UNIQUE (codigo),
  CONSTRAINT chk_tipo_beca_alcance CHECK (alcance IN ('MATRICULA','PENSION','AMBOS')),
  CONSTRAINT chk_tipo_beca_modalidad CHECK (modalidad IN ('PORCENTAJE','MONTO_FIJO')),
  CONSTRAINT chk_tipo_beca_valor CHECK (valor_default >= 0),
  CONSTRAINT chk_tipo_beca_tope CHECK (tope_monto IS NULL OR tope_monto >= 0),
  CONSTRAINT chk_tipo_beca_porcentaje CHECK (
    modalidad <> 'PORCENTAJE' OR valor_default <= 100
  ),
  CONSTRAINT chk_tipo_beca_orden CHECK (orden >= 0)
);

INSERT INTO public.tipos_beca (
  codigo, nombre, alcance, modalidad, valor_default,
  permite_combinacion, prioridad, requiere_evidencia, requiere_aprobacion, activo, orden
)
VALUES
  ('SOCIOECONOMICA', 'Beca socioeconómica', 'PENSION', 'PORCENTAJE', 0, false, 10, true, true, true, 10),
  ('HERMANOS', 'Beca por hermanos', 'PENSION', 'PORCENTAJE', 0, false, 20, true, true, true, 20),
  ('EXCELENCIA', 'Beca de excelencia académica', 'PENSION', 'PORCENTAJE', 0, false, 30, true, true, true, 30),
  ('ORFANDAD', 'Beca por orfandad', 'PENSION', 'PORCENTAJE', 0, false, 40, true, true, true, 40),
  ('CONVENIO', 'Beca por convenio', 'PENSION', 'PORCENTAJE', 0, false, 50, true, true, true, 50)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE public.becas
  ADD COLUMN IF NOT EXISTS id_tipo_beca integer,
  ADD COLUMN IF NOT EXISTS alcance varchar(20) NOT NULL DEFAULT 'PENSION',
  ADD COLUMN IF NOT EXISTS modalidad varchar(20) NOT NULL DEFAULT 'PORCENTAJE',
  ADD COLUMN IF NOT EXISTS valor numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_maximo numeric(10,2),
  ADD COLUMN IF NOT EXISTS estado varchar(20) NOT NULL DEFAULT 'APROBADA',
  ADD COLUMN IF NOT EXISTS motivo varchar(500),
  ADD COLUMN IF NOT EXISTS evidencia jsonb,
  ADD COLUMN IF NOT EXISTS aprobado_por integer,
  ADD COLUMN IF NOT EXISTS fecha_aprobacion timestamp,
  ADD COLUMN IF NOT EXISTS grupo_exclusividad varchar(50),
  ADD COLUMN IF NOT EXISTS prioridad integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creado_por integer,
  ADD COLUMN IF NOT EXISTS fecha_creacion timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fecha_actualizacion timestamp NOT NULL DEFAULT now();

-- Crea tipos para códigos existentes que no estén en el catálogo.
INSERT INTO public.tipos_beca (codigo, nombre, alcance, modalidad, activo)
SELECT DISTINCT
  upper(b.tipo),
  initcap(replace(b.tipo, '_', ' ')),
  'PENSION',
  'PORCENTAJE',
  true
FROM public.becas b
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipos_beca t WHERE t.codigo = upper(b.tipo)
)
ON CONFLICT (codigo) DO NOTHING;

UPDATE public.becas b
SET id_tipo_beca = t.id_tipo_beca
FROM public.tipos_beca t
WHERE b.id_tipo_beca IS NULL
  AND t.codigo = upper(b.tipo);

UPDATE public.becas
SET alcance = 'PENSION',
    modalidad = CASE
      WHEN COALESCE(monto_descuento, 0) > 0 THEN 'MONTO_FIJO'
      ELSE 'PORCENTAJE'
    END,
    valor = CASE
      WHEN COALESCE(monto_descuento, 0) > 0 THEN monto_descuento
      ELSE porcentaje_descuento
    END,
    estado = CASE WHEN activo THEN 'APROBADA' ELSE 'ANULADA' END,
    prioridad = COALESCE(prioridad, 0),
    fecha_actualizacion = now()
WHERE id_tipo_beca IS NOT NULL
  AND (valor = 0 OR estado IS NULL);

ALTER TABLE public.becas
  ALTER COLUMN id_tipo_beca SET NOT NULL;

ALTER TABLE public.becas
  DROP CONSTRAINT IF EXISTS chk_beca_tipo;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_beca_tipo' AND conrelid = 'public.becas'::regclass
  ) THEN
    ALTER TABLE public.becas ADD CONSTRAINT fk_beca_tipo
      FOREIGN KEY (id_tipo_beca) REFERENCES public.tipos_beca(id_tipo_beca)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_beca_alcance' AND conrelid = 'public.becas'::regclass
  ) THEN
    ALTER TABLE public.becas ADD CONSTRAINT chk_beca_alcance
      CHECK (alcance IN ('MATRICULA','PENSION','AMBOS'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_beca_modalidad' AND conrelid = 'public.becas'::regclass
  ) THEN
    ALTER TABLE public.becas ADD CONSTRAINT chk_beca_modalidad
      CHECK (modalidad IN ('PORCENTAJE','MONTO_FIJO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_beca_valor' AND conrelid = 'public.becas'::regclass
  ) THEN
    ALTER TABLE public.becas ADD CONSTRAINT chk_beca_valor
      CHECK (valor >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_beca_estado' AND conrelid = 'public.becas'::regclass
  ) THEN
    ALTER TABLE public.becas ADD CONSTRAINT chk_beca_estado
      CHECK (estado IN ('SOLICITADA','APROBADA','RECHAZADA','ANULADA'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_beca_monto_maximo' AND conrelid = 'public.becas'::regclass
  ) THEN
    ALTER TABLE public.becas ADD CONSTRAINT chk_beca_monto_maximo
      CHECK (monto_maximo IS NULL OR monto_maximo >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_beca_aprobado_por' AND conrelid = 'public.becas'::regclass
  ) THEN
    ALTER TABLE public.becas ADD CONSTRAINT fk_beca_aprobado_por
      FOREIGN KEY (aprobado_por) REFERENCES public.usuarios(id_usuario)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_beca_creado_por' AND conrelid = 'public.becas'::regclass
  ) THEN
    ALTER TABLE public.becas ADD CONSTRAINT fk_beca_creado_por
      FOREIGN KEY (creado_por) REFERENCES public.usuarios(id_usuario)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_beca_tipo_estado
  ON public.becas (id_tipo_beca, estado, activo);
CREATE INDEX IF NOT EXISTS idx_beca_alumno_fechas
  ON public.becas (id_alumno, fecha_inicio, fecha_fin);

ALTER TABLE public.pre_tickets
  ADD COLUMN IF NOT EXISTS descuento numeric(10,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_preticket_descuento'
      AND conrelid = 'public.pre_tickets'::regclass
  ) THEN
    ALTER TABLE public.pre_tickets ADD CONSTRAINT chk_preticket_descuento
      CHECK (descuento >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_pension_montos'
      AND conrelid = 'public.pensiones'::regclass
  ) THEN
    ALTER TABLE public.pensiones ADD CONSTRAINT chk_pension_montos
      CHECK (
        monto_base > 0
        AND descuento >= 0
        AND monto_final >= 0
        AND descuento <= monto_base
      );
  END IF;
END $$;

-- EXONERADO: el cargo quedó en 0 por beca, sin pago que lo respalde.
ALTER TABLE public.pensiones
  DROP CONSTRAINT IF EXISTS chk_pension_estado;
ALTER TABLE public.pensiones ADD CONSTRAINT chk_pension_estado
  CHECK (estado IN ('PAGADO', 'PENDIENTE', 'ANULADO', 'EXONERADO'));

ALTER TABLE public.pre_tickets
  DROP CONSTRAINT IF EXISTS chk_preticket_estado;
ALTER TABLE public.pre_tickets ADD CONSTRAINT chk_preticket_estado
  CHECK (estado IN ('PENDIENTE', 'PAGADO', 'ANULADO', 'EXONERADO'));

CREATE TABLE IF NOT EXISTS public.aplicaciones_beca (
  id_aplicacion bigserial PRIMARY KEY,
  id_beca integer NOT NULL,
  id_pension integer,
  id_preticket integer,
  monto_aplicado numeric(10,2) NOT NULL,
  porcentaje_aplicado numeric(5,2),
  creado_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  creado_en timestamp NOT NULL DEFAULT now(),
  CONSTRAINT fk_aplicacion_beca
    FOREIGN KEY (id_beca) REFERENCES public.becas(id_beca) ON DELETE RESTRICT,
  CONSTRAINT fk_aplicacion_pension
    FOREIGN KEY (id_pension) REFERENCES public.pensiones(id_pension) ON DELETE CASCADE,
  CONSTRAINT fk_aplicacion_preticket
    FOREIGN KEY (id_preticket) REFERENCES public.pre_tickets(id_preticket) ON DELETE CASCADE,
  CONSTRAINT chk_aplicacion_destino CHECK (
    (id_pension IS NOT NULL)::int + (id_preticket IS NOT NULL)::int = 1
  ),
  CONSTRAINT chk_aplicacion_monto CHECK (monto_aplicado >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_aplicacion_beca_pension
  ON public.aplicaciones_beca (id_beca, id_pension)
  WHERE id_pension IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_aplicacion_beca_preticket
  ON public.aplicaciones_beca (id_beca, id_preticket)
  WHERE id_preticket IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aplicacion_pension
  ON public.aplicaciones_beca (id_pension);
CREATE INDEX IF NOT EXISTS idx_aplicacion_preticket
  ON public.aplicaciones_beca (id_preticket);

COMMENT ON TABLE public.tipos_beca IS
  'Catálogo editable de tipos de beca (alcance, modalidad, tope, combinación).';
COMMENT ON TABLE public.aplicaciones_beca IS
  'Detalle de cada beca aplicada a una pensión o pre-ticket.';
COMMENT ON COLUMN public.pre_tickets.descuento IS
  'Descuento aplicado por becas al pre-ticket (H78).';

COMMIT;

\echo 'H78 aplicada: tipos de beca, aplicación y descuento en pre-tickets.'
