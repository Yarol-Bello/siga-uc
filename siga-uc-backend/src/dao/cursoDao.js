/**
 * DAO para la tabla cursos y competencias
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

/**
 * Listar todos los cursos
 * @returns {Promise<Array>}
 */
const listar = async (incluirInactivos = false) => {
  const sql = `
    SELECT
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      c.horas_semanales,
      c.activo,
      c.orden,
      c.descripcion,
      COUNT(comp.id_competencia) FILTER (WHERE comp.activo = TRUE) AS total_competencias
    FROM cursos c
    LEFT JOIN competencias comp ON comp.id_curso = c.id_curso
    WHERE ($1::boolean = TRUE OR c.activo = TRUE)
    GROUP BY c.id_curso
    ORDER BY c.area_academica, c.orden, c.nombre_curso
  `;
  const result = await query(sql, [incluirInactivos]);
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
      c.horas_semanales,
      c.activo,
      c.orden,
      c.descripcion
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
const listarCompetencias = async (id_curso, incluirInactivas = false) => {
  const sql = `
    SELECT
      comp.id_competencia,
      comp.nombre_competencia,
      comp.orden,
      comp.activo,
      comp.descripcion,
      (SELECT COUNT(*)::int FROM calificaciones cal
       WHERE cal.id_competencia = comp.id_competencia) AS calificaciones
    FROM competencias comp
    WHERE comp.id_curso = $1
      AND ($2::boolean = TRUE OR comp.activo = TRUE)
    ORDER BY comp.orden
  `;
  const result = await query(sql, [id_curso, incluirInactivas]);
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
      c.horas_semanales,
      c.activo,
      c.orden
    FROM cursos c
    WHERE c.area_academica = $1
      AND c.activo = TRUE
    ORDER BY c.orden, c.nombre_curso
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

// ============================================================
// Catálogo administrable (H76/Fase 3)
// ============================================================

const listarAreas = async (incluirInactivas = false) => {
  const result = await query(
    `SELECT a.id_area, a.nombre, a.orden, a.activo,
            COUNT(c.id_curso)::int AS total_cursos
     FROM areas_academicas a
     LEFT JOIN cursos c ON c.area_academica = a.nombre
     WHERE ($1::boolean = TRUE OR a.activo = TRUE)
     GROUP BY a.id_area
     ORDER BY a.orden, a.nombre`,
    [incluirInactivas],
  );
  return result.rows;
};

const findAreaById = async (id) => {
  const result = await query(
    `SELECT id_area, nombre, orden, activo FROM areas_academicas WHERE id_area = $1`,
    [id],
  );
  return result.rows[0] || null;
};

const crearArea = async (data) => {
  const result = await query(
    `INSERT INTO areas_academicas (nombre, orden, activo, creado_por)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.nombre, data.orden, data.activo, data.id_usuario],
  );
  return result.rows[0];
};

const actualizarArea = async (id, data) => {
  const result = await query(
    `UPDATE areas_academicas SET
       nombre = $2,
       orden = $3,
       activo = $4,
       actualizado_por = $5,
       fecha_actualizacion = now()
     WHERE id_area = $1
     RETURNING *`,
    [id, data.nombre, data.orden, data.activo, data.id_usuario],
  );
  return result.rows[0] || null;
};

const contarCursosPorArea = async (nombre) => {
  const result = await query(
    `SELECT COUNT(*)::int AS total FROM cursos WHERE area_academica = $1`,
    [nombre],
  );
  return Number(result.rows[0]?.total || 0);
};

const eliminarArea = async (id) => {
  const result = await query(
    `DELETE FROM areas_academicas WHERE id_area = $1 RETURNING *`,
    [id],
  );
  return result.rows[0] || null;
};

const listarAdmin = async (incluirInactivos = true) => {
  const result = await query(
    `SELECT
       c.id_curso, c.nombre_curso, c.area_academica, c.horas_semanales,
       c.activo, c.orden, c.descripcion,
       COUNT(DISTINCT comp.id_competencia)::int AS total_competencias,
       (SELECT COUNT(*)::int FROM carga_curricular cc WHERE cc.id_curso = c.id_curso) AS total_carga,
       (SELECT COUNT(*)::int FROM horarios h WHERE h.id_curso = c.id_curso) AS total_horarios,
       (SELECT COUNT(*)::int FROM calificaciones cal WHERE cal.id_curso = c.id_curso) AS total_calificaciones,
       (SELECT COUNT(*)::int FROM notas_finales_area nf WHERE nf.id_curso = c.id_curso) AS total_notas,
       (SELECT COUNT(*)::int FROM asistencia_alumnos aa WHERE aa.id_curso = c.id_curso) AS total_asistencias
     FROM cursos c
     LEFT JOIN competencias comp ON comp.id_curso = c.id_curso
     WHERE ($1::boolean = TRUE OR c.activo = TRUE)
     GROUP BY c.id_curso
     ORDER BY c.area_academica, c.orden, c.nombre_curso`,
    [incluirInactivos],
  );
  return result.rows;
};

const crearCurso = async (data) => {
  const result = await query(
    `INSERT INTO cursos (
       nombre_curso, area_academica, horas_semanales, activo, orden,
       descripcion, creado_por
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.nombre_curso,
      data.area_academica,
      data.horas_semanales,
      data.activo,
      data.orden,
      data.descripcion,
      data.id_usuario,
    ],
  );
  return result.rows[0];
};

const actualizarCurso = async (id, data) => {
  const result = await query(
    `UPDATE cursos SET
       nombre_curso = $2,
       area_academica = $3,
       horas_semanales = $4,
       activo = $5,
       orden = $6,
       descripcion = $7,
       actualizado_por = $8,
       fecha_actualizacion = now()
     WHERE id_curso = $1
     RETURNING *`,
    [
      id,
      data.nombre_curso,
      data.area_academica,
      data.horas_semanales,
      data.activo,
      data.orden,
      data.descripcion,
      data.id_usuario,
    ],
  );
  return result.rows[0] || null;
};

const contarDependenciasCurso = async (id) => {
  const result = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM carga_curricular WHERE id_curso = $1) AS carga,
       (SELECT COUNT(*)::int FROM horarios WHERE id_curso = $1) AS horarios,
       (SELECT COUNT(*)::int FROM calificaciones WHERE id_curso = $1) AS calificaciones,
       (SELECT COUNT(*)::int FROM notas_finales_area WHERE id_curso = $1) AS notas,
       (SELECT COUNT(*)::int FROM asistencia_alumnos WHERE id_curso = $1) AS asistencias,
       (SELECT COUNT(*)::int FROM conclusiones_descriptivas WHERE id_curso = $1) AS conclusiones,
       (SELECT COUNT(*)::int FROM competencias WHERE id_curso = $1) AS competencias`,
    [id],
  );
  return result.rows[0] || {};
};

const eliminarCurso = async (id) => {
  const result = await query(
    `DELETE FROM cursos WHERE id_curso = $1 RETURNING *`,
    [id],
  );
  return result.rows[0] || null;
};

const findCompetenciaById = async (id) => {
  const result = await query(
    `SELECT id_competencia, id_curso, nombre_competencia, orden, activo, descripcion
     FROM competencias WHERE id_competencia = $1`,
    [id],
  );
  return result.rows[0] || null;
};

const crearCompetencia = async (data) => {
  const result = await query(
    `INSERT INTO competencias (
       id_curso, nombre_competencia, orden, activo, descripcion, creado_por
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.id_curso,
      data.nombre_competencia,
      data.orden,
      data.activo,
      data.descripcion,
      data.id_usuario,
    ],
  );
  return result.rows[0];
};

