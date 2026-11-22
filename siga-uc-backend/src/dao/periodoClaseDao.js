/**
 * DAO de períodos de clase (H47)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

const SELECT_BASE = `
  SELECT
    p.id_periodo,
    p.anio_lectivo,
    p.nombre,
    p.orden,
    p.hora_inicio,
    p.hora_fin,
    p.tipo,
    p.activo
  FROM periodos_clase p
`;

const listarPorAnio = async (anioLectivo) => {
  const result = await query(
    `${SELECT_BASE}
     WHERE p.anio_lectivo = $1
     ORDER BY p.orden, p.id_periodo`,
    [anioLectivo],
  );
  return result.rows;
};

const findById = async (id) => {
  const result = await query(`${SELECT_BASE} WHERE p.id_periodo = $1`, [id]);
  return result.rows[0] || null;
};

const findByOrden = async (anioLectivo, orden, excluirId = null) => {
  const result = await query(
    `${SELECT_BASE}
     WHERE p.anio_lectivo = $1
       AND p.orden = $2
       AND ($3::int IS NULL OR p.id_periodo <> $3)
     LIMIT 1`,
    [anioLectivo, orden, excluirId],
  );
  return result.rows[0] || null;
};

const existeSolape = async (
  anioLectivo,
  horaInicio,
  horaFin,
  excluirId = null,
) => {
  const result = await query(
    `SELECT p.id_periodo, p.nombre, p.hora_inicio, p.hora_fin
     FROM periodos_clase p
     WHERE p.anio_lectivo = $1
       AND ($4::int IS NULL OR p.id_periodo <> $4)
       AND $2::time < p.hora_fin
       AND $3::time > p.hora_inicio
     ORDER BY p.orden
     LIMIT 1`,
    [anioLectivo, horaInicio, horaFin, excluirId],
  );
  return result.rows[0] || null;
};

const contarHorarios = async (idPeriodo) => {
  const result = await query(
    `SELECT COUNT(*)::int AS total
     FROM horarios
     WHERE id_periodo = $1`,
    [idPeriodo],
  );
  return result.rows[0]?.total || 0;
};

const crear = async (data) => {
  const result = await query(
    `INSERT INTO periodos_clase
       (anio_lectivo, nombre, orden, hora_inicio, hora_fin, tipo, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.anio_lectivo,
      data.nombre,
      data.orden,
      data.hora_inicio,
      data.hora_fin,
      data.tipo,
      data.activo,
    ],
  );
  return result.rows[0];
};

const actualizar = async (id, data) => {
  const result = await query(
    `UPDATE periodos_clase SET
       anio_lectivo = $1,
       nombre = $2,
       orden = $3,
       hora_inicio = $4,
       hora_fin = $5,
       tipo = $6,
       activo = $7
     WHERE id_periodo = $8
     RETURNING *`,
    [
      data.anio_lectivo,
      data.nombre,
      data.orden,
      data.hora_inicio,
      data.hora_fin,
      data.tipo,
      data.activo,
      id,
    ],
  );
  return result.rows[0] || null;
};

const eliminar = async (id) => {
  const result = await query(
    `DELETE FROM periodos_clase WHERE id_periodo = $1 RETURNING *`,
    [id],
  );
  return result.rows[0] || null;
};

module.exports = {
  listarPorAnio,
  findById,
  findByOrden,
  existeSolape,
  contarHorarios,
  crear,
  actualizar,
  eliminar,
};
