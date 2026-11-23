/**
 * DAO de primera configuración del sistema (H79 / Fase 7)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

const ejecutar = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

const contarAdmins = async (client = null) => {
  const result = await ejecutar(
    client,
    `SELECT COUNT(*)::int AS total
     FROM usuarios u
     INNER JOIN roles r ON r.id_rol = u.id_rol
     WHERE r.nombre_rol = 'ADMIN'`,
  );
  return Number(result.rows[0]?.total || 0);
};

const obtenerEstado = async (client = null) => {
  const result = await ejecutar(
    client,
    `SELECT
       c.setup_completado,
       c.setup_completado_en,
       (SELECT COUNT(*)::int
        FROM usuarios u
        INNER JOIN roles r ON r.id_rol = u.id_rol
        WHERE r.nombre_rol = 'ADMIN') AS admins
     FROM configuracion_institucional c
     WHERE c.id_configuracion = 1`,
  );
  return result.rows[0] || null;
};

const obtenerConfiguracionParaSetup = async (client) => {
  const result = await client.query(
    `SELECT *
     FROM configuracion_institucional
     WHERE id_configuracion = 1
     FOR UPDATE`,
  );
  return result.rows[0] || null;
};

const asegurarRoles = async (client) => {
  await client.query(
    `INSERT INTO roles (id_rol, nombre_rol, descripcion) VALUES
       (1, 'ADMIN', 'Administrador General del sistema'),
       (2, 'DOCENTE', 'Docente de aula'),
       (3, 'SECRETARIA', 'Secretaría y Tesorería'),
       (4, 'ESTUDIANTE', 'Estudiante matriculado')
     ON CONFLICT (nombre_rol) DO NOTHING`,
  );
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence('roles', 'id_rol'),
       GREATEST((SELECT COALESCE(MAX(id_rol), 1) FROM roles), 1),
       true
     )`,
  );
};

const asegurarEscala = async (client) => {
  await client.query(
    `INSERT INTO escala_calificacion (codigo, descripcion, orden) VALUES
       ('AD', 'Logro destacado', 1),
       ('A', 'Logro esperado', 2),
       ('B', 'En proceso', 3),
       ('C', 'En inicio', 4)
     ON CONFLICT (codigo) DO NOTHING`,
  );
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence('escala_calificacion', 'id_escala'),
       GREATEST((SELECT COALESCE(MAX(id_escala), 1) FROM escala_calificacion), 1),
       true
     )`,
  );
};

const obtenerRolAdmin = async (client) => {
  const result = await client.query(
    `SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN' LIMIT 1`,
  );
  return result.rows[0] || null;
};

const crearAdmin = async (client, data) => {
  const result = await client.query(
    `INSERT INTO usuarios (
       dni, nombres, apellidos, correo_institucional, correo_personal,
       password_hash, telefono, id_rol, estado, requiere_cambio_password
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVO', FALSE
     )
     RETURNING id_usuario, dni, nombres, apellidos, correo_institucional`,
    [
      data.dni,
      data.nombres,
      data.apellidos,
      data.correo,
      data.correo,
      data.password_hash,
      data.telefono || null,
      data.id_rol,
    ],
  );
  return result.rows[0];
};

const crearPersonalAdmin = async (client, idUsuario) => {
  await client.query(
    `INSERT INTO personal (id_usuario, especialidad, cargo, fecha_ingreso)
     VALUES ($1, NULL, 'Administrador', CURRENT_DATE)`,
    [idUsuario],
  );
};

const activarAnio = async (
  client,
  { anio, fechaInicio, fechaFin, idUsuario },
) => {
  await client.query(
    `UPDATE anios_lectivos
     SET estado = 'CERRADO',
         fecha_cierre = now(),
         cerrado_por = $2
     WHERE estado = 'ACTIVO' AND anio <> $1`,
    [anio, idUsuario],
  );
  const result = await client.query(
    `INSERT INTO anios_lectivos (
       anio, estado, fecha_inicio, fecha_fin, creado_por
     ) VALUES ($1, 'ACTIVO', $2, $3, $4)
     ON CONFLICT (anio) DO UPDATE SET
       estado = 'ACTIVO',
       fecha_inicio = EXCLUDED.fecha_inicio,
       fecha_fin = EXCLUDED.fecha_fin,
       cerrado_por = NULL,
       fecha_cierre = NULL
     RETURNING anio, estado`,
    [anio, fechaInicio, fechaFin, idUsuario],
  );
  return result.rows[0];
};

const crearGrado = async (
  client,
  { nombre, nivel, seccion, anio, orden },
) => {
  await client.query(
    `INSERT INTO grados (nombre_grado, nivel, seccion, anio_lectivo, orden)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (nombre_grado, seccion, anio_lectivo) DO NOTHING`,
    [nombre, nivel, seccion, anio, orden],
  );
};

const crearCajaPrincipal = async (client, idUsuario) => {
  const existe = await client.query(
    `SELECT 1 FROM cajas WHERE nombre_caja = 'Caja Principal' LIMIT 1`,
  );
  if (existe.rows.length > 0) return;
  await client.query(
    `INSERT INTO cajas (nombre_caja, responsable, estado)
     VALUES ('Caja Principal', $1, 'CERRADA')`,
    [idUsuario],
  );
};

const marcarCompletado = async (client, idUsuario) => {
  const result = await client.query(
    `UPDATE configuracion_institucional
     SET setup_completado = TRUE,
         setup_completado_en = now(),
         setup_completado_por = $1,
         actualizado_por = $1,
         actualizado_en = now()
     WHERE id_configuracion = 1
     RETURNING setup_completado, setup_completado_en`,
    [idUsuario],
  );
  return result.rows[0] || null;
};

module.exports = {
  contarAdmins,
  obtenerEstado,
  obtenerConfiguracionParaSetup,
  asegurarRoles,
  asegurarEscala,
  obtenerRolAdmin,
  crearAdmin,
  crearPersonalAdmin,
  activarAnio,
  crearGrado,
  crearCajaPrincipal,
  marcarCompletado,
};
