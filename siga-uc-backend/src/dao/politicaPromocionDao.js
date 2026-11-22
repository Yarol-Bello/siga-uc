/**
 * DAO de políticas de promoción (H73 / Fase 6.3)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

const ejecutar = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

const SELECT_BASE = `
  SELECT
    p.id_politica,
    p.anio_origen,
    p.anio_destino,
    p.nombre,
    p.activo,
    p.requiere_actas_cerradas,
    p.requiere_notas_finales,
    p.umbral_asistencia,
    p.criterio_academico,
    p.permite_override,
    p.creado_por,
    p.fecha_creacion,
    u.nombres || ' ' || u.apellidos AS creado_por_nombre
  FROM politicas_promocion p
  LEFT JOIN usuarios u ON u.id_usuario = p.creado_por
`;

const listar = async (filtros = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filtros.anio_origen) {
    conditions.push(`p.anio_origen = $${idx++}`);
    params.push(filtros.anio_origen);
  }
  if (filtros.anio_destino) {
    conditions.push(`p.anio_destino = $${idx++}`);
    params.push(filtros.anio_destino);
  }
  if (filtros.activo !== undefined && filtros.activo !== null) {
    conditions.push(`p.activo = $${idx++}`);
    params.push(filtros.activo === true || filtros.activo === "true");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `${SELECT_BASE}
     ${where}
     ORDER BY p.anio_origen DESC, p.anio_destino NULLS FIRST, p.nombre`,
    params,
  );
  return result.rows;
};

const findById = async (id, client = null) => {
  const result = await ejecutar(
    client,
    `${SELECT_BASE} WHERE p.id_politica = $1`,
    [id],
  );
  return result.rows[0] || null;
};

/**
 * Devuelve la política más específica y activa para el par de años:
 * primero la que declara anio_destino, luego la política general del origen.
 */
const findVigente = async (anioOrigen, anioDestino, client = null) => {
  const result = await ejecutar(
    client,
    `${SELECT_BASE}
     WHERE p.anio_origen = $1
       AND p.activo = true
       AND (p.anio_destino = $2 OR p.anio_destino IS NULL)
     ORDER BY
       CASE WHEN p.anio_destino = $2 THEN 0 ELSE 1 END,
       p.fecha_creacion DESC,
       p.id_politica DESC
     LIMIT 1`,
    [anioOrigen, anioDestino],
  );
  return result.rows[0] || null;
};

const crear = async (data, client = null) => {
  const result = await ejecutar(
    client,
    `INSERT INTO politicas_promocion (
       anio_origen, anio_destino, nombre, activo,
       requiere_actas_cerradas, requiere_notas_finales,
       umbral_asistencia, criterio_academico, permite_override, creado_por
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     RETURNING *`,
    [
      data.anio_origen,
      data.anio_destino,
      data.nombre,
      data.activo,
      data.requiere_actas_cerradas,
      data.requiere_notas_finales,
      data.umbral_asistencia,
      JSON.stringify(data.criterio_academico || {}),
      data.permite_override,
      data.creado_por || null,
    ],
  );
  return result.rows[0];
};

const actualizar = async (id, data, client = null) => {
  const result = await ejecutar(
    client,
    `UPDATE politicas_promocion SET
       anio_origen = $1,
       anio_destino = $2,
       nombre = $3,
       activo = $4,
       requiere_actas_cerradas = $5,
       requiere_notas_finales = $6,
       umbral_asistencia = $7,
       criterio_academico = $8::jsonb,
       permite_override = $9
     WHERE id_politica = $10
     RETURNING *`,
    [
      data.anio_origen,
      data.anio_destino,
      data.nombre,
      data.activo,
      data.requiere_actas_cerradas,
      data.requiere_notas_finales,
      data.umbral_asistencia,
      JSON.stringify(data.criterio_academico || {}),
      data.permite_override,
      id,
    ],
  );
  return result.rows[0] || null;
};

module.exports = {
  listar,
  findById,
  findVigente,
  crear,
  actualizar,
};
