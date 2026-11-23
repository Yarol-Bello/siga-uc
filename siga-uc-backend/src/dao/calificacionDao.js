/**
 * DAO para la tabla calificaciones y notas_finales_area
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");
const { getAnioLectivo } = require("../config/academico");

const ejecutar = async (client, texto, params = []) => {
  const result = client
    ? await client.query(texto, params)
    : await query(texto, params);
  return result.rows;
};

/**
 * Obtener calificaciones de un alumno en un curso (por competencias)
 */
const obtenerPorAlumnoCurso = async (
  id_alumno,
  id_curso,
  anioLectivo = getAnioLectivo(),
  idPersonal = null,
) => {
  const sql = `
    SELECT 
      comp.id_competencia,
      comp.nombre_competencia,
      comp.orden,
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      cal.id_calificacion,
      cal.bimestre,
      cal.calificacion,
      cal.fecha_registro,
      cal.fecha_modificacion
    FROM competencias comp
    INNER JOIN cursos c ON c.id_curso = comp.id_curso
    LEFT JOIN calificaciones cal 
      ON cal.id_competencia = comp.id_competencia 
      AND cal.id_alumno = $1
      AND cal.anio_lectivo = $3
    WHERE comp.id_curso = $2
      AND (
        $4::INT IS NULL
        OR EXISTS (
          SELECT 1 FROM carga_curricular cc
          WHERE cc.id_personal = $4
            AND cc.id_curso = $2
            AND cc.anio_lectivo = $3
        )
      )
    ORDER BY comp.orden, cal.bimestre
  `;
  const result = await query(sql, [
    id_alumno,
    id_curso,
    anioLectivo,
    idPersonal,
  ]);
  return result.rows;
};

/**
 * Obtener calificaciones de todo un grado/curso (para el docente)
 * Retorna matriz de [alumno][competencia][bimestre]
 */
const obtenerPorCursoGrado = async (
  id_curso,
  id_grado,
  bimestre,
  anioLectivo = getAnioLectivo(),
  idPersonal = null,
) => {
  // 1. Obtener competencias del curso
  const competenciasSql = `
    SELECT id_competencia, nombre_competencia, orden
    FROM competencias
    WHERE id_curso = $1
    ORDER BY orden
  `;
  const competenciasResult = await query(competenciasSql, [id_curso]);
  const competencias = competenciasResult.rows;

  // 2. Obtener alumnos del grado
  const alumnosSql = `
    SELECT 
      a.id_alumno, a.dni, a.nombres, a.apellidos,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      a.codigo_estudiante
    FROM alumnos a
    WHERE a.id_grado = $1 AND a.estado_matricula = 'Matriculado'
      AND a.anio_lectivo = $4
      AND (
        $2::INT IS NULL
        OR EXISTS (
          SELECT 1 FROM carga_curricular cc
          WHERE cc.id_personal = $2
            AND cc.id_curso = $3
            AND cc.id_grado = $1
            AND cc.anio_lectivo = $4
        )
      )
    ORDER BY a.apellidos, a.nombres
  `;
  const alumnosResult = await query(alumnosSql, [
    id_grado,
    idPersonal,
    id_curso,
    anioLectivo,
  ]);
  const alumnos = alumnosResult.rows;

  // 3. Obtener calificaciones registradas
  const calificacionesSql = `
    SELECT 
      cal.id_alumno,
      cal.id_competencia,
      cal.calificacion
    FROM calificaciones cal
    WHERE cal.id_curso = $1
      AND cal.bimestre = $2
      AND cal.anio_lectivo = $3
      AND cal.id_alumno IN (
        SELECT id_alumno
        FROM alumnos
        WHERE id_grado = $4
          AND estado_matricula = 'Matriculado'
          AND anio_lectivo = $3
      )
      AND (
        $5::INT IS NULL
        OR EXISTS (
          SELECT 1 FROM carga_curricular cc
          WHERE cc.id_personal = $5
            AND cc.id_curso = $1
            AND cc.id_grado = $4
            AND cc.anio_lectivo = $3
        )
      )
  `;
  const calificacionesResult = await query(calificacionesSql, [
    id_curso,
    bimestre,
    anioLectivo,
    id_grado,
    idPersonal,
  ]);
  const calificacionesMap = {};
  calificacionesResult.rows.forEach((c) => {
    calificacionesMap[`${c.id_alumno}-${c.id_competencia}`] = c.calificacion;
  });

  // 4. Armar matriz de respuesta
  const data = alumnos.map((alumno) => ({
    id_alumno: alumno.id_alumno,
    dni: alumno.dni,
    nombre_completo: alumno.nombre_completo,
    codigo_estudiante: alumno.codigo_estudiante,
    calificaciones: competencias.map((comp) => ({
      id_competencia: comp.id_competencia,
      nombre_competencia: comp.nombre_competencia,
      calificacion:
        calificacionesMap[`${alumno.id_alumno}-${comp.id_competencia}`] || null,
    })),
  }));

  return {
    competencias,
    alumnos: data,
  };
};

