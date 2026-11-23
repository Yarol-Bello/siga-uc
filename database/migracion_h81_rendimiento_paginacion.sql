-- ============================================================
-- H81 — Índices de rendimiento para padrones y paginación
-- SIGA-UC · demo · idempotente
-- ============================================================
-- No crea tablas ni modifica datos. Solo agrega índices para que:
--   - el padrón de pensiones pagine y filtre en una sola consulta;
--   - la caja cargue los últimos pagos sin recorrer toda la tabla;
--   - personal y alumnos busquen/ordenen sin scans completos.
--
-- Aplicar después de H80:
--   psql -U postgres -d siga_uc -f database/migracion_h81_rendimiento_paginacion.sql
-- ============================================================

BEGIN;

-- Pensiones: padrón por año/alumno/mes y conteo de pendientes.
CREATE INDEX IF NOT EXISTS idx_pensiones_anio_alumno_mes
  ON pensiones (anio_lectivo, id_alumno, mes);

CREATE INDEX IF NOT EXISTS idx_pensiones_anio_estado
  ON pensiones (anio_lectivo, estado);

-- Pagos: historial de caja y filtros por alumno/fecha.
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago
  ON pagos (fecha_pago DESC);

CREATE INDEX IF NOT EXISTS idx_pagos_alumno
  ON pagos (id_alumno);

-- Alumnos: padrón por año y orden alfabético.
CREATE INDEX IF NOT EXISTS idx_alumnos_anio_grado_nombre
  ON alumnos (anio_lectivo, id_grado, apellidos, nombres);

CREATE INDEX IF NOT EXISTS idx_alumnos_anio_estado
  ON alumnos (anio_lectivo, estado_matricula);

-- Personal/usuarios: relación y orden de la tabla ADMIN.
CREATE INDEX IF NOT EXISTS idx_personal_usuario
  ON personal (id_usuario);

CREATE INDEX IF NOT EXISTS idx_usuarios_apellidos_nombres
  ON usuarios (apellidos, nombres);

-- Pre-tickets pendientes por estado/alumno.
CREATE INDEX IF NOT EXISTS idx_pre_tickets_estado_alumno
  ON pre_tickets (estado, id_alumno);

COMMIT;

-- Rollback (solo bases desechables):
-- DROP INDEX IF EXISTS idx_pensiones_anio_alumno_mes;
-- DROP INDEX IF EXISTS idx_pensiones_anio_estado;
-- DROP INDEX IF EXISTS idx_pagos_fecha_pago;
-- DROP INDEX IF EXISTS idx_pagos_alumno;
-- DROP INDEX IF EXISTS idx_alumnos_anio_grado_nombre;
-- DROP INDEX IF EXISTS idx_alumnos_anio_estado;
-- DROP INDEX IF EXISTS idx_personal_usuario;
-- DROP INDEX IF EXISTS idx_usuarios_apellidos_nombres;
-- DROP INDEX IF EXISTS idx_pre_tickets_estado_alumno;
