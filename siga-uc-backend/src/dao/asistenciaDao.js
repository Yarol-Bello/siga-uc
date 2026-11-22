/**
 * DAO para la tabla asistencia_alumnos
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");

/**
 * Obtener asistencia de un curso en una fecha específica
 */
const obtenerPorCursoFecha = async (
  id_curso,
  fecha,
  id_grado,
  idPersonal = null,
) => {
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
      AND a.anio_lectivo = EXTRACT(YEAR FROM $2::date)::int
      AND (
        $4::INT IS NULL
        OR EXISTS (
          SELECT 1 FROM carga_curricular cc
          WHERE cc.id_personal = $4
            AND cc.id_curso = $1
            AND cc.id_grado = $3
            AND cc.anio_lectivo = EXTRACT(YEAR FROM $2::date)::int
        )
      )
    ORDER BY a.apellidos, a.nombres
  `;
  const result = await query(sql, [id_curso, fecha, id_grado, idPersonal]);
  return result.rows;
};

/**
 * Obtener historial de asistencia de un alumno
 */
const obtenerPorAlumno = async (id_alumno, filtros = {}, idPersonal = null) => {
  const anioLectivo = Number(filtros.anio);
  const conditions = [
    "asis.id_alumno = $1",
    "EXTRACT(YEAR FROM asis.fecha) = $2",
  ];
  const params = [id_alumno, anioLectivo];
  let idx = 3;

  if (idPersonal) {
    conditions.push(
      `EXISTS (
        SELECT 1 FROM carga_curricular cc
        WHERE cc.id_personal = $${idx}
          AND cc.id_curso = asis.id_curso
          AND cc.id_grado = asis.id_grado
          AND cc.anio_lectivo = $2
      )`,
    );
    params.push(idPersonal);
    idx++;
  }

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
      CASE EXTRACT(ISODOW FROM asis.fecha)
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
        WHEN 7 THEN 'Domingo'
      END AS dia_semana,
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
const obtenerResumenPorAlumno = async (
  id_alumno,
  anioLectivo,
  idPersonal = null,
) => {
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
      AND EXTRACT(YEAR FROM asis.fecha) = $2
      AND (
        $3::INT IS NULL
        OR EXISTS (
          SELECT 1 FROM carga_curricular cc
          WHERE cc.id_personal = $3
            AND cc.id_curso = asis.id_curso
            AND cc.anio_lectivo = $2
        )
      )
    GROUP BY c.id_curso, c.nombre_curso, c.area_academica
    ORDER BY c.nombre_curso
  `;
  const result = await query(sql, [id_alumno, anioLectivo, idPersonal]);
  return result.rows;
};

/**
 * Obtener estadísticas generales de un alumno
 */
