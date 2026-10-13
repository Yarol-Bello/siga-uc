/**
 * DAO para la tabla grados
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

/**
 * Listar todos los grados del año lectivo actual
 * @param {number} anioLectivo - Año lectivo (ej: 2026)
 * @returns {Promise<Array>}
 */
const listar = async (anioLectivo = 2026) => {
  const sql = `
    SELECT 
      g.id_grado,
      g.nombre_grado,
      g.nivel,
      g.seccion,
      g.anio_lectivo,
      COUNT(a.id_alumno) AS total_alumnos
    FROM grados g
    LEFT JOIN alumnos a ON a.id_grado = g.id_grado AND a.estado_matricula = 'Matriculado'
    WHERE g.anio_lectivo = $1
    GROUP BY g.id_grado
    ORDER BY g.id_grado
  `;
  const result = await query(sql, [anioLectivo]);
  return result.rows;
};

/**
 * Buscar un grado por ID
 * @param {number} id - ID del grado
 * @returns {Promise<object|null>}
 */
const findById = async (id) => {
  const sql = `
    SELECT 
      g.id_grado,
      g.nombre_grado,
      g.nivel,
      g.seccion,
      g.anio_lectivo,
      COUNT(a.id_alumno) AS total_alumnos
    FROM grados g
    LEFT JOIN alumnos a ON a.id_grado = g.id_grado AND a.estado_matricula = 'Matriculado'
    WHERE g.id_grado = $1
    GROUP BY g.id_grado
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Obtener el tutor de un grado
 * @param {number} id_grado - ID del grado
 * @returns {Promise<object|null>}
 */
const getTutor = async (id_grado) => {
  const sql = `
    SELECT 
      tg.id_tutor,
      p.id_personal,
      u.nombres,
      u.apellidos,
      u.correo_institucional,
      p.especialidad
    FROM tutores_grado tg
    INNER JOIN personal p ON p.id_personal = tg.id_personal
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    WHERE tg.id_grado = $1
    LIMIT 1
  `;
  const result = await query(sql, [id_grado]);
  return result.rows[0] || null;
};

/**
 * Listar horarios de un grado con curso y docente
 */
const listarHorariosPorGrado = async (id_grado) => {
  const sql = `
    SELECT 
      h.id_horario,
      h.dia_semana,
      h.hora_inicio,
      h.hora_fin,
      h.tipo_bloque,
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      u.nombres || ' ' || u.apellidos AS docente_nombre
    FROM horarios h
    LEFT JOIN cursos c ON c.id_curso = h.id_curso
    LEFT JOIN personal p ON p.id_personal = h.id_personal
    LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
    WHERE h.id_grado = $1
    ORDER BY 
      CASE h.dia_semana 
        WHEN 'Lunes' THEN 1
        WHEN 'Martes' THEN 2
        WHEN 'Miércoles' THEN 3
        WHEN 'Jueves' THEN 4
        WHEN 'Viernes' THEN 5
        WHEN 'Sábado' THEN 6
      END,
      h.hora_inicio
  `;
  const result = await query(sql, [id_grado]);
  return result.rows;
};

module.exports = {
  listar,
  findById,
  getTutor,
  listarHorariosPorGrado,
};
