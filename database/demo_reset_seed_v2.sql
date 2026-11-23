-- ============================================================
-- Demo v2 — limpieza de datos para re-sembrar con `npm run uat:seed`
-- SIGA-UC · SOLO DEMO · NO EJECUTAR EN PRODUCCIÓN REAL
-- ============================================================
-- Conserva:
--   - configuración institucional, años lectivos, grados, cursos, áreas,
--     competencias, conceptos/tarifas, carga curricular y cajas;
--   - usuarios ADMIN, DOCENTE y SECRETARIA (el seed reutiliza docentes);
--   - actas bimestrales y políticas de promoción.
--
-- Elimina alumnos, apoderados, matrículas, pagos, pensiones, pre-tickets,
-- notas, asistencia, conclusiones, horarios, tutores, becas, notificaciones,
-- auditoría y los usuarios ESTUDIANTE.
--
-- Uso previsto (con backup y el backend apuntando a la base demo):
--   psql "$DATABASE_URL" -f database/demo_reset_seed_v2.sql
--   npm run uat:seed   (con UAT_BASE_URL, UAT_DATABASE_URL y UAT_ADMIN_PASSWORD)
-- ============================================================

BEGIN;

-- 1. Dependencias de estudiantes y tesorería.
DELETE FROM exportaciones_siagie;
DELETE FROM conclusiones_descriptivas;
DELETE FROM calificaciones;
DELETE FROM notas_finales_area;
DELETE FROM asistencia_alumnos;
DELETE FROM horarios;
DELETE FROM tutores_grado;
DELETE FROM aplicaciones_beca;
DELETE FROM becas;
DELETE FROM boletas_electronicas;
DELETE FROM movimientos_caja;
DELETE FROM cierres_caja;
DELETE FROM pagos;
DELETE FROM aperturas_caja;
DELETE FROM pre_tickets;
DELETE FROM pensiones;
DELETE FROM promociones;
DELETE FROM expediente_alumno;
DELETE FROM notificaciones;

-- 2. Alumnos y apoderados.
DELETE FROM alumnos;
DELETE FROM apoderados;

-- 3. Usuarios ESTUDIANTE y sus credenciales.
DELETE FROM credenciales_qr
WHERE id_usuario IN (SELECT id_usuario FROM usuarios WHERE id_rol = 4);
DELETE FROM usuarios WHERE id_rol = 4;

-- 4. Catálogo de becas de la demo (el seed lo vuelve a crear).
DELETE FROM tipos_beca WHERE codigo LIKE 'UAT%';

-- 5. Bitácora de la demo anterior.
DELETE FROM bitacora_auditoria;

COMMIT;

-- Después de este script, ejecutar `npm run uat:seed`.
-- El seed crea 75 alumnos, 432 pagos, 750 pensiones, notas, asistencia,
-- horarios, tutores y becas. No vuelve a crear ADMIN/DOCENTE/SECRETARIA.
