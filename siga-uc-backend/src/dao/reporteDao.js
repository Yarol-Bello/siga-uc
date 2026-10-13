/**
 * DAO para Reportes y Dashboard
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

/**
 * Dashboard ejecutivo (para M1A-Resumen Ejecutivo)
 */
const getDashboardEjecutivo = async (anioLectivo = 2026) => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM alumnos WHERE estado_matricula = 'Matriculado' AND anio_lectivo = $1) AS total_alumnos,
      (SELECT COUNT(*) FROM personal WHERE fecha_cese IS NULL) AS total_personal,
      (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE EXTRACT(YEAR FROM fecha_pago) = $1 AND estado = 'PAGADO') AS recaudacion_anual,
      (SELECT COUNT(*) FROM pre_tickets WHERE estado = 'PENDIENTE') AS pre_tickets_pendientes,
      (SELECT COALESCE(SUM(monto), 0) FROM pre_tickets WHERE estado = 'PENDIENTE') AS monto_pendiente,
      (SELECT COUNT(*) FROM alumnos WHERE estado_matricula = 'Retirado' AND anio_lectivo = $1) AS total_retirados,
      (SELECT COUNT(*) FROM grados WHERE anio_lectivo = $1) AS total_grados,
      (SELECT COUNT(*) FROM cursos) AS total_cursos
  `;
  const result = await query(sql, [anioLectivo]);
  return result.rows[0];
};

/**
 * Alumnos con bajo rendimiento (nota C en 2 o más competencias)
 */
const getAlumnosRiesgo = async (id_grado, bimestre, anioLectivo = 2026) => {
  const sql = `
    SELECT 
      a.id_alumno,
      a.dni,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      a.codigo_estudiante,
      g.nombre_grado,
      COUNT(DISTINCT cal.id_curso) FILTER (WHERE cal.calificacion = 'C') AS cursos_con_c,
      STRING_AGG(DISTINCT c.nombre_curso, ', ' ORDER BY c.nombre_curso) FILTER (WHERE cal.calificacion = 'C') AS cursos_detalle,
      u_tutor.nombres || ' ' || u_tutor.apellidos AS tutor_nombre
    FROM alumnos a
    INNER JOIN grados g ON g.id_grado = a.id_grado
    LEFT JOIN calificaciones cal ON cal.id_alumno = a.id_alumno 
      AND cal.bimestre = $2 AND cal.anio_lectivo = $3
    LEFT JOIN cursos c ON c.id_curso = cal.id_curso
    LEFT JOIN tutores_grado tg ON tg.id_grado = a.id_grado AND tg.anio_lectivo = $3
    LEFT JOIN personal p_tutor ON p_tutor.id_personal = tg.id_personal
    LEFT JOIN usuarios u_tutor ON u_tutor.id_usuario = p_tutor.id_usuario
    WHERE a.id_grado = $1 AND a.estado_matricula = 'Matriculado'
    GROUP BY a.id_alumno, a.dni, a.nombres, a.apellidos, a.codigo_estudiante,
             g.nombre_grado, u_tutor.nombres, u_tutor.apellidos
    HAVING COUNT(DISTINCT cal.id_curso) FILTER (WHERE cal.calificacion = 'C') >= 2
    ORDER BY cursos_con_c DESC, a.apellidos
  `;
  const result = await query(sql, [id_grado, bimestre, anioLectivo]);
  return result.rows;
};

/**
 * Cuadro de mérito por grado (top alumnos por promedio)
 */
const getCuadroMerito = async (id_grado, bimestre, anioLectivo = 2026) => {
  const sql = `
    WITH notas_alumno AS (
      SELECT 
        a.id_alumno,
        a.nombres || ' ' || a.apellidos AS nombre_completo,
        a.codigo_estudiante,
        a.dni,
        COUNT(nf.id_nota_final) AS total_cursos,
        COUNT(*) FILTER (WHERE nf.nota_final = 'AD') AS total_ad,
        COUNT(*) FILTER (WHERE nf.nota_final = 'A') AS total_a,
        COUNT(*) FILTER (WHERE nf.nota_final = 'B') AS total_b,
        COUNT(*) FILTER (WHERE nf.nota_final = 'C') AS total_c,
        -- Puntaje ponderado: AD=4, A=3, B=2, C=1
        SUM(CASE nf.nota_final WHEN 'AD' THEN 4 WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 ELSE 0 END) AS puntaje_total,
        ROUND(
          SUM(CASE nf.nota_final WHEN 'AD' THEN 4 WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 ELSE 0 END)::decimal 
          / NULLIF(COUNT(nf.id_nota_final), 0), 
          2
        ) AS promedio_ponderado
      FROM alumnos a
      LEFT JOIN notas_finales_area nf ON nf.id_alumno = a.id_alumno 
        AND nf.bimestre = $2 AND nf.anio_lectivo = $3
      WHERE a.id_grado = $1 AND a.estado_matricula = 'Matriculado'
      GROUP BY a.id_alumno, a.nombres, a.apellidos, a.codigo_estudiante, a.dni
    )
    SELECT 
      ROW_NUMBER() OVER (ORDER BY promedio_ponderado DESC NULLS LAST, total_ad DESC) AS puesto,
      *
    FROM notas_alumno
    WHERE total_cursos > 0
    ORDER BY puesto
    LIMIT 10
  `;
  const result = await query(sql, [id_grado, bimestre, anioLectivo]);
  return result.rows;
};

/**
 * Libreta completa de un alumno (notas + conclusiones + asistencia)
 */
const getLibretaAlumno = async (id_alumno, bimestre, anioLectivo = 2026) => {
  // 1. Datos del alumno
  const alumnoSql = `
    SELECT 
      a.id_alumno, a.dni, a.nombres, a.apellidos,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      a.codigo_estudiante, a.fecha_nacimiento,
      g.nombre_grado, g.seccion,
      ap.nombres || ' ' || ap.apellidos AS apoderado_nombre
    FROM alumnos a
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    LEFT JOIN apoderados ap ON ap.id_apoderado = a.id_apoderado
    WHERE a.id_alumno = $1
  `;
  const alumnoResult = await query(alumnoSql, [id_alumno]);
  const alumno = alumnoResult.rows[0];

  // 2. Notas finales por curso
  const notasSql = `
    SELECT 
      c.id_curso, c.nombre_curso, c.area_academica,
      nf.bimestre, nf.nota_final,
      cd.descripcion AS conclusion
    FROM cursos c
    LEFT JOIN notas_finales_area nf ON nf.id_curso = c.id_curso 
      AND nf.id_alumno = $1 AND nf.bimestre = $2 AND nf.anio_lectivo = $3
    LEFT JOIN conclusiones_descriptivas cd ON cd.id_curso = c.id_curso 
      AND cd.id_alumno = $1 AND cd.bimestre = $2 AND cd.anio_lectivo = $3
    ORDER BY c.area_academica, c.nombre_curso
  `;
  const notasResult = await query(notasSql, [id_alumno, bimestre, anioLectivo]);

  // 3. Resumen de asistencia general
  const asistenciaSql = `
    SELECT 
      COUNT(*) AS total_registros,
      COUNT(*) FILTER (WHERE estado = 'P') AS total_presente,
      COUNT(*) FILTER (WHERE estado = 'T') AS total_tardanza,
      COUNT(*) FILTER (WHERE estado = 'F') AS total_falta,
      ROUND(
        (COUNT(*) FILTER (WHERE estado = 'P')::decimal / NULLIF(COUNT(*), 0) * 100), 
        2
      ) AS porcentaje_asistencia
    FROM asistencia_alumnos
    WHERE id_alumno = $1
  `;
  const asistenciaResult = await query(asistenciaSql, [id_alumno]);

  // 4. Tutor del grado
  const tutorSql = `
    SELECT u.nombres || ' ' || u.apellidos AS tutor_nombre
    FROM tutores_grado tg
    INNER JOIN personal p ON p.id_personal = tg.id_personal
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    WHERE tg.id_grado = (SELECT id_grado FROM alumnos WHERE id_alumno = $1) 
      AND tg.anio_lectivo = $2
    LIMIT 1
  `;
  const tutorResult = await query(tutorSql, [id_alumno, anioLectivo]);

  return {
    alumno,
    tutor: tutorResult.rows[0] || null,
    notas: notasResult.rows,
    asistencia: asistenciaResult.rows[0],
    bimestre,
    anio_lectivo: anioLectivo,
  };
};

/**
 * Resumen de asistencia por grado
 */
const getResumenAsistenciaGrado = async (id_grado, anioLectivo = 2026) => {
  const sql = `
    SELECT 
      a.id_alumno, a.dni,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      a.codigo_estudiante,
      COUNT(asis.id_asistencia) AS total_clases,
      COUNT(*) FILTER (WHERE asis.estado = 'P') AS total_presente,
      COUNT(*) FILTER (WHERE asis.estado = 'T') AS total_tardanza,
      COUNT(*) FILTER (WHERE asis.estado = 'F') AS total_falta,
      ROUND(
        (COUNT(*) FILTER (WHERE asis.estado = 'P')::decimal / NULLIF(COUNT(asis.id_asistencia), 0) * 100), 
        2
      ) AS porcentaje_asistencia
    FROM alumnos a
    LEFT JOIN asistencia_alumnos asis ON asis.id_alumno = a.id_alumno
    WHERE a.id_grado = $1 AND a.estado_matricula = 'Matriculado'
    GROUP BY a.id_alumno, a.dni, a.nombres, a.apellidos, a.codigo_estudiante
    ORDER BY porcentaje_asistencia ASC NULLS LAST, a.apellidos
  `;
  const result = await query(sql, [id_grado]); // ← SOLO 1 parámetro
  return result.rows;
};

/**
 * Auditoría de carga de notas por docentes (para SIAGIE)
 * Muestra quién ya completó y quién está pendiente
 */
const getAuditoriaDocentes = async (id_grado, bimestre, anioLectivo = 2026) => {
  const sql = `
    SELECT 
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      p.id_personal,
      u.nombres || ' ' || u.apellidos AS docente_nombre,
      u.correo_institucional AS docente_correo,
      g.id_grado,
      g.nombre_grado,
      (SELECT COUNT(*) FROM alumnos a 
       WHERE a.id_grado = g.id_grado 
         AND a.estado_matricula = 'Matriculado' 
         AND a.anio_lectivo = $3) AS total_alumnos,
      (SELECT COUNT(DISTINCT nf.id_alumno) 
       FROM notas_finales_area nf 
       WHERE nf.id_curso = c.id_curso 
         AND nf.bimestre = $2 
         AND nf.anio_lectivo = $3) AS alumnos_calificados,
      ROUND(
        (SELECT COUNT(DISTINCT nf.id_alumno)::decimal 
         FROM notas_finales_area nf 
         WHERE nf.id_curso = c.id_curso 
           AND nf.bimestre = $2 
           AND nf.anio_lectivo = $3) 
        / NULLIF(
          (SELECT COUNT(*) FROM alumnos a 
           WHERE a.id_grado = g.id_grado 
             AND a.estado_matricula = 'Matriculado' 
             AND a.anio_lectivo = $3), 0) * 100, 
        2
      ) AS porcentaje
    FROM carga_curricular cc
    INNER JOIN cursos c ON c.id_curso = cc.id_curso
    INNER JOIN grados g ON g.id_grado = cc.id_grado
    INNER JOIN personal p ON p.id_personal = cc.id_personal
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    WHERE cc.id_grado = $1 
      AND cc.anio_lectivo = $3
    ORDER BY c.area_academica, c.nombre_curso
  `;
  const result = await query(sql, [id_grado, bimestre, anioLectivo]);
  return result.rows;
};

module.exports = {
  getDashboardEjecutivo,
  getAlumnosRiesgo,
  getCuadroMerito,
  getLibretaAlumno,
  getResumenAsistenciaGrado,
  getAuditoriaDocentes,
};
