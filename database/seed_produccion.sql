-- ============================================================
-- SIGA-UC — Seed de PRODUCCIÓN
-- Solo catálogos y configuración. CERO datos operativos:
-- sin alumnos, apoderados, pagos, pensiones, calificaciones,
-- asistencias, movimientos de caja, bitácora ni becas.
--
-- IMPORTANTE:
--   * Este archivo es SOLO para una base de producción nueva.
--   * NO combinarlo con database/siga_uc_completo.sql: ese dump es
--     de demostración (21 alumnos ficticios y ~146 pensiones marcadas
--     PAGADO sin pago que las respalde).
--   * Secuencia oficial de producción:
--       database/siga_uc.sql
--       database/seed_produccion.sql
--       database/migracion_h32_anulacion_pagos.sql
--       database/migracion_h10_h38_concurrencia_pagos.sql
--       database/migracion_h07_auditoria.sql
--
-- Uso:
--   psql -v admin_password="TuClaveTemporal" \
--        -f database/seed_produccion.sql
--
-- La contraseña se recibe como variable de psql y NUNCA se guarda
-- en el repositorio. Si falta o está vacía, el script aborta.
--
-- Administrador inicial:
--   DNI: 74829102
--   Contraseña: la definida en -v admin_password
--   requiere_cambio_password = TRUE
-- ============================================================

\set ON_ERROR_STOP on

\if :{?admin_password}
\else
  \echo 'ERROR: falta -v admin_password="TuClaveTemporal"'
  DO $$ BEGIN
    RAISE EXCEPTION 'Falta -v admin_password para crear el administrador inicial';
  END $$;
\endif

SELECT length(btrim(:'admin_password')) > 0 AS admin_password_ok \gset
\if :admin_password_ok
\else
  \echo 'ERROR: admin_password está vacío'
  DO $$ BEGIN
    RAISE EXCEPTION 'admin_password no puede estar vacío';
  END $$;
\endif

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- ============================================================
-- 1. Roles (4 filas, IDs estables)
-- ============================================================
INSERT INTO roles (id_rol, nombre_rol, descripcion) VALUES
  (1, 'ADMIN',      'Administrador General del sistema'),
  (2, 'DOCENTE',    'Docente de aula'),
  (3, 'SECRETARIA', 'Secretaría y Tesorería'),
  (4, 'ESTUDIANTE', 'Estudiante matriculado')
ON CONFLICT DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('roles', 'id_rol'),
  GREATEST((SELECT COALESCE(MAX(id_rol), 1) FROM roles), 1),
  true
);

-- ============================================================
-- 2. Grados del año lectivo en curso
-- ============================================================
INSERT INTO grados (nombre_grado, nivel, seccion, anio_lectivo)
SELECT v.nombre, 'SECUNDARIA', 'Única', a.anio
FROM (VALUES
  ('1ro de Secundaria'),
  ('2do de Secundaria'),
  ('3ro de Secundaria'),
  ('4to de Secundaria'),
  ('5to de Secundaria')
) AS v(nombre)
CROSS JOIN (SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS anio) a
ON CONFLICT (nombre_grado, seccion, anio_lectivo) DO NOTHING;

-- ============================================================
-- 3. Cursos (catálogo académico)
-- ============================================================
INSERT INTO cursos (nombre_curso, area_academica, horas_semanales) VALUES
  ('Aritmética',              'Matemáticas',        3),
  ('Álgebra',                 'Matemáticas',        3),
  ('Trigonometría',           'Matemáticas',        2),
  ('Geometría',               'Matemáticas',        2),
  ('Razonamiento Matemático', 'Matemáticas',        2),
  ('Comunicación',            'Lenguaje y Letras',  4),
  ('Razonamiento Verbal',     'Lenguaje y Letras',  2),
  ('Física',                  'Ciencias Naturales', 3),
  ('Química',                 'Ciencias Naturales', 3),
  ('Historia',                'Ciencias Sociales',  3),
  ('Geografía',               'Ciencias Sociales',  2)
ON CONFLICT (nombre_curso) DO NOTHING;

