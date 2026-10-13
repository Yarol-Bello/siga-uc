/**
 * DAO para la bitácora de auditoría y actas bimestrales
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

/**
 * Listar bitácora con filtros
 */
const listarBitacora = async (filtros = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filtros.modulo) {
    conditions.push(`b.modulo_afectado = $${idx++}`);
    params.push(filtros.modulo);
  }

  if (filtros.accion) {
    conditions.push(`b.accion = $${idx++}`);
    params.push(filtros.accion);
  }

  if (filtros.id_usuario) {
    conditions.push(`b.id_usuario = $${idx++}`);
    params.push(filtros.id_usuario);
  }

  if (filtros.desde) {
    conditions.push(`b.fecha_hora >= $${idx++}`);
    params.push(filtros.desde);
  }

  if (filtros.hasta) {
    conditions.push(`b.fecha_hora <= $${idx++}`);
    params.push(filtros.hasta);
  }

  if (filtros.search) {
    conditions.push(`(
      LOWER(b.descripcion) LIKE LOWER($${idx}) OR
      LOWER(u.nombres || ' ' || u.apellidos) LIKE LOWER($${idx})
    )`);
    params.push(`%${filtros.search}%`);
    idx++;
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT 
      b.id_bitacora,
      b.id_usuario,
      b.fecha_hora,
      b.modulo_afectado,
      b.accion,
      b.descripcion,
      b.ip_origen,
      b.valor_anterior,
      b.valor_nuevo,
      u.nombres || ' ' || u.apellidos AS usuario_nombre,
      u.dni AS usuario_dni,
      r.nombre_rol
    FROM bitacora_auditoria b
    LEFT JOIN usuarios u ON u.id_usuario = b.id_usuario
    LEFT JOIN roles r ON r.id_rol = u.id_rol
    ${where}
    ORDER BY b.fecha_hora DESC
    LIMIT 200
  `;

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Buscar bitácora por ID
 */
const findBitacoraById = async (id) => {
  const sql = `
    SELECT 
      b.*,
      u.nombres || ' ' || u.apellidos AS usuario_nombre,
      u.dni AS usuario_dni,
      r.nombre_rol
    FROM bitacora_auditoria b
    LEFT JOIN usuarios u ON u.id_usuario = b.id_usuario
    LEFT JOIN roles r ON r.id_rol = u.id_rol
    WHERE b.id_bitacora = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Listar módulos únicos (para filtro)
 */
const listarModulos = async () => {
  const sql = `
    SELECT DISTINCT modulo_afectado 
    FROM bitacora_auditoria 
    ORDER BY modulo_afectado
  `;
  const result = await query(sql);
  return result.rows.map((r) => r.modulo_afectado);
};

/**
 * Listar actas bimestrales
 */
const listarActas = async () => {
  const sql = `
    SELECT 
      a.id_acta,
      a.periodo,
      a.anio_lectivo,
      a.id_grado,
      a.estado,
      a.fecha_cierre,
      a.cerrado_por,
      a.hash_integridad,
      g.nombre_grado,
      u.nombres || ' ' || u.apellidos AS cerrado_por_nombre
    FROM actas_bimestrales a
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    LEFT JOIN usuarios u ON u.id_usuario = a.cerrado_por
    ORDER BY a.anio_lectivo DESC, a.periodo
  `;
  const result = await query(sql);
  return result.rows;
};

/**
 * Cerrar un acta bimestral (con hash de integridad)
 */
const cerrarActa = async (data) => {
  const sql = `
    UPDATE actas_bimestrales
    SET 
      estado = 'CERRADO',
      fecha_cierre = NOW(),
      cerrado_por = $1,
      hash_integridad = MD5(CONCAT($2, $3, NOW()::text, $4))
    WHERE periodo = $2
      AND anio_lectivo = $3
      AND id_grado IS NOT DISTINCT FROM $4
    RETURNING *
  `;
  const result = await query(sql, [
    data.cerrado_por,
    data.periodo,
    data.anio_lectivo,
    data.id_grado || null,
  ]);
  return result.rows[0] || null;
};

/**
 * Contar eventos por acción (para dashboard)
 */
const getEstadisticas = async () => {
  const sql = `
    SELECT 
      COUNT(*) AS total_registros,
      COUNT(DISTINCT id_usuario) AS total_usuarios,
      COUNT(*) FILTER (WHERE accion = 'LOGIN') AS total_logins,
      COUNT(*) FILTER (WHERE accion = 'MODIFICAR') AS total_modificaciones,
      COUNT(*) FILTER (WHERE accion = 'CREAR') AS total_creaciones,
      COUNT(*) FILTER (WHERE accion = 'ANULAR') AS total_anulaciones
    FROM bitacora_auditoria
  `;
  const result = await query(sql);
  return result.rows[0];
};

module.exports = {
  listarBitacora,
  findBitacoraById,
  listarModulos,
  listarActas,
  cerrarActa,
  getEstadisticas,
};
