/**
 * DAO para la tabla asistencia_alumnos
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");

/**
 * Obtener asistencia de un curso en una fecha específica
 */
const obtenerPorCursoFecha = async (id_curso, fecha, id_grado) => {
  const sql = `
    SELECT 
      a.id_alumno,
      a.dni,
      a.nombres,
      a.apellidos,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      a.codigo_estudiante,
      asis.id_asistencia,
      asis.estado,
      asis.observacion,
      asis.justificada,
      asis.motivo_justificacion,
      asis.fecha
    FROM alumnos a
    LEFT JOIN asistencia_alumnos asis 
      ON asis.id_alumno = a.id_alumno 
      AND asis.id_curso = $1 
      AND asis.fecha = $2
    WHERE a.id_grado = $3 
      AND a.estado_matricula = 'Matriculado'
    ORDER BY a.apellidos, a.nombres
  `;
  const result = await query(sql, [id_curso, fecha, id_grado]);
  return result.rows;
};

/**
 * Obtener historial de asistencia de un alumno
 */
const obtenerPorAlumno = async (id_alumno, filtros = {}) => {
  const conditions = ["asis.id_alumno = $1"];
  const params = [id_alumno];
  let idx = 2;

  if (filtros.id_curso) {
    conditions.push(`asis.id_curso = $${idx++}`);
    params.push(filtros.id_curso);
  }
  if (filtros.desde) {
    conditions.push(`asis.fecha >= $${idx++}`);
    params.push(filtros.desde);
  }
  if (filtros.hasta) {
    conditions.push(`asis.fecha <= $${idx++}`);
    params.push(filtros.hasta);
  }

  const sql = `
    SELECT 
      asis.id_asistencia,
      asis.fecha,
      TO_CHAR(asis.fecha, 'Day') AS dia_semana,
      asis.estado,
      asis.observacion,
      asis.justificada,
      asis.motivo_justificacion,
      c.id_curso,
      c.nombre_curso,
      u.nombres || ' ' || u.apellidos AS docente_registro
    FROM asistencia_alumnos asis
    INNER JOIN cursos c ON c.id_curso = asis.id_curso
    LEFT JOIN personal p ON p.id_personal = asis.id_personal
    LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
    WHERE ${conditions.join(" AND ")}
    ORDER BY asis.fecha DESC
  `;
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Obtener resumen de asistencia de un alumno por curso
 */
const obtenerResumenPorAlumno = async (id_alumno) => {
  const sql = `
    SELECT 
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      COUNT(*) FILTER (WHERE asis.estado = 'P') AS total_presente,
      COUNT(*) FILTER (WHERE asis.estado = 'T') AS total_tardanza,
      COUNT(*) FILTER (WHERE asis.estado = 'F') AS total_falta,
      COUNT(*) AS total_clases,
      ROUND(
        (COUNT(*) FILTER (WHERE asis.estado = 'P')::decimal / NULLIF(COUNT(*), 0) * 100), 
        2
      ) AS porcentaje_asistencia
    FROM asistencia_alumnos asis
    INNER JOIN cursos c ON c.id_curso = asis.id_curso
    WHERE asis.id_alumno = $1
    GROUP BY c.id_curso, c.nombre_curso, c.area_academica
    ORDER BY c.nombre_curso
  `;
  const result = await query(sql, [id_alumno]);
  return result.rows;
};

/**
 * Obtener estadísticas generales de un alumno
 */
const obtenerEstadisticasAlumno = async (id_alumno) => {
  const sql = `
    SELECT 
      COUNT(*) AS total_registros,
      COUNT(*) FILTER (WHERE estado = 'P') AS total_presente,
      COUNT(*) FILTER (WHERE estado = 'T') AS total_tardanza,
      COUNT(*) FILTER (WHERE estado = 'F') AS total_falta,
      COUNT(*) FILTER (WHERE justificada = TRUE) AS total_justificadas,
      ROUND(
        (COUNT(*) FILTER (WHERE estado = 'P')::decimal / NULLIF(COUNT(*), 0) * 100), 
        2
      ) AS porcentaje_global
    FROM asistencia_alumnos
    WHERE id_alumno = $1
  `;
  const result = await query(sql, [id_alumno]);
  return result.rows[0];
};

/**
 * Registrar asistencia individual (upsert)
 */
const registrar = async (data) => {
  const sql = `
    INSERT INTO asistencia_alumnos (
      id_alumno, id_curso, id_personal, id_grado, 
      fecha, dia_semana, estado, observacion, justificada, motivo_justificacion
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id_alumno, id_curso, fecha) 
    DO UPDATE SET
      estado = EXCLUDED.estado,
      observacion = EXCLUDED.observacion,
      justificada = EXCLUDED.justificada,
      motivo_justificacion = EXCLUDED.motivo_justificacion
    RETURNING *
  `;
  const result = await query(sql, [
    data.id_alumno,
    data.id_curso,
    data.id_personal,
    data.id_grado,
    data.fecha,
    data.dia_semana || null,
    data.estado,
    data.observacion || null,
    data.justificada || false,
    data.motivo_justificacion || null,
  ]);
  return result.rows[0];
};

/**
 * Registrar asistencia masiva (toda un aula)
 * @param {array} registros - Lista de asistencias
 * @returns {Promise<{insertados: number, errores: array}>}
 */
const registrarMasivo = async (registros) => {
  const client = await getClient();
  let insertados = 0;
  const errores = [];

  try {
    await client.query("BEGIN");

    for (const reg of registros) {
      try {
        const sql = `
          INSERT INTO asistencia_alumnos (
            id_alumno, id_curso, id_personal, id_grado, 
            fecha, dia_semana, estado, observacion, justificada, motivo_justificacion
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id_alumno, id_curso, fecha) 
          DO UPDATE SET
            estado = EXCLUDED.estado,
            observacion = EXCLUDED.observacion,
            justificada = EXCLUDED.justificada,
            motivo_justificacion = EXCLUDED.motivo_justificacion
        `;
        await client.query(sql, [
          reg.id_alumno,
          reg.id_curso,
          reg.id_personal,
          reg.id_grado,
          reg.fecha,
          reg.dia_semana || null,
          reg.estado,
          reg.observacion || null,
          reg.justificada || false,
          reg.motivo_justificacion || null,
        ]);
        insertados++;
      } catch (err) {
        errores.push({ id_alumno: reg.id_alumno, error: err.message });
      }
    }

    await client.query("COMMIT");
    return { insertados, errores };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerPorCursoFecha,
  obtenerPorAlumno,
  obtenerResumenPorAlumno,
  obtenerEstadisticasAlumno,
  registrar,
  registrarMasivo,
};