/**
 * Registrar o actualizar una calificación (upsert)
 */
const registrar = async (data) => {
  const sql = `
    INSERT INTO calificaciones (
      id_alumno, id_curso, id_competencia, id_personal, id_grado,
      bimestre, anio_lectivo, calificacion, modificado_por
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (id_alumno, id_curso, id_competencia, bimestre, anio_lectivo)
    DO UPDATE SET
      calificacion = EXCLUDED.calificacion,
      fecha_modificacion = NOW(),
      modificado_por = EXCLUDED.modificado_por,
      justificacion_modificacion = EXCLUDED.justificacion_modificacion
    RETURNING *
  `;
  const result = await query(sql, [
    data.id_alumno,
    data.id_curso,
    data.id_competencia,
    data.id_personal,
    data.id_grado,
    data.bimestre,
    data.anio_lectivo || getAnioLectivo(),
    data.calificacion,
    data.modificado_por || null,
  ]);
  return result.rows[0];
};

/**
 * Registrar calificaciones masivas (toda un aula)
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

      if (
        !reg.id_alumno ||
        !reg.id_curso ||
        !reg.id_competencia ||
        !reg.bimestre
      ) {
        agregarError(
          indice,
          reg.id_alumno,
          `Alumno ${reg.id_alumno || "sin ID"}: faltan datos obligatorios (curso, competencia o bimestre).`,
        );
        continue;
      }

      if (!["AD", "A", "B", "C"].includes(String(reg.calificacion))) {
        agregarError(
          indice,
          reg.id_alumno,
          `Alumno ${reg.id_alumno}: calificación inválida (debe ser AD, A, B o C).`,
        );
        continue;
      }

      try {
        const sql = `
          INSERT INTO calificaciones (
            id_alumno, id_curso, id_competencia, id_personal, id_grado,
            bimestre, anio_lectivo, calificacion, modificado_por
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id_alumno, id_curso, id_competencia, bimestre, anio_lectivo)
          DO UPDATE SET
            calificacion = EXCLUDED.calificacion,
            fecha_modificacion = NOW(),
            modificado_por = EXCLUDED.modificado_por
        `;
        await client.query(sql, [
          reg.id_alumno,
          reg.id_curso,
          reg.id_competencia,
          reg.id_personal,
          reg.id_grado,
          reg.bimestre,
          reg.anio_lectivo || getAnioLectivo(),
          reg.calificacion,
          reg.modificado_por || null,
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

/**
 * Calcular nota final del área (predominancia AD > A > B > C)
 * Retorna la nota final según reglas:
 * - Si ≥2 competencias con AD → AD
 * - Si ≥2 competencias con A → A
 * - Si ≥2 competencias con B → B
 * - Sino → C
 */
const calcularNotaFinal = async (
  id_alumno,
  id_curso,
  bimestre,
  anioLectivo,
) => {
  // Fuente única de verdad: función SQL calcular_nota_final_area.
  const sql = `
    SELECT public.calcular_nota_final_area(
      $1::INT, $2::INT, $3::INT, $4::INT
    ) AS nota_final
  `;
  const result = await query(sql, [
    id_alumno,
    id_curso,
    bimestre,
    anioLectivo,
  ]);
  return result.rows[0]?.nota_final || "C";
};

/**
 * Guardar nota final (upsert)
 */