-- ============================================================
-- 4. Competencias MINEDU por curso
-- ============================================================
INSERT INTO competencias (id_curso, nombre_competencia, orden)
SELECT c.id_curso, v.competencia, v.orden
FROM (VALUES
  ('Aritmética', 'Resuelve problemas de cantidad', 1),
  ('Aritmética', 'Resuelve problemas de regularidad, equivalencia y cambio', 2),
  ('Aritmética', 'Resuelve problemas de forma, movimiento y localización', 3),
  ('Aritmética', 'Resuelve problemas de gestión de datos e incertidumbre', 4),
  ('Álgebra', 'Resuelve problemas de cantidad', 1),
  ('Álgebra', 'Resuelve problemas de regularidad, equivalencia y cambio', 2),
  ('Álgebra', 'Resuelve problemas de forma, movimiento y localización', 3),
  ('Álgebra', 'Resuelve problemas de gestión de datos e incertidumbre', 4),
  ('Trigonometría', 'Resuelve problemas de forma, movimiento y localización', 1),
  ('Trigonometría', 'Resuelve problemas de regularidad, equivalencia y cambio', 2),
  ('Geometría', 'Resuelve problemas de forma, movimiento y localización', 1),
  ('Geometría', 'Resuelve problemas de gestión de datos e incertidumbre', 2),
  ('Razonamiento Matemático', 'Resuelve problemas de cantidad', 1),
  ('Razonamiento Matemático', 'Resuelve problemas de regularidad, equivalencia y cambio', 2),
  ('Comunicación', 'Se comunica oralmente en su lengua materna', 1),
  ('Comunicación', 'Lee diversos tipos de textos escritos', 2),
  ('Comunicación', 'Escribe diversos tipos de textos', 3),
  ('Razonamiento Verbal', 'Lee diversos tipos de textos escritos', 1),
  ('Razonamiento Verbal', 'Escribe diversos tipos de textos', 2),
  ('Física', 'Indaga mediante métodos científicos', 1),
  ('Física', 'Explica el mundo físico basándose en conocimientos', 2),
  ('Física', 'Diseña y construye soluciones tecnológicas', 3),
  ('Química', 'Indaga mediante métodos científicos', 1),
  ('Química', 'Explica el mundo físico basándose en conocimientos', 2),
  ('Química', 'Diseña y construye soluciones tecnológicas', 3),
  ('Historia', 'Construye interpretaciones históricas', 1),
  ('Historia', 'Gestiona responsablemente el espacio y el ambiente', 2),
  ('Geografía', 'Gestiona responsablemente el espacio y el ambiente', 1),
  ('Geografía', 'Gestiona responsablemente los recursos económicos', 2)
) AS v(curso, competencia, orden)
INNER JOIN cursos c ON c.nombre_curso = v.curso
WHERE NOT EXISTS (
  SELECT 1 FROM competencias co
  WHERE co.id_curso = c.id_curso
    AND co.nombre_competencia = v.competencia
);

-- ============================================================
-- 5. Escala de calificación MINEDU
-- ============================================================
INSERT INTO escala_calificacion (codigo, descripcion, orden) VALUES
  ('AD', 'Logro Destacado', 1),
  ('A',  'Logro Esperado', 2),
  ('B',  'En Proceso', 3),
  ('C',  'En Inicio', 4)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- 6. Conceptos de pago del año lectivo en curso
--    (matrícula + pensiones marzo-diciembre)
-- ============================================================
INSERT INTO conceptos_pago (nombre, monto_base, tipo, mes, anio_lectivo)
SELECT v.nombre || ' ' || a.anio, v.monto, v.tipo, v.mes, a.anio
FROM (VALUES
  ('Matrícula Escolar', 250.00, 'MATRICULA', NULL::int),
  ('Pensión Marzo',      250.00, 'PENSION', 3),
  ('Pensión Abril',      250.00, 'PENSION', 4),
  ('Pensión Mayo',       250.00, 'PENSION', 5),
  ('Pensión Junio',      250.00, 'PENSION', 6),
  ('Pensión Julio',      250.00, 'PENSION', 7),
  ('Pensión Agosto',     250.00, 'PENSION', 8),
  ('Pensión Setiembre',  250.00, 'PENSION', 9),
  ('Pensión Octubre',    250.00, 'PENSION', 10),
  ('Pensión Noviembre',  250.00, 'PENSION', 11),
  ('Pensión Diciembre',  250.00, 'PENSION', 12)
) AS v(nombre, monto, tipo, mes)
CROSS JOIN (SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS anio) a
WHERE NOT EXISTS (
  SELECT 1 FROM conceptos_pago cp
  WHERE cp.anio_lectivo = a.anio
    AND cp.tipo = v.tipo
    AND cp.mes IS NOT DISTINCT FROM v.mes
);

