/**
 * DAO para la Exportación SIAGIE
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Consulta las notas finales registradas por los docentes
 * para inyectarlas en la plantilla oficial del MINEDU.
 */

const { query } = require("../config/database");

/**
 * Obtener todas las notas de un grado en un bimestre específico
 * Retorna una estructura lista para inyectar en el Excel
 */
const obtenerNotasParaSIAGIE = async (
  id_grado,
  bimestre,
  anioLectivo = 2026,
) => {
  const sql = `
    SELECT 
      a.id_alumno,
      a.dni,
      a.nombres,
      a.apellidos,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      a.codigo_estudiante,
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      nf.nota_final,
      nf.bimestre,
      nf.anio_lectivo
    FROM alumnos a
    CROSS JOIN cursos c
    LEFT JOIN notas_finales_area nf 
      ON nf.id_alumno = a.id_alumno 
      AND nf.id_curso = c.id_curso 
      AND nf.bimestre = $2 
      AND nf.anio_lectivo = $3
    WHERE a.id_grado = $1 
      AND a.estado_matricula = 'Matriculado'
      AND a.anio_lectivo = $3
    ORDER BY a.apellidos, a.nombres, c.area_academica, c.nombre_curso
  `;
  const result = await query(sql, [id_grado, bimestre, anioLectivo]);
  return result.rows;
};

/**
 * Obtener los datos del grado
 */
const obtenerGrado = async (id_grado) => {
  const sql = `
    SELECT id_grado, nombre_grado, seccion, anio_lectivo
    FROM grados
    WHERE id_grado = $1
  `;
  const result = await query(sql, [id_grado]);
  return result.rows[0] || null;
};

/**
 * Registrar la exportación en la tabla de auditoría
 */
const registrarExportacion = async (data) => {
  const sql = `
    INSERT INTO exportaciones_siagie (
      id_grado, bimestre, anio_lectivo, nombre_archivo, id_usuario, estado
    ) VALUES ($1, $2, $3, $4, $5, 'GENERADO')
    RETURNING *
  `;
  const result = await query(sql, [
    data.id_grado,
    data.bimestre,
    data.anio_lectivo,
    data.nombre_archivo,
    data.id_usuario,
  ]);
  return result.rows[0];
};

module.exports = {
  obtenerNotasParaSIAGIE,
  obtenerGrado,
  registrarExportacion,
};
