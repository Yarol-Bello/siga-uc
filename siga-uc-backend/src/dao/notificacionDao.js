/**
 * DAO para la tabla notificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

/**
 * Listar notificaciones de un usuario
 */
const listarPorUsuario = async (id_usuario, filtros = {}) => {
  const conditions = ["n.id_usuario_destino = $1"];
  const params = [id_usuario];
  let idx = 2;

  if (filtros.leido !== undefined) {
    conditions.push(`n.leido = $${idx++}`);
    params.push(filtros.leido);
  }

  const sql = `
    SELECT 
      n.id_notificacion,
      n.asunto,
      n.cuerpo,
      n.leido,
      n.fecha_envio,
      u_rem.nombres || ' ' || u_rem.apellidos AS remitente_nombre,
      u_rem.correo_institucional AS remitente_correo
    FROM notificaciones n
    LEFT JOIN usuarios u_rem ON u_rem.id_usuario = n.id_usuario_remitente
    WHERE ${conditions.join(" AND ")}
    ORDER BY n.fecha_envio DESC
  `;
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Obtener detalle de una notificación
 */
const findById = async (id, id_usuario) => {
  const sql = `
    SELECT 
      n.id_notificacion,
      n.id_usuario_destino,
      n.asunto,
      n.cuerpo,
      n.leido,
      n.fecha_envio,
      u_rem.nombres || ' ' || u_rem.apellidos AS remitente_nombre,
      u_rem.correo_institucional AS remitente_correo
    FROM notificaciones n
    LEFT JOIN usuarios u_rem ON u_rem.id_usuario = n.id_usuario_remitente
    WHERE n.id_notificacion = $1 AND n.id_usuario_destino = $2
  `;
  const result = await query(sql, [id, id_usuario]);
  return result.rows[0] || null;
};

/**
 * Contar notificaciones no leídas
 */
const contarNoLeidas = async (id_usuario) => {
  const sql = `
    SELECT COUNT(*) AS total
    FROM notificaciones
    WHERE id_usuario_destino = $1 AND leido = FALSE
  `;
  const result = await query(sql, [id_usuario]);
  return parseInt(result.rows[0].total);
};

/**
 * Crear notificación
 */
const crear = async (data) => {
  const sql = `
    INSERT INTO notificaciones (
      id_usuario_destino, id_usuario_remitente, asunto, cuerpo, leido
    ) VALUES ($1::INT, $2::INT, $3::VARCHAR, $4::TEXT, FALSE)
    RETURNING *
  `;
  const result = await query(sql, [
    data.id_usuario_destino,
    data.id_usuario_remitente || null,
    data.asunto,
    data.cuerpo,
  ]);
  return result.rows[0];
};

/**
 * Marcar como leída
 */
const marcarLeida = async (id, id_usuario) => {
  const sql = `
    UPDATE notificaciones SET leido = TRUE
    WHERE id_notificacion = $1 AND id_usuario_destino = $2
    RETURNING *
  `;
  const result = await query(sql, [id, id_usuario]);
  return result.rows[0] || null;
};

/**
 * Marcar todas como leídas
 */
const marcarTodasLeidas = async (id_usuario) => {
  const sql = `
    UPDATE notificaciones SET leido = TRUE
    WHERE id_usuario_destino = $1 AND leido = FALSE
    RETURNING id_notificacion
  `;
  const result = await query(sql, [id_usuario]);
  return result.rowCount;
};

/**
 * Eliminar notificación
 */
const eliminar = async (id, id_usuario) => {
  const sql = `
    DELETE FROM notificaciones
    WHERE id_notificacion = $1 AND id_usuario_destino = $2
    RETURNING *
  `;
  const result = await query(sql, [id, id_usuario]);
  return result.rows[0] || null;
};

/**
 * Enviar notificación masiva (a varios usuarios)
 */
const crearMasivo = async (destinos, data) => {
  const results = [];
  for (const id_destino of destinos) {
    const result = await crear({
      ...data,
      id_usuario_destino: id_destino,
    });
    results.push(result);
  }
  return results;
};

module.exports = {
  listarPorUsuario,
  findById,
  contarNoLeidas,
  crear,
  marcarLeida,
  marcarTodasLeidas,
  eliminar,
  crearMasivo,
};
