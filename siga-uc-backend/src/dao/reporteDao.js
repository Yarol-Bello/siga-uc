/**
 * DAO para Reportes y Dashboard
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");
const { getAnioLectivo } = require("../config/academico");

/**
 * Dashboard ejecutivo (para M1A-Resumen Ejecutivo)
 */
const getDashboardEjecutivo = async (anioLectivo = getAnioLectivo()) => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM alumnos WHERE estado_matricula = 'Matriculado' AND anio_lectivo = $1) AS total_alumnos,
      (SELECT COUNT(*) FROM personal WHERE fecha_cese IS NULL) AS total_personal,
      (SELECT COUNT(*)
       FROM personal p
       INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
       WHERE p.fecha_cese IS NULL
         AND u.estado = 'ACTIVO'
         AND u.id_rol = 2) AS total_docentes,
      (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE EXTRACT(YEAR FROM fecha_pago) = $1 AND estado = 'PAGADO') AS recaudacion_anual,
      (SELECT COUNT(*)
       FROM pre_tickets pt
       INNER JOIN alumnos a ON a.id_alumno = pt.id_alumno
       WHERE pt.estado = 'PENDIENTE'
         AND a.anio_lectivo = $1) AS pre_tickets_pendientes,
      (SELECT COALESCE(SUM(pt.monto), 0)
       FROM pre_tickets pt
       INNER JOIN alumnos a ON a.id_alumno = pt.id_alumno
       WHERE pt.estado = 'PENDIENTE'
         AND a.anio_lectivo = $1) AS monto_pendiente,
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
const getAlumnosRiesgo = async (id_grado, bimestre, anioLectivo = getAnioLectivo()) => {
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
    WHERE a.id_grado = $1
      AND a.estado_matricula = 'Matriculado'
      AND a.anio_lectivo = $3
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
const getCuadroMerito = async (id_grado, bimestre, anioLectivo = getAnioLectivo()) => {
  const sql = `
    WITH carga AS (
      SELECT COUNT(DISTINCT cc.id_curso)::int AS total_cursos
      FROM carga_curricular cc
      WHERE cc.id_grado = $1
        AND cc.anio_lectivo = $3
    ),
    notas_alumno AS (
      SELECT 
        a.id_alumno,
        a.nombres || ' ' || a.apellidos AS nombre_completo,
        a.codigo_estudiante,
        a.dni,
        COUNT(DISTINCT nf.id_curso)::int AS total_cursos,
        COUNT(DISTINCT nf.id_curso) FILTER (WHERE nf.nota_final = 'AD')::int AS total_ad,
        COUNT(DISTINCT nf.id_curso) FILTER (WHERE nf.nota_final = 'A')::int AS total_a,
        COUNT(DISTINCT nf.id_curso) FILTER (WHERE nf.nota_final = 'B')::int AS total_b,
        COUNT(DISTINCT nf.id_curso) FILTER (WHERE nf.nota_final = 'C')::int AS total_c,
        -- Puntaje ponderado: AD=4, A=3, B=2, C=1
        SUM(CASE nf.nota_final WHEN 'AD' THEN 4 WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 ELSE 0 END) AS puntaje_total,
        ROUND(
          SUM(CASE nf.nota_final WHEN 'AD' THEN 4 WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 ELSE 0 END)::decimal 
          / NULLIF(COUNT(DISTINCT nf.id_curso), 0),
          2
        ) AS promedio_ponderado
      FROM alumnos a
      LEFT JOIN notas_finales_area nf ON nf.id_alumno = a.id_alumno 
        AND nf.bimestre = $2
        AND nf.anio_lectivo = $3
        AND EXISTS (
          SELECT 1
          FROM carga_curricular cc
          WHERE cc.id_curso = nf.id_curso
            AND cc.id_grado = a.id_grado
            AND cc.anio_lectivo = $3
        )
      WHERE a.id_grado = $1
        AND a.estado_matricula = 'Matriculado'
        AND a.anio_lectivo = $3
      GROUP BY a.id_alumno, a.nombres, a.apellidos, a.codigo_estudiante, a.dni
    )
    SELECT 
      ROW_NUMBER() OVER (
        ORDER BY promedio_ponderado DESC NULLS LAST,
                 total_ad DESC,
                 na.total_cursos DESC,
                 nombre_completo
      ) AS puesto,
      na.*,
      carga.total_cursos AS total_cursos_carga
    FROM notas_alumno na
    CROSS JOIN carga
    WHERE carga.total_cursos > 0
      AND na.total_cursos = carga.total_cursos
    ORDER BY puesto
    LIMIT 10
  `;
  const result = await query(sql, [id_grado, bimestre, anioLectivo]);
  return result.rows;
};

/**
 * Libreta completa de un alumno (notas + conclusiones + asistencia)
 */
const getLibretaAlumno = async (id_alumno, bimestre, anioLectivo = getAnioLectivo()) => {
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
      AND a.anio_lectivo = $2
  `;
  const alumnoResult = await query(alumnoSql, [id_alumno, anioLectivo]);
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
      AND EXTRACT(YEAR FROM fecha) = $2
  `;
  const asistenciaResult = await query(asistenciaSql, [
    id_alumno,
    anioLectivo,
  ]);

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
const getResumenAsistenciaGrado = async (id_grado, anioLectivo = getAnioLectivo()) => {
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
    LEFT JOIN asistencia_alumnos asis
      ON asis.id_alumno = a.id_alumno
      AND EXTRACT(YEAR FROM asis.fecha) = $2
    WHERE a.id_grado = $1
      AND a.estado_matricula = 'Matriculado'
      AND a.anio_lectivo = $2
    GROUP BY a.id_alumno, a.dni, a.nombres, a.apellidos, a.codigo_estudiante
    ORDER BY porcentaje_asistencia ASC NULLS LAST, a.apellidos
  `;
  const result = await query(sql, [id_grado, anioLectivo]);
  return result.rows;
};

/**
 * Auditoría de carga de notas por docentes (para SIAGIE)
 * Muestra quién ya completó y quién está pendiente
 */
const getAuditoriaDocentes = async (id_grado, bimestre, anioLectivo = getAnioLectivo()) => {
  const sql = `
    SELECT 
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      p.id_personal,
      u.nombres || ' ' || u.apellidos AS docente_nombre,
      u.correo_institucional AS docente_correo_institucional,
      u.correo_personal AS docente_correo_personal,
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

/**
 * Consolidado histórico de un estudiante por DNI (H49 / Fase 6.4).
 *
 * Agrupa por `id_usuario`/DNI, no por `id_alumno`: cada año lectivo tiene su
 * propia matrícula, notas, asistencia, pagos y pensiones. No se suman años
 * dentro de una misma fila; el llamador recibe una fila por año.
 */
const getConsolidadoPorDni = async (dni) => {
  const personaResult = await query(
    `SELECT id_usuario, dni, nombres, apellidos,
            nombres || ' ' || apellidos AS nombre_completo
     FROM usuarios
     WHERE dni = $1
     LIMIT 1`,
    [String(dni || "").trim()],
  );
  const persona = personaResult.rows[0] || null;
  if (!persona) return null;

  const tienePromociones = await query(
    `SELECT to_regclass('public.promociones') AS tabla`,
  );
  const joinPromocion = tienePromociones.rows[0]?.tabla
    ? `LEFT JOIN LATERAL (
         SELECT p.resultado, p.anio_destino
         FROM promociones p
         WHERE p.id_alumno_origen = a.id_alumno
           AND p.estado = 'CONFIRMADA'
         ORDER BY p.fecha_confirmacion DESC NULLS LAST, p.id_promocion DESC
         LIMIT 1
       ) pr ON TRUE`
    : "";
  const campoResultado = tienePromociones.rows[0]?.tabla
    ? "pr.resultado"
    : "NULL::varchar";
  const campoAnioDestino = tienePromociones.rows[0]?.tabla
    ? "pr.anio_destino"
    : "NULL::integer";

  const sql = `
    SELECT
      a.anio_lectivo AS anio,
      a.id_alumno,
      a.id_usuario,
      a.dni,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      a.codigo_estudiante,
      a.condicion,
      a.estado_matricula,
      g.nombre_grado AS grado,
      g.seccion,
      a.id_grado,
      ${campoResultado} AS resultado_promocion,
      ${campoAnioDestino} AS anio_destino_promocion,
      COALESCE(nf.notas_ad, 0)::int AS notas_ad,
      COALESCE(nf.notas_a, 0)::int AS notas_a,
      COALESCE(nf.notas_b, 0)::int AS notas_b,
      COALESCE(nf.notas_c, 0)::int AS notas_c,
      COALESCE(nf.total_notas, 0)::int AS total_notas,
      COALESCE(asis.total_asistencias, 0)::int AS total_asistencias,
      COALESCE(asis.total_faltas, 0)::int AS total_faltas,
      asis.porcentaje_asistencia,
      COALESCE(pg.total_pagado, 0) AS total_pagado,
      COALESCE(pe.deuda_pendiente, 0) AS deuda_pendiente,
      COALESCE(pe.total_pensiones, 0)::int AS total_pensiones,
      COALESCE(pe.pensiones_pagadas, 0)::int AS pensiones_pagadas
    FROM alumnos a
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    ${joinPromocion}
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE nf.nota_final = 'AD') AS notas_ad,
        COUNT(*) FILTER (WHERE nf.nota_final = 'A') AS notas_a,
        COUNT(*) FILTER (WHERE nf.nota_final = 'B') AS notas_b,
        COUNT(*) FILTER (WHERE nf.nota_final = 'C') AS notas_c,
        COUNT(*) AS total_notas
      FROM notas_finales_area nf
      WHERE nf.id_alumno = a.id_alumno
        AND nf.anio_lectivo = a.anio_lectivo
    ) nf ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) AS total_asistencias,
        COUNT(*) FILTER (WHERE asis.estado = 'F') AS total_faltas,
        ROUND(
          (COUNT(*) FILTER (WHERE asis.estado = 'P')::decimal
            / NULLIF(COUNT(*), 0) * 100),
          2
        ) AS porcentaje_asistencia
      FROM asistencia_alumnos asis
      WHERE asis.id_alumno = a.id_alumno
        AND EXTRACT(YEAR FROM asis.fecha) = a.anio_lectivo
    ) asis ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(p.monto), 0) AS total_pagado
      FROM pagos p
      WHERE p.id_alumno = a.id_alumno
        AND p.estado = 'PAGADO'
    ) pg ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(pe.monto_final) FILTER (WHERE pe.estado = 'PENDIENTE'), 0)
          AS deuda_pendiente,
        COUNT(*) AS total_pensiones,
        COUNT(*) FILTER (WHERE pe.estado = 'PAGADO') AS pensiones_pagadas
      FROM pensiones pe
      WHERE pe.id_alumno = a.id_alumno
        AND pe.anio_lectivo = a.anio_lectivo
    ) pe ON TRUE
    WHERE a.id_usuario = $1
    ORDER BY a.anio_lectivo DESC
  `;

  const result = await query(sql, [persona.id_usuario]);

  const anios = result.rows.map((fila) => ({
    ...fila,
    anio: Number(fila.anio),
    id_alumno: Number(fila.id_alumno),
    id_usuario: Number(fila.id_usuario),
    id_grado: fila.id_grado === null ? null : Number(fila.id_grado),
    notas_ad: Number(fila.notas_ad) || 0,
    notas_a: Number(fila.notas_a) || 0,
    notas_b: Number(fila.notas_b) || 0,
    notas_c: Number(fila.notas_c) || 0,
    total_notas: Number(fila.total_notas) || 0,
    total_asistencias: Number(fila.total_asistencias) || 0,
    total_faltas: Number(fila.total_faltas) || 0,
    porcentaje_asistencia:
      fila.porcentaje_asistencia === null
        ? null
        : Number(fila.porcentaje_asistencia),
    total_pagado: Number(fila.total_pagado) || 0,
    deuda_pendiente: Number(fila.deuda_pendiente) || 0,
    total_pensiones: Number(fila.total_pensiones) || 0,
    pensiones_pagadas: Number(fila.pensiones_pagadas) || 0,
    anio_destino_promocion:
      fila.anio_destino_promocion === null
        ? null
        : Number(fila.anio_destino_promocion),
  }));

  return {
    usuario: {
      id_usuario: Number(persona.id_usuario),
      dni: persona.dni,
      nombre_completo: persona.nombre_completo,
    },
    anios,
    totales: {
      anios: anios.length,
      total_pagado: anios.reduce((suma, fila) => suma + fila.total_pagado, 0),
      deuda_pendiente: anios.reduce(
        (suma, fila) => suma + fila.deuda_pendiente,
        0,
      ),
      total_notas: anios.reduce((suma, fila) => suma + fila.total_notas, 0),
      total_pensiones: anios.reduce(
        (suma, fila) => suma + fila.total_pensiones,
        0,
      ),
    },
  };
};

module.exports = {
  getDashboardEjecutivo,
  getAlumnosRiesgo,
  getCuadroMerito,
  getLibretaAlumno,
  getResumenAsistenciaGrado,
  getAuditoriaDocentes,
  getConsolidadoPorDni,
};
