/**
 * DAO para la tabla alumnos y apoderados
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");

/**
 * Listar alumnos con filtros
 */
const listar = async (filtros = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filtros.anio_lectivo) {
    conditions.push(`a.anio_lectivo = $${idx++}`);
    params.push(filtros.anio_lectivo);
  }
  if (filtros.id_grado) {
    conditions.push(`a.id_grado = $${idx++}`);
    params.push(filtros.id_grado);
  }
  if (filtros.estado_matricula) {
    conditions.push(`a.estado_matricula = $${idx++}`);
    params.push(filtros.estado_matricula);
  }
  if (filtros.search) {
    conditions.push(
      `(LOWER(a.nombres) LIKE LOWER($${idx}) OR LOWER(a.apellidos) LIKE LOWER($${idx}) OR a.dni LIKE $${idx})`,
    );
    params.push(`%${filtros.search}%`);
    idx++;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT 
      a.id_alumno, a.dni, a.nombres, a.apellidos,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      a.fecha_nacimiento, a.condicion, a.estado_matricula,
      a.codigo_estudiante, a.anio_lectivo, a.id_grado,
      g.nombre_grado, g.seccion,
      a.id_apoderado,
      ap.nombres || ' ' || ap.apellidos AS apoderado_nombre,
      ap.telefono AS apoderado_telefono,
      ap.correo AS apoderado_correo
    FROM alumnos a
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    LEFT JOIN apoderados ap ON ap.id_apoderado = a.id_apoderado
    ${whereClause}
    ORDER BY g.id_grado, a.apellidos, a.nombres
  `;

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Buscar alumno por ID
 */
const findById = async (id) => {
  const sql = `
    SELECT 
      a.*,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      g.nombre_grado, g.seccion,
      ap.nombres AS apoderado_nombres,
      ap.apellidos AS apoderado_apellidos,
      ap.dni AS apoderado_dni,
      ap.telefono AS apoderado_telefono,
      ap.correo AS apoderado_correo
    FROM alumnos a
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    LEFT JOIN apoderados ap ON ap.id_apoderado = a.id_apoderado
    WHERE a.id_alumno = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Buscar alumno por DNI
 */
const findByDni = async (dni) => {
  const sql = `
    SELECT 
      a.*,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      g.nombre_grado, g.seccion
    FROM alumnos a
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    WHERE a.dni = $1
  `;
  const result = await query(sql, [dni]);
  return result.rows[0] || null;
};

/**
 * Obtener el siguiente código de estudiante
 */
const getSiguienteCodigo = async () => {
  const sql = `
    SELECT MAX(CAST(SUBSTRING(codigo_estudiante FROM 5) AS INTEGER)) AS max_codigo
    FROM alumnos WHERE codigo_estudiante LIKE 'EST-%'
  `;
  const result = await query(sql);
  const next = (result.rows[0].max_codigo || 0) + 1;
  return `EST-${String(next).padStart(3, "0")}`;
};

/**
 * Crear un alumno (transacción: apoderado + usuario + alumno + expediente + QR)
 */
const crear = async (data) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // 1. Crear apoderado (opcional)
    let id_apoderado = null;
    if (data.apoderado && data.apoderado.nombres) {
      const apoderadoSql = `
        INSERT INTO apoderados (nombres, apellidos, dni, telefono, correo)
        VALUES ($1, $2, $3, $4, $5) RETURNING id_apoderado
      `;
      const apoderadoResult = await client.query(apoderadoSql, [
        data.apoderado.nombres,
        data.apoderado.apellidos,
        data.apoderado.dni || null,
        data.apoderado.telefono || null,
        data.apoderado.correo || null,
      ]);
      id_apoderado = apoderadoResult.rows[0].id_apoderado;
    }

    // 2. Generar correo institucional
    const correoGenerado =
      data.correo_institucional ||
      `${data.nombres.toLowerCase().replace(/\s+/g, "")}.${data.apellidos.toLowerCase().replace(/\s+/g, "")}@unioncientifica.edu.pe`;

    // 3. Determinar correo personal (prioridad: alumno, si no, apoderado)
    const correoPersonal =
      data.correo_personal || (data.apoderado && data.apoderado.correo) || null;

    // 4. Crear usuario
    const usuarioSql = `
      INSERT INTO usuarios (
        dni, nombres, apellidos, correo_institucional, correo_personal,
        password_hash, telefono, id_rol, estado
      )
      VALUES ($1, $2, $3, $4, $5, crypt($6, gen_salt('bf', 10)), $7,
        (SELECT id_rol FROM roles WHERE nombre_rol = 'ESTUDIANTE'), 'ACTIVO')
      RETURNING id_usuario
    `;
    const usuarioResult = await client.query(usuarioSql, [
      data.dni,
      data.nombres,
      data.apellidos,
      correoGenerado,
      correoPersonal,
      "UC" + data.dni,
      data.telefono || null,
    ]);
    const id_usuario = usuarioResult.rows[0].id_usuario;

    // 5. Generar código estudiante
    const codigo = await getSiguienteCodigo();

    // 6. Crear alumno
    const alumnoSql = `
      INSERT INTO alumnos (
        id_usuario, dni, nombres, apellidos, fecha_nacimiento,
        id_apoderado, id_grado, condicion, colegio_procedencia,
        estado_matricula, codigo_estudiante, anio_lectivo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id_alumno
    `;
    const alumnoResult = await client.query(alumnoSql, [
      id_usuario,
      data.dni,
      data.nombres,
      data.apellidos,
      data.fecha_nacimiento,
      id_apoderado,
      data.id_grado,
      data.condicion || "Regular",
      data.colegio_procedencia || null,
      "PendientePago",
      codigo,
      data.anio_lectivo || 2026,
    ]);
    const id_alumno = alumnoResult.rows[0].id_alumno;

    // 7. Crear expediente
    await client.query(
      `INSERT INTO expediente_alumno (id_alumno, nivel_logro_actual, asistencia_acumulada) VALUES ($1, NULL, 0)`,
      [id_alumno],
    );

    // 8. Crear credencial QR
    await client.query(
      `INSERT INTO credenciales_qr (id_usuario, codigo_qr, tipo)
       VALUES ($1, 'QR-' || $2 || '-' || UPPER(MD5($2 || 'SIGAUC')), 'ESTUDIANTE')`,
      [id_usuario, data.dni],
    );

    await client.query("COMMIT");

    return {
      id_alumno,
      id_usuario,
      codigo_estudiante: codigo,
      dni: data.dni,
      nombre_completo: `${data.nombres} ${data.apellidos}`,
      password_temporal: "UC" + data.dni,
      correo_institucional: correoGenerado,
      correo_personal: correoPersonal,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Actualizar alumno
 */
const actualizar = async (id, data) => {
  const sql = `
    UPDATE alumnos SET
      nombres = COALESCE($1, nombres),
      apellidos = COALESCE($2, apellidos),
      fecha_nacimiento = COALESCE($3, fecha_nacimiento),
      id_grado = COALESCE($4, id_grado),
      condicion = COALESCE($5, condicion),
      colegio_procedencia = COALESCE($6, colegio_procedencia)
    WHERE id_alumno = $7 RETURNING *
  `;
  const result = await query(sql, [
    data.nombres,
    data.apellidos,
    data.fecha_nacimiento,
    data.id_grado,
    data.condicion,
    data.colegio_procedencia,
    id,
  ]);
  return result.rows[0] || null;
};

/**
 * Registrar retiro
 */
const retirar = async (id, data) => {
  const sql = `
    UPDATE alumnos SET
      estado_matricula = 'Retirado',
      fecha_retiro = $1,
      motivo_retiro = $2,
      colegio_destino = $3,
      resolucion_directoral = $4
    WHERE id_alumno = $5 RETURNING *
  `;
  const result = await query(sql, [
    data.fecha_retiro || new Date(),
    data.motivo_retiro,
    data.colegio_destino || null,
    data.resolucion_directoral || null,
    id,
  ]);
  return result.rows[0] || null;
};

/**
 * Cambiar estado de matrícula
 */
const cambiarEstado = async (id, nuevoEstado) => {
  const sql = `UPDATE alumnos SET estado_matricula = $1 WHERE id_alumno = $2 RETURNING *`;
  const result = await query(sql, [nuevoEstado, id]);
  return result.rows[0] || null;
};

module.exports = {
  listar,
  findById,
  findByDni,
  crear,
  actualizar,
  retirar,
  cambiarEstado,
  getSiguienteCodigo,
};
