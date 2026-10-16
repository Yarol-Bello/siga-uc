/**
 * DAO para la tabla recuperacion_password
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

/**
 * Crear un token de recuperación
 * La fecha de expiración se calcula en PostgreSQL usando NOW() + INTERVAL '2 hours'
 * para evitar desajustes de zona horaria entre Node.js y PostgreSQL.
 */
const crearToken = async (id_usuario, token) => {
  // Invalidar tokens anteriores del mismo usuario
  await query(
    `UPDATE recuperacion_password SET usado = TRUE WHERE id_usuario = $1 AND usado = FALSE`,
    [id_usuario],
  );

  const sql = `
    INSERT INTO recuperacion_password (id_usuario, token, fecha_expiracion)
    VALUES ($1, $2, NOW() + INTERVAL '2 hours')
    RETURNING *
  `;
  const result = await query(sql, [id_usuario, token]);
  return result.rows[0];
};

/**
 * Buscar un token válido (no usado y no expirado)
 */
const findTokenValido = async (token) => {
  const sql = `
    SELECT 
      rp.id_recuperacion,
      rp.id_usuario,
      rp.token,
      rp.fecha_solicitud,
      rp.fecha_expiracion,
      rp.usado,
      u.dni,
      u.nombres,
      u.apellidos,
      u.correo_institucional,
      u.correo_personal,
      u.estado
    FROM recuperacion_password rp
    INNER JOIN usuarios u ON u.id_usuario = rp.id_usuario
    WHERE rp.token = $1
      AND rp.usado = FALSE
      AND rp.fecha_expiracion > NOW()
  `;
  const result = await query(sql, [token]);
  return result.rows[0] || null;
};

/**
 * Marcar un token como usado
 */
const marcarTokenUsado = async (token) => {
  const sql = `
    UPDATE recuperacion_password SET usado = TRUE WHERE token = $1 RETURNING *
  `;
  const result = await query(sql, [token]);
  return result.rows[0] || null;
};

module.exports = {
  crearToken,
  findTokenValido,
  marcarTokenUsado,
};
