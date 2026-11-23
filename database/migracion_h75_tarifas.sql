-- ============================================================
-- H75 / Fase 2 — Tarifas y conceptos de pago configurables
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Agrega alcance (nivel/grado), vigencia, estado y orden a conceptos_pago,
-- crea la función de resolución de tarifas y vincula pensiones con su
-- concepto. No reprecisa pagos, pensiones ni pre-tickets existentes.
--
-- Requiere H49 y H74. Idempotente.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Preflight
-- ------------------------------------------------------------
DO $$
DECLARE
  v_dup text;
  v_monto integer;
  v_mes integer;
BEGIN
  IF to_regclass('public.conceptos_pago') IS NULL
     OR to_regclass('public.grados') IS NULL
     OR to_regclass('public.pensiones') IS NULL
     OR to_regclass('public.pre_tickets') IS NULL
     OR to_regclass('public.pagos') IS NULL THEN
    RAISE EXCEPTION 'H75 requiere el esquema base de conceptos, grados, pensiones, pre_tickets y pagos.';
  END IF;

  SELECT string_agg(
           anio_lectivo || '/' || tipo || '/' || COALESCE(mes::text, 'NULL'),
           ', '
         )
    INTO v_dup
  FROM (
    SELECT anio_lectivo, tipo, mes, COUNT(*) AS total
    FROM public.conceptos_pago
    WHERE tipo IN ('MATRICULA', 'PENSION')
    GROUP BY anio_lectivo, tipo, mes
    HAVING COUNT(*) > 1
  ) q;

  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'H75: hay conceptos duplicados por año/tipo/mes: %', v_dup;
  END IF;

  SELECT string_agg(anio_lectivo || '/' || nombre, ', ')
    INTO v_dup
  FROM (
    SELECT anio_lectivo, nombre, COUNT(*) AS total
    FROM public.conceptos_pago
    WHERE tipo = 'OTROS'
    GROUP BY anio_lectivo, nombre
    HAVING COUNT(*) > 1
  ) q;

  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'H75: hay conceptos OTROS duplicados por año/nombre: %', v_dup;
  END IF;

  SELECT COUNT(*)::int INTO v_monto
  FROM public.conceptos_pago
  WHERE monto_base <= 0;

  IF v_monto > 0 THEN
    RAISE EXCEPTION 'H75: hay % concepto(s) con monto_base <= 0', v_monto;
  END IF;

  SELECT COUNT(*)::int INTO v_mes
  FROM public.conceptos_pago
  WHERE tipo = 'PENSION' AND mes IS NULL;

  IF v_mes > 0 THEN
    RAISE EXCEPTION 'H75: hay % concepto(s) PENSION sin mes', v_mes;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. Columnas de alcance, vigencia y estado
-- ------------------------------------------------------------
ALTER TABLE public.conceptos_pago
  ADD COLUMN IF NOT EXISTS nivel varchar(20),
  ADD COLUMN IF NOT EXISTS id_grado integer,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS descripcion varchar(250),
  ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vigente_desde date,
  ADD COLUMN IF NOT EXISTS vigente_hasta date,
  ADD COLUMN IF NOT EXISTS creado_por integer,
  ADD COLUMN IF NOT EXISTS actualizado_por integer,
  ADD COLUMN IF NOT EXISTS fecha_creacion timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fecha_actualizacion timestamp NOT NULL DEFAULT now();

UPDATE public.conceptos_pago
SET vigente_desde = make_date(anio_lectivo, 1, 1)
WHERE vigente_desde IS NULL;

UPDATE public.conceptos_pago
SET orden = id_concepto
WHERE orden = 0;

ALTER TABLE public.conceptos_pago
  ALTER COLUMN vigente_desde SET NOT NULL,
  ALTER COLUMN vigente_desde SET DEFAULT CURRENT_DATE;

