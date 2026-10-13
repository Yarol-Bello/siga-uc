/**
 * DAO para la tabla cursos y competencias
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

/**
 * Listar todos los cursos
 * @returns {Promise<Array>}
 */
const listar = async () => {
  const sql = `
    SELECT 
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      c.horas_semanales,
      COUNT(comp.id_competencia) AS total_competencias
    FROM cursos c
    LEFT JOIN competencias comp ON comp.id_curso = c.id_curso
    GROUP BY c.id_curso
    ORDER BY c.area_academica, c.nombre_curso
  `;
  const result = await query(sql);
  return result.rows;
};

/**
 * Buscar un curso por ID
 * @param {number} id - ID del curso
 * @returns {Promise<object|null>}
 */
const findById = async (id) => {
  const sql = `
    SELECT 
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      c.horas_semanales
    FROM cursos c
    WHERE c.id_curso = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Listar competencias de un curso
 * @param {number} id_curso - ID del curso
 * @returns {Promise<Array>}
 */
const listarCompetencias = async (id_curso) => {
  const sql = `
    SELECT 
      comp.id_competencia,
      comp.nombre_competencia,
      comp.orden
    FROM competencias comp
    WHERE comp.id_curso = $1
    ORDER BY comp.orden
  `;
  const result = await query(sql, [id_curso]);
  return result.rows;
};

/**
 * Listar cursos por área académica
 * @param {string} area - Área académica
 * @returns {Promise<Array>}
 */
const listarPorArea = async (area) => {
  const sql = `
    SELECT 
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      c.horas_semanales
    FROM cursos c
    WHERE c.area_academica = $1
    ORDER BY c.nombre_curso
  `;
  const result = await query(sql, [area]);
  return result.rows;
};

/**
 * Listar escala de calificación (AD, A, B, C)
 * @returns {Promise<Array>}
 */
const listarEscalaCalificacion = async () => {
  const sql = `
    SELECT 
      id_escala,
      codigo,
      descripcion,
      orden
    FROM escala_calificacion
    ORDER BY orden
  `;
  const result = await query(sql);
  return result.rows;
};

module.exports = {
  listar,
  findById,
  listarCompetencias,
  listarPorArea,
  listarEscalaCalificacion,
};