const guardarNotaFinal = async (data) => {
  const sql = `
    INSERT INTO notas_finales_area (
      id_alumno, id_curso, bimestre, anio_lectivo, nota_final, calculo_automatico
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id_alumno, id_curso, bimestre, anio_lectivo)
    DO UPDATE SET
      nota_final = EXCLUDED.nota_final,
      calculo_automatico = EXCLUDED.calculo_automatico
    RETURNING *
  `;
  const result = await query(sql, [
    data.id_alumno,
    data.id_curso,
    data.bimestre,
    data.anio_lectivo || getAnioLectivo(),
    data.nota_final,
    data.calculo_automatico !== false,
  ]);
  return result.rows[0];
};

/**
 * Obtener notas finales de un alumno
 */
const obtenerNotasFinales = async (
  id_alumno,
  anioLectivo = getAnioLectivo(),
  idPersonal = null,
) => {
  const sql = `
    SELECT 
      nf.id_nota_final,
      nf.bimestre,
      nf.nota_final,
      nf.calculo_automatico,
      c.id_curso,
      c.nombre_curso,
      c.area_academica
    FROM notas_finales_area nf
    INNER JOIN cursos c ON c.id_curso = nf.id_curso
    WHERE nf.id_alumno = $1 AND nf.anio_lectivo = $2
      AND (
        $3::INT IS NULL
        OR EXISTS (
          SELECT 1 FROM carga_curricular cc
          WHERE cc.id_personal = $3
            AND cc.id_curso = nf.id_curso
            AND cc.anio_lectivo = $2
        )
      )
    ORDER BY c.area_academica, c.nombre_curso, nf.bimestre
  `;
  const result = await query(sql, [id_alumno, anioLectivo, idPersonal]);
  return result.rows;
};

/**
 * Obtener conclusión descriptiva
 */
const obtenerConclusiones = async (
  id_alumno,
  anioLectivo = getAnioLectivo(),
  idPersonal = null,
) => {
  const sql = `
    SELECT 
      cd.id_conclusion,
      cd.bimestre,
      cd.descripcion,
      c.id_curso,
      c.nombre_curso,
      u.nombres || ' ' || u.apellidos AS docente
    FROM conclusiones_descriptivas cd
    INNER JOIN cursos c ON c.id_curso = cd.id_curso
    LEFT JOIN personal p ON p.id_personal = cd.id_personal
    LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
    WHERE cd.id_alumno = $1 AND cd.anio_lectivo = $2
      AND (
        $3::INT IS NULL
        OR EXISTS (
          SELECT 1 FROM carga_curricular cc
          WHERE cc.id_personal = $3
            AND cc.id_curso = cd.id_curso
            AND cc.anio_lectivo = $2
        )
      )
    ORDER BY c.nombre_curso, cd.bimestre
  `;
  const result = await query(sql, [id_alumno, anioLectivo, idPersonal]);
  return result.rows;
};

/**
 * Listar alumnos de un curso/grado con su nota final y conclusión descriptiva.
 * La conclusión es por alumno/curso/bimestre/año (Opción A).
 */
const listarConclusionesCursoGrado = async (
  id_curso,
  id_grado,
  bimestre,
  anioLectivo = getAnioLectivo(),
  idPersonal = null,
) => {
  const sql = `
    SELECT
      a.id_alumno,
      a.dni,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      a.codigo_estudiante,
      nf.nota_final,
      cd.id_conclusion,
      cd.nivel_logro,
      cd.avance,
      cd.dificultad,
      cd.sugerencia,
      cd.descripcion,
      cd.estado,
      cd.actualizado_en
    FROM alumnos a
    LEFT JOIN notas_finales_area nf
      ON nf.id_alumno = a.id_alumno
     AND nf.id_curso = $1
     AND nf.bimestre = $2
     AND nf.anio_lectivo = $3
    LEFT JOIN conclusiones_descriptivas cd
      ON cd.id_alumno = a.id_alumno
     AND cd.id_curso = $1
     AND cd.bimestre = $2
     AND cd.anio_lectivo = $3
    WHERE a.id_grado = $4
      AND a.anio_lectivo = $3
      AND a.estado_matricula = 'Matriculado'
      AND (
        $5::INT IS NULL
        OR EXISTS (
          SELECT 1 FROM carga_curricular cc
          WHERE cc.id_personal = $5
            AND cc.id_curso = $1
            AND cc.id_grado = $4
            AND cc.anio_lectivo = $3
        )
      )
    ORDER BY a.apellidos, a.nombres
  `;
  return await ejecutar(null, sql, [
    id_curso,
    bimestre,
    anioLectivo,
    id_grado,
    idPersonal,
  ]);
};