-- ------------------------------------------------------------
-- 2. FKs y checks idempotentes
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_concepto_pago_grado'
      AND conrelid = 'public.conceptos_pago'::regclass
  ) THEN
    ALTER TABLE public.conceptos_pago
      ADD CONSTRAINT fk_concepto_pago_grado
      FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_concepto_pago_creado_por'
      AND conrelid = 'public.conceptos_pago'::regclass
  ) THEN
    ALTER TABLE public.conceptos_pago
      ADD CONSTRAINT fk_concepto_pago_creado_por
      FOREIGN KEY (creado_por) REFERENCES public.usuarios(id_usuario)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_concepto_pago_actualizado_por'
      AND conrelid = 'public.conceptos_pago'::regclass
  ) THEN
    ALTER TABLE public.conceptos_pago
      ADD CONSTRAINT fk_concepto_pago_actualizado_por
      FOREIGN KEY (actualizado_por) REFERENCES public.usuarios(id_usuario)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_concepto_pago_monto'
      AND conrelid = 'public.conceptos_pago'::regclass
  ) THEN
    ALTER TABLE public.conceptos_pago
      ADD CONSTRAINT chk_concepto_pago_monto CHECK (monto_base > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_concepto_pago_vigencia'
      AND conrelid = 'public.conceptos_pago'::regclass
  ) THEN
    ALTER TABLE public.conceptos_pago
      ADD CONSTRAINT chk_concepto_pago_vigencia CHECK (
        vigente_hasta IS NULL OR vigente_hasta >= vigente_desde
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_concepto_pago_alcance'
      AND conrelid = 'public.conceptos_pago'::regclass
  ) THEN
    ALTER TABLE public.conceptos_pago
      ADD CONSTRAINT chk_concepto_pago_alcance CHECK (
        nivel IS NULL OR id_grado IS NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_concepto_pago_pension_mes'
      AND conrelid = 'public.conceptos_pago'::regclass
  ) THEN
    ALTER TABLE public.conceptos_pago
      ADD CONSTRAINT chk_concepto_pago_pension_mes CHECK (
        tipo <> 'PENSION' OR mes BETWEEN 1 AND 12
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_concepto_pago_orden'
      AND conrelid = 'public.conceptos_pago'::regclass
  ) THEN
    ALTER TABLE public.conceptos_pago
      ADD CONSTRAINT chk_concepto_pago_orden CHECK (orden >= 0);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Unicidad de versiones abiertas
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_concepto_base_abierto
  ON public.conceptos_pago (anio_lectivo, tipo, mes, nivel, id_grado)
  NULLS NOT DISTINCT
  WHERE activo AND vigente_hasta IS NULL
    AND tipo IN ('MATRICULA', 'PENSION');

CREATE UNIQUE INDEX IF NOT EXISTS uq_concepto_otros_abierto
  ON public.conceptos_pago (anio_lectivo, nombre, nivel, id_grado)
  NULLS NOT DISTINCT
  WHERE activo AND vigente_hasta IS NULL
    AND tipo = 'OTROS';

CREATE INDEX IF NOT EXISTS idx_concepto_pago_anio_tipo
  ON public.conceptos_pago (anio_lectivo, tipo, mes, activo);

-- ------------------------------------------------------------
-- 4. Validación de alcance/año
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_concepto_pago_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_anio integer;
  v_nivel varchar(20);
BEGIN
  IF NEW.vigente_desde IS NULL THEN
    RAISE EXCEPTION 'La fecha de vigencia inicial es obligatoria.';
  END IF;

  IF NEW.vigente_hasta IS NOT NULL AND NEW.vigente_hasta < NEW.vigente_desde THEN
    RAISE EXCEPTION 'La vigencia final no puede ser anterior a la inicial.';
  END IF;

  IF NEW.tipo = 'PENSION' AND NEW.mes IS NULL THEN
    RAISE EXCEPTION 'El concepto PENSION debe tener un mes entre 1 y 12.';
  END IF;

  IF NEW.id_grado IS NOT NULL THEN
    SELECT g.anio_lectivo, g.nivel
      INTO v_anio, v_nivel
    FROM public.grados g
    WHERE g.id_grado = NEW.id_grado;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El grado % no existe.', NEW.id_grado;
    END IF;
    IF v_anio <> NEW.anio_lectivo THEN
      RAISE EXCEPTION 'El grado % pertenece al año %, no al año %.',
        NEW.id_grado, v_anio, NEW.anio_lectivo;
    END IF;
  END IF;

  IF NEW.nivel IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.grados g
      WHERE g.anio_lectivo = NEW.anio_lectivo
        AND g.nivel = NEW.nivel
    ) THEN
      RAISE EXCEPTION 'El nivel "%" no existe en el año %.',
        NEW.nivel, NEW.anio_lectivo;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concepto_pago_validar ON public.conceptos_pago;
