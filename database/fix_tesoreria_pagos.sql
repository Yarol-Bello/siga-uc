-- ============================================================
-- SIGA-UC — Corrección de Tesorería / Caja
-- 1. El trigger de pagos imputa a la caja ABIERTA, no a la última.
-- 2. Genera pre-tickets de matrícula para alumnos PendientePago
--    que fueron creados antes de este cambio.
--
-- Ejecutar una vez sobre la base existente. No elimina datos.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_pago_a_caja() RETURNS trigger
    LANGUAGE plpgsql
AS $$
DECLARE
    v_apertura INT;
BEGIN
    SELECT ap.id_apertura INTO v_apertura
    FROM public.aperturas_caja ap
    WHERE NOT EXISTS (
        SELECT 1 FROM public.cierres_caja cc
        WHERE cc.id_apertura = ap.id_apertura
    )
    ORDER BY ap.fecha_apertura DESC
    LIMIT 1;

    IF v_apertura IS NOT NULL THEN
        INSERT INTO public.movimientos_caja (
            id_apertura, id_pago, tipo, concepto, monto, medio_pago, id_usuario
        ) VALUES (
            v_apertura, NEW.id_pago, 'INGRESO',
            'Cobro registrado - Pago ID ' || NEW.id_pago,
            NEW.monto, NEW.forma_pago, NEW.id_usuario_cobrador
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Crear pre-tickets pendientes para matrículas ya existentes.
WITH concepto_matricula AS (
    SELECT id_concepto, monto_base, anio_lectivo
    FROM public.conceptos_pago
    WHERE tipo = 'MATRICULA'
),
pendientes AS (
    SELECT DISTINCT ON (a.id_alumno)
        a.id_alumno,
        cm.id_concepto,
        cm.monto_base
    FROM public.alumnos a
    INNER JOIN concepto_matricula cm
        ON cm.anio_lectivo = a.anio_lectivo
    WHERE a.estado_matricula = 'PendientePago'
    ORDER BY a.id_alumno, cm.id_concepto
)
INSERT INTO public.pre_tickets (
    id_alumno, id_concepto, monto, estado, id_usuario_emite
)
SELECT
    p.id_alumno,
    p.id_concepto,
    p.monto_base,
    'PENDIENTE',
    NULL
FROM pendientes p
WHERE NOT EXISTS (
    SELECT 1
    FROM public.pre_tickets pt
    WHERE pt.id_alumno = p.id_alumno
      AND pt.id_concepto = p.id_concepto
);

COMMIT;
