-- ============================================================
-- H10 / H38 — Integridad y concurrencia de numeraciones y pagos
-- Migración idempotente para bases existentes.
--
-- 1) UNIQUE (serie, numero) en boletas_electronicas, solo si no hay
--    combinaciones duplicadas.
-- 2) Índice único parcial ux_pago_pension_activo, solo si no hay
--    pensiones con más de un pago PAGADO.
--
-- Si existen duplicados, la migración NO crea el objeto y emite un NOTICE.
-- ============================================================

BEGIN;

DO $$
DECLARE
  duplicados integer;
BEGIN
  SELECT COUNT(*) INTO duplicados
  FROM (
    SELECT serie, numero
    FROM public.boletas_electronicas
    GROUP BY serie, numero
    HAVING COUNT(*) > 1
  ) d;

  IF duplicados > 0 THEN
    RAISE NOTICE 'No se creó UNIQUE (serie, numero): % combinación(es) duplicada(s)', duplicados;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'boletas_serie_numero_key'
      AND conrelid = 'public.boletas_electronicas'::regclass
  ) THEN
    ALTER TABLE public.boletas_electronicas
      ADD CONSTRAINT boletas_serie_numero_key UNIQUE (serie, numero);
  END IF;
END $$;

DO $$
DECLARE
  duplicados integer;
BEGIN
  SELECT COUNT(*) INTO duplicados
  FROM (
    SELECT id_pension
    FROM public.pagos
    WHERE estado = 'PAGADO' AND id_pension IS NOT NULL
    GROUP BY id_pension
    HAVING COUNT(*) > 1
  ) d;

  IF duplicados > 0 THEN
    RAISE NOTICE 'No se creó ux_pago_pension_activo: % pensión(es) con pagos PAGADO duplicados', duplicados;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_pago_pension_activo ON public.pagos (id_pension) WHERE estado = ''PAGADO'' AND id_pension IS NOT NULL';
  END IF;
END $$;

COMMIT;
