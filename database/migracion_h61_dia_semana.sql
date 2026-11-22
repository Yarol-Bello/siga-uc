-- ============================================================
-- H61 — Normalizar dia_semana de asistencia_alumnos
-- SIGA-UC - Sistema Integrado de Gestión Académica
--
-- Corrige las filas históricas que quedaron en inglés o desfasadas por
-- interpretar la fecha como UTC. No cambia el esquema.
--
-- Es idempotente: si dia_semana ya coincide con la fecha, no actualiza nada.
-- Ejecutar con:
--   psql -U postgres -d siga_uc -f database/migracion_h61_dia_semana.sql
-- ============================================================

BEGIN;

DO $$
DECLARE
  actualizados INTEGER;
BEGIN
  WITH normalizados AS (
    SELECT
      id_asistencia,
      CASE EXTRACT(ISODOW FROM fecha)
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
        WHEN 7 THEN 'Domingo'
      END AS dia_semana_correcto
    FROM asistencia_alumnos
  )
  UPDATE asistencia_alumnos a
  SET dia_semana = n.dia_semana_correcto
  FROM normalizados n
  WHERE a.id_asistencia = n.id_asistencia
    AND a.dia_semana IS DISTINCT FROM n.dia_semana_correcto;

  GET DIAGNOSTICS actualizados = ROW_COUNT;
  RAISE NOTICE 'H61: % fila(s) de asistencia_alumnos normalizadas.', actualizados;
END $$;

COMMIT;
