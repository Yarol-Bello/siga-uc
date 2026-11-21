-- ============================================================
-- H45 — Pensiones anuladas al retirar alumnos
-- Migración idempotente.
--
-- Agrega el estado ANULADO a pensiones y regulariza a los alumnos
-- ya retirados que conservaron deuda de meses posteriores al retiro.
-- La pensión del mes de retiro no se toca.
-- ============================================================

BEGIN;

ALTER TABLE pensiones DROP CONSTRAINT IF EXISTS chk_pension_estado;
ALTER TABLE pensiones ADD CONSTRAINT chk_pension_estado
  CHECK (estado IN ('PAGADO', 'PENDIENTE', 'ANULADO'));

UPDATE pensiones p
SET estado = 'ANULADO'
FROM alumnos a
WHERE p.id_alumno = a.id_alumno
  AND a.estado_matricula = 'Retirado'
  AND a.fecha_retiro IS NOT NULL
  AND p.anio_lectivo = a.anio_lectivo
  AND p.estado = 'PENDIENTE'
  AND p.mes > EXTRACT(MONTH FROM a.fecha_retiro)::int;

COMMIT;
