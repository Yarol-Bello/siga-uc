/**
 * DAO para la tabla carga_curricular y tutores_grado
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");

/**
 * Listar toda la carga curricular (con filtros)
 */
const listar = async (filtros = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filtros.id_grado) {
    conditions.push(`cc.id_grado = $${idx++}`);
    params.push(filtros.id_grado);
  }
  if (filtros.id_personal) {
    conditions.push(`cc.id_personal = $${idx++}`);
    params.push(filtros.id_personal);
  }
  if (filtros.id_curso) {
    conditions.push(`cc.id_curso = $${idx++}`);
    params.push(filtros.id_curso);
  }
  if (filtros.anio_lectivo) {
    conditions.push(`cc.anio_lectivo = $${idx++}`);
    params.push(filtros.anio_lectivo);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT 
      cc.id_carga,
      cc.anio_lectivo,
      cc.horas_asignadas,
      g.id_grado,
      g.nombre_grado,
      g.seccion,
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      p.id_personal,
      u.nombres AS docente_nombres,
      u.apellidos AS docente_apellidos,
      u.nombres || ' ' || u.apellidos AS docente_nombre_completo,
      p.especialidad
    FROM carga_curricular cc
    INNER JOIN grados g ON g.id_grado = cc.id_grado
    INNER JOIN cursos c ON c.id_curso = cc.id_curso
    INNER JOIN personal p ON p.id_personal = cc.id_personal
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    ${where}
    ORDER BY g.id_grado, c.area_academica, c.nombre_curso
  `;

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Buscar carga curricular por ID
 */
const findById = async (id) => {
  const sql = `
    SELECT 
      cc.*,
      g.nombre_grado,
      c.nombre_curso,
      u.nombres || ' ' || u.apellidos AS docente_nombre_completo
    FROM carga_curricular cc
    INNER JOIN grados g ON g.id_grado = cc.id_grado
    INNER JOIN cursos c ON c.id_curso = cc.id_curso
    INNER JOIN personal p ON p.id_personal = cc.id_personal
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    WHERE cc.id_carga = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Listar carga por grado
 */
const listarPorGrado = async (id_grado) => {
  const sql = `
    SELECT 
      cc.id_carga,
      cc.horas_asignadas,
      c.id_curso,
      c.nombre_curso,
      c.area_academica,
      p.id_personal,
      u.nombres || ' ' || u.apellidos AS docente_nombre_completo,
      p.especialidad
    FROM carga_curricular cc
    INNER JOIN cursos c ON c.id_curso = cc.id_curso
    INNER JOIN personal p ON p.id_personal = cc.id_personal
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    WHERE cc.id_grado = $1
    ORDER BY c.area_academica, c.nombre_curso
  `;
  const result = await query(sql, [id_grado]);
  return result.rows;
};

/**
 * Listar cursos de un docente
 */
const listarPorDocente = async (id_personal, anioLectivo = 2026) => {
  const sql = `
    SELECT 
      cc.id_carga,
      cc.horas_asignadas,
      g.id_grado,
      g.nombre_grado,
      g.seccion,
      c.id_curso,
      c.nombre_curso,
      c.area_academica
    FROM carga_curricular cc
    INNER JOIN grados g ON g.id_grado = cc.id_grado
    INNER JOIN cursos c ON c.id_curso = cc.id_curso
    WHERE cc.id_personal = $1 AND cc.anio_lectivo = $2
    ORDER BY g.id_grado, c.nombre_curso
  `;
  const result = await query(sql, [id_personal, anioLectivo]);
  return result.rows;
};

/**
 * Obtener el tutor de un grado
 */
const getTutor = async (id_grado, anioLectivo = 2026) => {
  const sql = `
    SELECT 
      tg.id_tutor,
      p.id_personal,
      u.nombres,
      u.apellidos,
      u.nombres || ' ' || u.apellidos AS nombre_completo,
      u.correo_institucional,
      p.especialidad
    FROM tutores_grado tg
    INNER JOIN personal p ON p.id_personal = tg.id_personal
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    WHERE tg.id_grado = $1 AND tg.anio_lectivo = $2
    LIMIT 1
  `;
  const result = await query(sql, [id_grado, anioLectivo]);
  return result.rows[0] || null;
};

/**
 * Crear asignación de carga curricular
 */
const crear = async (data) => {
  const sql = `
    INSERT INTO carga_curricular (id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const result = await query(sql, [
    data.id_grado,
    data.id_curso,
    data.id_personal,
    data.anio_lectivo || 2026,
    data.horas_asignadas || null,
  ]);
  return result.rows[0];
};

/**
 * Actualizar carga curricular
 */
const actualizar = async (id, data) => {
  const sql = `
    UPDATE carga_curricular SET
      id_personal = COALESCE($1, id_personal),
      horas_asignadas = COALESCE($2, horas_asignadas)
    WHERE id_carga = $3
    RETURNING *
  `;
  const result = await query(sql, [data.id_personal, data.horas_asignadas, id]);
  return result.rows[0] || null;
};

/**
 * Eliminar carga curricular
 */
const eliminar = async (id) => {
  const sql = `DELETE FROM carga_curricular WHERE id_carga = $1 RETURNING *`;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Asignar tutor a un grado (reemplaza el anterior si existe)
 */
const asignarTutor = async (data) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Eliminar tutor anterior
    await client.query(
      `DELETE FROM tutores_grado WHERE id_grado = $1 AND anio_lectivo = $2`,
      [data.id_grado, data.anio_lectivo || 2026],
    );

    // Insertar nuevo tutor
    const sql = `
      INSERT INTO tutores_grado (id_grado, id_personal, anio_lectivo)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await client.query(sql, [
      data.id_grado,
      data.id_personal,
      data.anio_lectivo || 2026,
    ]);

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  listar,
  findById,
  listarPorGrado,
  listarPorDocente,
  getTutor,
  crear,
  actualizar,
  eliminar,
  asignarTutor,
};