-- ============================================================
-- 7. Usuario ADMIN inicial
--    - correo_personal NULL (el esquema lo permite)
--    - requiere_cambio_password = TRUE
--    - contraseña recibida por -v admin_password
-- ============================================================
INSERT INTO usuarios (
  dni, nombres, apellidos, correo_institucional, correo_personal,
  password_hash, telefono, id_rol, estado, requiere_cambio_password
) VALUES (
  '74829102',
  'Administrador',
  'SIGA-UC',
  'admin@unioncientifica.edu.pe',
  NULL,
  crypt(:'admin_password', gen_salt('bf', 10)),
  NULL,
  1,
  'ACTIVO',
  TRUE
)
ON CONFLICT (dni) DO NOTHING;

-- ============================================================
-- 8. Ficha personal mínima del administrador
--    La carga curricular exige id_personal (NOT NULL). Se usa al
--    administrador como responsable inicial; al crear docentes
--    reales, reasignar la carga desde el módulo correspondiente.
-- ============================================================
INSERT INTO personal (id_usuario, especialidad, cargo, fecha_ingreso)
SELECT u.id_usuario, NULL, 'Administrador', CURRENT_DATE
FROM usuarios u
WHERE u.dni = '74829102'
  AND NOT EXISTS (
    SELECT 1 FROM personal p WHERE p.id_usuario = u.id_usuario
  );

-- ============================================================
-- 9. Carga curricular base del año en curso
--    Se asigna al administrador solo como valor inicial. No crea
--    usuarios docentes ni datos de alumnos.
-- ============================================================
INSERT INTO carga_curricular (
  id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas
)
SELECT
  g.id_grado,
  c.id_curso,
  (
    SELECT p.id_personal
    FROM personal p
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    WHERE u.dni = '74829102'
    ORDER BY p.id_personal
    LIMIT 1
  ),
  EXTRACT(YEAR FROM CURRENT_DATE)::int,
  c.horas_semanales
FROM grados g
CROSS JOIN cursos c
WHERE g.anio_lectivo = EXTRACT(YEAR FROM CURRENT_DATE)::int
  AND EXISTS (
    SELECT 1
    FROM personal p
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    WHERE u.dni = '74829102'
  )
ON CONFLICT (id_grado, id_curso, anio_lectivo) DO NOTHING;

-- ============================================================
-- 10. Malla de períodos de clase (H47)
--     Solo se inserta si el año en curso no tiene malla.
-- ============================================================
DO $$
DECLARE
  v_anio integer := EXTRACT(YEAR FROM CURRENT_DATE)::int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM periodos_clase WHERE anio_lectivo = v_anio
  ) THEN
    INSERT INTO periodos_clase
      (anio_lectivo, nombre, orden, hora_inicio, hora_fin, tipo, activo)
    VALUES
      (v_anio, '1ra hora',  1, '07:30', '08:15', 'CLASE',   true),
      (v_anio, '2da hora',  2, '08:15', '09:00', 'CLASE',   true),
      (v_anio, 'Receso',    3, '09:00', '09:30', 'RECREO',  true),
      (v_anio, '3ra hora',  4, '09:30', '10:15', 'CLASE',   true),
      (v_anio, '4ta hora',  5, '10:15', '11:00', 'CLASE',   true),
      (v_anio, '5ta hora',  6, '11:00', '11:45', 'CLASE',   true),
      (v_anio, '6ta hora',  7, '11:45', '12:30', 'CLASE',   true),
      (v_anio, 'Almuerzo',  8, '12:30', '13:00', 'ALMUERZO', true),
      (v_anio, '7ma hora',  9, '13:00', '13:45', 'CLASE',   true),
      (v_anio, '8va hora', 10, '13:45', '14:30', 'CLASE',   true);
  END IF;
END $$;

-- ============================================================
-- 11. Caja principal (cerrada; se apertura desde la UI)
-- ============================================================
INSERT INTO cajas (nombre_caja, responsable, estado)
SELECT 'Caja Principal', u.id_usuario, 'CERRADA'
FROM usuarios u
WHERE u.dni = '74829102'
  AND NOT EXISTS (
    SELECT 1 FROM cajas WHERE nombre_caja = 'Caja Principal'
  );

-- ============================================================
-- 12. Conclusiones descriptivas
--    NO se siembran: la tabla depende de id_alumno y es un dato
--    operativo, no un catálogo MINEDU. Queda vacía a propósito.
-- ============================================================

COMMIT;

\echo 'Seed de producción aplicado: catálogos, admin inicial y caja principal.'