const obtenerEstadisticasAlumno = async (
  id_alumno,
  anioLectivo,
  idPersonal = null,
) => {
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
    FROM asistencia_alumnos asis
    WHERE asis.id_alumno = $1
      AND EXTRACT(YEAR FROM asis.fecha) = $2
      AND (
        $3::INT IS NULL
        OR EXISTS (
          SELECT 1 FROM carga_curricular cc
          WHERE cc.id_personal = $3
            AND cc.id_curso = asis.id_curso
            AND cc.anio_lectivo = $2
        )
      )
  `;
  const result = await query(sql, [id_alumno, anioLectivo, idPersonal]);
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
    ) VALUES (
      $1, $2, $3, $4, $5,
      CASE EXTRACT(ISODOW FROM $5::date)
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
        WHEN 7 THEN 'Domingo'
      END,
      $6, $7, $8, $9
    )
    ON CONFLICT (id_alumno, id_curso, fecha) 
    DO UPDATE SET
      dia_semana = EXCLUDED.dia_semana,
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
  let guardados = 0;
  let totalErrores = 0;
  const errores = [];

  const agregarError = (indice, idAlumno, mensaje) => {
    totalErrores += 1;
    if (errores.length < 20) {
      errores.push({ indice, id_alumno: idAlumno, mensaje });
    }
  };

  try {
    await client.query("BEGIN");

    for (let indice = 0; indice < registros.length; indice += 1) {
      const reg = registros[indice];

      if (!reg.id_alumno || !reg.id_curso || !reg.id_grado || !reg.fecha) {
        agregarError(
          indice,
          reg.id_alumno,
          `Alumno ${reg.id_alumno || "sin ID"}: faltan datos obligatorios (curso, grado o fecha).`,
        );
        continue;
      }

      if (!["P", "T", "F"].includes(String(reg.estado))) {
        agregarError(
          indice,
          reg.id_alumno,
          `Alumno ${reg.id_alumno}: estado de asistencia inválido.`,
        );
        continue;
      }

      try {
        const sql = `
          INSERT INTO asistencia_alumnos (
            id_alumno, id_curso, id_personal, id_grado, 
            fecha, dia_semana, estado, observacion, justificada, motivo_justificacion
          ) VALUES (
            $1, $2, $3, $4, $5,
            CASE EXTRACT(ISODOW FROM $5::date)
              WHEN 1 THEN 'Lunes'
              WHEN 2 THEN 'Martes'
              WHEN 3 THEN 'Miércoles'
              WHEN 4 THEN 'Jueves'
              WHEN 5 THEN 'Viernes'
              WHEN 6 THEN 'Sábado'
              WHEN 7 THEN 'Domingo'
            END,
            $6, $7, $8, $9
          )
          ON CONFLICT (id_alumno, id_curso, fecha) 
          DO UPDATE SET
            dia_semana = EXCLUDED.dia_semana,
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
          reg.estado,
          reg.observacion || null,
          reg.justificada || false,
          reg.motivo_justificacion || null,
        ]);
        guardados += 1;
      } catch (err) {
        agregarError(
          indice,
          reg.id_alumno,
          `Alumno ${reg.id_alumno}: ${err.message}`,
        );
      }
    }

    await client.query("COMMIT");
    return {
      guardados,
      total_errores: totalErrores,
      errores,
      insertados: guardados,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// ASISTENCIA DE PERSONAL (DOCENTES + ADMINISTRATIVOS)
// ============================================================

/**
 * Listar asistencias del personal en una fecha
 */
const listarAsistenciaPersonal = async (fecha) => {
  const sql = `
    SELECT 
      p.id_personal,
      u.dni,
      u.nombres || ' ' || u.apellidos AS nombre_completo,
      u.nombres,
      u.apellidos,
      u.correo_institucional,
      r.nombre_rol,
      p.especialidad,
      p.cargo,
      ap.id_asistencia_personal,
      ap.fecha,
      ap.hora_ingreso,
      ap.hora_salida,
      ap.estado,
      ap.observacion
    FROM personal p
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    INNER JOIN roles r ON r.id_rol = u.id_rol
    LEFT JOIN asistencia_personal ap 
      ON ap.id_personal = p.id_personal 
      AND ap.fecha = $1
    WHERE u.estado = 'ACTIVO'
    ORDER BY u.apellidos, u.nombres
  `;
  const result = await query(sql, [fecha]);
  return result.rows;
};

/**
 * Buscar asistencia de personal por DNI (para escaneo QR)
 */
const buscarPersonalPorDni = async (dni) => {
  const sql = `
    SELECT 
      p.id_personal,
      u.dni,
      u.nombres || ' ' || u.apellidos AS nombre_completo,
      r.nombre_rol,
      p.cargo,
      u.estado
    FROM personal p
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    INNER JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.dni = $1
  `;
  const result = await query(sql, [dni]);
  return result.rows[0] || null;
};

/**
 * Registrar marcación de asistencia del personal
 */
const registrarAsistenciaPersonal = async (data) => {
  const sql = `
    INSERT INTO asistencia_personal (id_personal, fecha, hora_ingreso, estado, observacion)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id_personal, fecha)
    DO UPDATE SET
      hora_ingreso = EXCLUDED.hora_ingreso,
      estado = EXCLUDED.estado,
      observacion = EXCLUDED.observacion
    RETURNING *
  `;
  const result = await query(sql, [
    data.id_personal,
    data.fecha,
    data.hora_ingreso || null,
    data.estado || "Puntual",
    data.observacion || null,
  ]);
  return result.rows[0];
};

/**
 * Obtener resumen de asistencia del personal
 */
const obtenerResumenAsistenciaPersonal = async (fecha) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM personal p 
       INNER JOIN usuarios u ON u.id_usuario = p.id_usuario 
       WHERE u.estado = 'ACTIVO') AS total_personal,
      COUNT(*) FILTER (WHERE estado = 'Puntual') AS total_puntual,
      COUNT(*) FILTER (WHERE estado = 'Tardanza') AS total_tardanza,
      COUNT(*) FILTER (WHERE estado = 'Falta') AS total_falta
    FROM asistencia_personal
    WHERE fecha = $1
  `;
  const result = await query(sql, [fecha]);
  return result.rows[0];
};

module.exports = {
  obtenerPorCursoFecha,
  obtenerPorAlumno,
  obtenerResumenPorAlumno,
  obtenerEstadisticasAlumno,
  registrar,
  registrarMasivo,
  listarAsistenciaPersonal,
  buscarPersonalPorDni,
  registrarAsistenciaPersonal,
  obtenerResumenAsistenciaPersonal,
};
