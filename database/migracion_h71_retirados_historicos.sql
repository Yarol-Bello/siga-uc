-- ============================================================
-- SIGA-UC — H71: backfill de retirados históricos
-- ============================================================
-- Objetivo:
--   1. Todo alumno con estado_matricula = 'Retirado' tiene su
--      expediente_alumno.congelado = TRUE.
--   2. El usuario asociado queda INACTIVO solo si no conserva otra
--      matrícula no retirada (por ejemplo, otro año lectivo).
--
-- No toca alumnos no retirados. Es idempotente: se puede ejecutar
-- varias veces sin duplicar filas ni cambiar resultados.
--
-- Solo se aplica con backup previo. No ejecutar rollbacks automáticos.
-- ============================================================

BEGIN;

-- 1. Crear expediente congelado si un retirado histórico no tiene uno.
INSERT INTO expediente_alumno (id_alumno, nivel_logro_actual, asistencia_acumulada, congelado)
SELECT a.id_alumno, NULL, 0, TRUE
FROM alumnos a
WHERE a.estado_matricula = 'Retirado'
  AND NOT EXISTS (
    SELECT 1
    FROM expediente_alumno e
    WHERE e.id_alumno = a.id_alumno
  );

-- 2. Congelar el expediente de todos los retirados.
UPDATE expediente_alumno e
SET congelado = TRUE
FROM alumnos a
WHERE e.id_alumno = a.id_alumno
  AND a.estado_matricula = 'Retirado'
  AND e.congelado IS DISTINCT FROM TRUE;

-- 3. Desactivar usuarios cuyas únicas matrículas son retiradas.
--    Si el usuario tiene otra matrícula vigente (no retirada), se respeta
--    su estado actual: puede seguir usando el sistema en el año nuevo.
UPDATE usuarios u
SET estado = 'INACTIVO'
WHERE u.estado = 'ACTIVO'
  AND u.id_rol = 4
  AND EXISTS (
    SELECT 1
    FROM alumnos a
    WHERE a.id_usuario = u.id_usuario
      AND a.estado_matricula = 'Retirado'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM alumnos a
    WHERE a.id_usuario = u.id_usuario
      AND a.estado_matricula <> 'Retirado'
  );

-- 4. Resumen para el operador (sin datos personales).
DO $$
DECLARE
  v_retirados integer;
  v_expedientes_congelados integer;
  v_usuarios_inactivos integer;
BEGIN
  SELECT COUNT(*) INTO v_retirados
  FROM alumnos
  WHERE estado_matricula = 'Retirado';

  SELECT COUNT(*) INTO v_expedientes_congelados
  FROM expediente_alumno e
  INNER JOIN alumnos a ON a.id_alumno = e.id_alumno
  WHERE a.estado_matricula = 'Retirado'
    AND e.congelado = TRUE;

  SELECT COUNT(*) INTO v_usuarios_inactivos
  FROM usuarios u
  WHERE u.estado = 'INACTIVO'
    AND u.id_rol = 4
    AND EXISTS (
      SELECT 1 FROM alumnos a
      WHERE a.id_usuario = u.id_usuario
        AND a.estado_matricula = 'Retirado'
    );

  RAISE NOTICE 'H71: % matrículas retiradas, % expedientes congelados, % usuarios inactivos con retiro.',
    v_retirados, v_expedientes_congelados, v_usuarios_inactivos;
END
$$;

COMMIT;
