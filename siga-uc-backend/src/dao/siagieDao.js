/**
 * DAO para la Exportación Interna de Calificaciones (SIAGIE)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * La exportación es INTERNA: genera un Excel de apoyo con las notas finales
 * del grado. No reemplaza ni sube información al SIAGIE/MINEDU.
 *
 * Los cursos se obtienen de la carga curricular del grado y año (H05), no de
 * una lista fija de prefijos. También se incluyen cursos que solo tengan notas
 * finales registradas para el año.
 */

const { query } = require("../config/database");

/**
 * Obtener los datos del grado.
 */
const obtenerGrado = async (id_grado) => {
  const sql = `
    SELECT id_grado, nombre_grado, nivel, seccion, anio_lectivo
    FROM grados
    WHERE id_grado = $1
  `;
  const result = await query(sql, [id_grado]);
  return result.rows[0] || null;
};

/**
 * Cursos del grado en un año: carga curricular + cursos con notas finales.
 * Devuelve todos los cursos, sin filtrar por prefijos (H05).
 */
const obtenerCursosDelGrado = async (id_grado, anioLectivo) => {
  const sql = `
    SELECT DISTINCT c.id_curso, c.nombre_curso, c.area_academica
    FROM (
      SELECT cc.id_curso
      FROM carga_curricular cc
      WHERE cc.id_grado = $1
        AND cc.anio_lectivo = $2

      UNION

      SELECT nf.id_curso
      FROM notas_finales_area nf
      INNER JOIN alumnos a ON a.id_alumno = nf.id_alumno
      WHERE a.id_grado = $1
        AND nf.anio_lectivo = $2
    ) cursos_grado
    INNER JOIN cursos c ON c.id_curso = cursos_grado.id_curso
    ORDER BY c.area_academica, c.nombre_curso
  `;
  const result = await query(sql, [id_grado, anioLectivo]);
  return result.rows;
};

/**
 * Alumnos del grado en el año, con matrícula vigente.
 * Se excluye a los retirados: su matrícula ya no está activa.
 */
const obtenerAlumnosDelGrado = async (id_grado, anioLectivo) => {
  const sql = `
    SELECT
      a.id_alumno,
      a.dni,
      a.nombres,
      a.apellidos,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      a.estado_matricula
    FROM alumnos a
    WHERE a.id_grado = $1
      AND a.anio_lectivo = $2
      AND a.estado_matricula IN ('Matriculado', 'PendientePago')
    ORDER BY a.apellidos, a.nombres, a.id_alumno
  `;
  const result = await query(sql, [id_grado, anioLectivo]);
  return result.rows;
};

/**
 * Notas finales del grado, año y bimestre.
 */
const obtenerNotasFinales = async (id_grado, bimestre, anioLectivo) => {
  const sql = `
    SELECT nf.id_alumno, nf.id_curso, nf.nota_final
    FROM notas_finales_area nf
    INNER JOIN alumnos a ON a.id_alumno = nf.id_alumno
    WHERE a.id_grado = $1
      AND nf.anio_lectivo = $2
      AND nf.bimestre = $3
  `;
  const result = await query(sql, [id_grado, anioLectivo, bimestre]);
  return result.rows;
};

/**
 * Conclusiones descriptivas del grado, año y bimestre.
 */
const obtenerConclusiones = async (id_grado, bimestre, anioLectivo) => {
  const sql = `
    SELECT cd.id_alumno, cd.id_curso, cd.descripcion AS conclusion
    FROM conclusiones_descriptivas cd
    INNER JOIN alumnos a ON a.id_alumno = cd.id_alumno
    WHERE a.id_grado = $1
      AND cd.anio_lectivo = $2
      AND cd.bimestre = $3
  `;
  const result = await query(sql, [id_grado, anioLectivo, bimestre]);
  return result.rows;
};

/**
 * Registrar la exportación en la tabla de auditoría.
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
  obtenerGrado,
  obtenerCursosDelGrado,
  obtenerAlumnosDelGrado,
  obtenerNotasFinales,
  obtenerConclusiones,
  registrarExportacion,
};
