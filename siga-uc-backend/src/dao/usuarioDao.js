/**
 * DAO (Data Access Object) para la tabla usuarios
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

/**
 * Buscar un usuario por DNI (incluye datos del rol)
 * @param {string} dni - DNI del usuario
 * @returns {Promise<object|null>}
 */
const findByDni = async (dni) => {
  const sql = `
    SELECT 
      u.id_usuario,
      u.dni,
      u.nombres,
      u.apellidos,
      u.correo_institucional,
      u.password_hash,
      u.telefono,
      u.estado,
      u.ultimo_login,
      u.requiere_cambio_password,
      u.fecha_creacion,
      r.id_rol,
      r.nombre_rol,
      r.descripcion AS rol_descripcion
    FROM usuarios u
    INNER JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.dni = $1
    LIMIT 1
  `;
  const result = await query(sql, [dni]);
  return result.rows[0] || null;
};

/**
 * Buscar un usuario por correo institucional
 * @param {string} correo - Correo institucional
 * @returns {Promise<object|null>}
 */
const findByCorreo = async (correo) => {
  const sql = `
    SELECT 
      u.id_usuario,
      u.dni,
      u.nombres,
      u.apellidos,
      u.correo_institucional,
      u.password_hash,
      u.estado,
      r.id_rol,
      r.nombre_rol
    FROM usuarios u
    INNER JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.correo_institucional = $1
    LIMIT 1
  `;
  const result = await query(sql, [correo]);
  return result.rows[0] || null;
};

/**
 * Buscar un usuario por ID
 * @param {number} id - ID del usuario
 * @returns {Promise<object|null>}
 */
const findById = async (id) => {
  const sql = `
    SELECT 
      u.id_usuario,
      u.dni,
      u.nombres,
      u.apellidos,
      u.correo_institucional,
      u.telefono,
      u.estado,
      u.ultimo_login,
      r.id_rol,
      r.nombre_rol
    FROM usuarios u
    INNER JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = $1
    LIMIT 1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Actualizar la fecha del último login
 * @param {number} id_usuario - ID del usuario
 * @returns {Promise<void>}
 */
const updateUltimoLogin = async (id_usuario) => {
  const sql = `
    UPDATE usuarios 
    SET ultimo_login = NOW() 
    WHERE id_usuario = $1
  `;
  await query(sql, [id_usuario]);
};

/**
 * Obtener datos del alumno asociado a un usuario (si existe)
 * @param {number} id_usuario - ID del usuario
 * @returns {Promise<object|null>}
 */
const getAlumnoInfo = async (id_usuario) => {
  const sql = `
    SELECT 
      a.id_alumno,
      a.codigo_estudiante,
      a.id_grado,
      g.nombre_grado,
      g.seccion,
      a.estado_matricula
    FROM alumnos a
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    WHERE a.id_usuario = $1
    LIMIT 1
  `;
  const result = await query(sql, [id_usuario]);
  return result.rows[0] || null;
};

/**
 * Obtener datos del personal asociado a un usuario (si existe)
 * @param {number} id_usuario - ID del usuario
 * @returns {Promise<object|null>}
 */
const getPersonalInfo = async (id_usuario) => {
  const sql = `
    SELECT 
      p.id_personal,
      p.especialidad,
      p.cargo,
      p.fecha_ingreso
    FROM personal p
    WHERE p.id_usuario = $1
    LIMIT 1
  `;
  const result = await query(sql, [id_usuario]);
  return result.rows[0] || null;
};

module.exports = {
  findByDni,
  findByCorreo,
  findById,
  updateUltimoLogin,
  getAlumnoInfo,
  getPersonalInfo,
};