const actualizarCompetencia = async (id, data) => {
  const result = await query(
    `UPDATE competencias SET
       nombre_competencia = $2,
       orden = $3,
       activo = $4,
       descripcion = $5,
       actualizado_por = $6,
       fecha_actualizacion = now()
     WHERE id_competencia = $1
     RETURNING *`,
    [
      id,
      data.nombre_competencia,
      data.orden,
      data.activo,
      data.descripcion,
      data.id_usuario,
    ],
  );
  return result.rows[0] || null;
};

const contarCalificacionesCompetencia = async (id) => {
  const result = await query(
    `SELECT COUNT(*)::int AS total FROM calificaciones WHERE id_competencia = $1`,
    [id],
  );
  return Number(result.rows[0]?.total || 0);
};

const eliminarCompetencia = async (id) => {
  const result = await query(
    `DELETE FROM competencias WHERE id_competencia = $1 RETURNING *`,
    [id],
  );
  return result.rows[0] || null;
};

module.exports = {
  listar,
  findById,
  listarCompetencias,
  listarPorArea,
  listarEscalaCalificacion,
  listarAreas,
  findAreaById,
  crearArea,
  actualizarArea,
  contarCursosPorArea,
  eliminarArea,
  listarAdmin,
  crearCurso,
  actualizarCurso,
  contarDependenciasCurso,
  eliminarCurso,
  findCompetenciaById,
  crearCompetencia,
  actualizarCompetencia,
  contarCalificacionesCompetencia,
  eliminarCompetencia,
};