/**
 * Obtener la nota final de un alumno/curso/bimestre/año.
 */
const obtenerNotaFinal = async (
  id_alumno,
  id_curso,
  bimestre,
  anioLectivo,
  client = null,
) => {
  const rows = await ejecutar(
    client,
    `SELECT nota_final
     FROM notas_finales_area
     WHERE id_alumno = $1
       AND id_curso = $2
       AND bimestre = $3
       AND anio_lectivo = $4
     LIMIT 1`,
    [id_alumno, id_curso, bimestre, anioLectivo],
  );
  return rows[0] || null;
};

/**
 * Obtener una conclusión descriptiva puntual.
 */
const findConclusion = async (
  id_alumno,
  id_curso,
  bimestre,
  anioLectivo,
  client = null,
) => {
  const rows = await ejecutar(
    client,
    `SELECT id_conclusion, id_alumno, id_curso, bimestre, anio_lectivo,
            descripcion, nivel_logro, avance, dificultad, sugerencia,
            estado, id_personal, actualizado_por, actualizado_en,
            publicado_por, publicado_en
     FROM conclusiones_descriptivas
     WHERE id_alumno = $1
       AND id_curso = $2
       AND bimestre = $3
       AND anio_lectivo = $4
     LIMIT 1`,
    [id_alumno, id_curso, bimestre, anioLectivo],
  );
  return rows[0] || null;
};

/**
 * Guardar o actualizar una conclusión descriptiva estructurada.
 */
const guardarConclusion = async (data, client = null) => {
  const rows = await ejecutar(
    client,
    `INSERT INTO conclusiones_descriptivas (
       id_alumno, id_curso, bimestre, anio_lectivo, descripcion,
       nivel_logro, avance, dificultad, sugerencia, estado,
       id_personal, actualizado_por, actualizado_en,
       publicado_por, publicado_en
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12, now(), $13,
       CASE WHEN $14 THEN now() ELSE NULL END
     )
     ON CONFLICT ON CONSTRAINT uq_conclusion
     DO UPDATE SET
       descripcion = EXCLUDED.descripcion,
       nivel_logro = EXCLUDED.nivel_logro,
       avance = EXCLUDED.avance,
       dificultad = EXCLUDED.dificultad,
       sugerencia = EXCLUDED.sugerencia,
       estado = EXCLUDED.estado,
       id_personal = EXCLUDED.id_personal,
       actualizado_por = EXCLUDED.actualizado_por,
       actualizado_en = now(),
       publicado_por = CASE
         WHEN EXCLUDED.estado = 'PUBLICADO' THEN EXCLUDED.publicado_por
         ELSE conclusiones_descriptivas.publicado_por
       END,
       publicado_en = CASE
         WHEN EXCLUDED.estado = 'PUBLICADO'
           THEN COALESCE(conclusiones_descriptivas.publicado_en, now())
         ELSE conclusiones_descriptivas.publicado_en
       END
     RETURNING
       id_conclusion, id_alumno, id_curso, bimestre, anio_lectivo,
       descripcion, nivel_logro, avance, dificultad, sugerencia,
       estado, id_personal, actualizado_por, actualizado_en,
       publicado_por, publicado_en`,
    [
      data.id_alumno,
      data.id_curso,
      data.bimestre,
      data.anio_lectivo,
      data.descripcion,
      data.nivel_logro,
      data.avance,
      data.dificultad,
      data.sugerencia,
      data.estado,
      data.id_personal,
      data.actualizado_por,
      data.publicado_por,
      data.estado === "PUBLICADO",
    ],
  );
  return rows[0];
};

module.exports = {
  obtenerPorAlumnoCurso,
  obtenerPorCursoGrado,
  registrar,
  registrarMasivo,
  calcularNotaFinal,
  guardarNotaFinal,
  obtenerNotasFinales,
  obtenerConclusiones,
  listarConclusionesCursoGrado,
  obtenerNotaFinal,
  findConclusion,
  guardarConclusion,
};