CREATE TRIGGER trg_concepto_pago_validar
BEFORE INSERT OR UPDATE ON public.conceptos_pago
FOR EACH ROW
EXECUTE FUNCTION public.trg_concepto_pago_validar();

-- ------------------------------------------------------------
-- 5. Función de resolución de tarifa
--    Precedencia: grado > nivel > global. Vigencia por fecha.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolver_concepto_pago(
  p_anio integer,
  p_tipo varchar,
  p_mes integer,
  p_id_grado integer,
  p_fecha date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  id_concepto integer,
  nombre varchar,
  monto_base numeric,
  tipo varchar,
  mes integer,
  nivel varchar,
  id_grado integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id_concepto,
    c.nombre,
    c.monto_base,
    c.tipo,
    c.mes,
    c.nivel,
    c.id_grado
  FROM public.conceptos_pago c
  LEFT JOIN public.grados g
    ON g.id_grado = p_id_grado
   AND g.anio_lectivo = p_anio
  WHERE c.anio_lectivo = p_anio
    AND c.tipo = p_tipo
    AND c.mes IS NOT DISTINCT FROM p_mes
    AND c.activo = true
    AND c.vigente_desde <= COALESCE(p_fecha, CURRENT_DATE)
    AND (c.vigente_hasta IS NULL OR c.vigente_hasta >= COALESCE(p_fecha, CURRENT_DATE))
    AND (
      (c.id_grado IS NOT NULL AND c.id_grado = p_id_grado)
      OR (c.id_grado IS NULL AND c.nivel IS NOT NULL AND g.nivel = c.nivel)
      OR (c.id_grado IS NULL AND c.nivel IS NULL)
    )
  ORDER BY
    (c.id_grado IS NOT NULL) DESC,
    (c.nivel IS NOT NULL) DESC,
    c.id_concepto
  LIMIT 1
$$;

-- ------------------------------------------------------------
-- 6. Trazabilidad del concepto en pensiones
-- ------------------------------------------------------------
ALTER TABLE public.pensiones
  ADD COLUMN IF NOT EXISTS id_concepto integer;

UPDATE public.pensiones p
SET id_concepto = (
  SELECT c.id_concepto
  FROM public.conceptos_pago c
  WHERE c.anio_lectivo = p.anio_lectivo
    AND c.tipo = 'PENSION'
    AND c.mes = p.mes
    AND c.nivel IS NULL
    AND c.id_grado IS NULL
  ORDER BY c.id_concepto
  LIMIT 1
)
WHERE p.id_concepto IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_pension_concepto'
      AND conrelid = 'public.pensiones'::regclass
  ) THEN
    ALTER TABLE public.pensiones
      ADD CONSTRAINT fk_pension_concepto
      FOREIGN KEY (id_concepto) REFERENCES public.conceptos_pago(id_concepto)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pension_concepto
  ON public.pensiones (id_concepto);

COMMENT ON FUNCTION public.resolver_concepto_pago(integer, varchar, integer, integer, date) IS
  'Resuelve la tarifa vigente por año, tipo, mes, grado y fecha. Precedencia grado > nivel > global.';
COMMENT ON COLUMN public.pensiones.id_concepto IS
  'Concepto de tarifa usado al generar la pensión (H75).';

COMMIT;

\echo 'H75 aplicada: tarifas con alcance/vigencia, resolución y trazabilidad en pensiones.'
