/**
 * DAO para la tabla personal y usuarios
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");

/**
 * Listar todo el personal con su usuario y rol
 */
const listar = async (filtros = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filtros.id_rol) {
    conditions.push(`u.id_rol = $${idx++}`);
    params.push(filtros.id_rol);
  }

  if (filtros.estado) {
    conditions.push(`u.estado = $${idx++}`);
    params.push(filtros.estado);
  }

  if (filtros.search) {
    conditions.push(`(
      LOWER(u.nombres) LIKE LOWER($${idx}) OR
      LOWER(u.apellidos) LIKE LOWER($${idx}) OR
      u.dni LIKE $${idx}
    )`);
    params.push(`%${filtros.search}%`);
    idx++;
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT 
      p.id_personal,
      p.especialidad,
      p.cargo,
      p.fecha_ingreso,
      p.fecha_cese,
      p.motivo_cese,
      u.id_usuario,
      u.dni,
      u.nombres,
      u.apellidos,
      u.nombres || ' ' || u.apellidos AS nombre_completo,
      u.correo_institucional,
      u.correo_personal,
      u.telefono,
      u.estado,
      u.ultimo_login,
      r.id_rol,
      r.nombre_rol,
      r.descripcion AS rol_descripcion
    FROM personal p
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    INNER JOIN roles r ON r.id_rol = u.id_rol
    ${where}
    ORDER BY u.apellidos, u.nombres
  `;

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Buscar personal por ID
 */
const findById = async (id) => {
  const sql = `
    SELECT 
      p.*,
      u.id_usuario, u.dni, u.nombres, u.apellidos,
      u.correo_institucional, u.correo_personal,
      u.telefono, u.estado, u.requiere_cambio_password,
      r.id_rol, r.nombre_rol, r.descripcion AS rol_descripcion
    FROM personal p
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    INNER JOIN roles r ON r.id_rol = u.id_rol
    WHERE p.id_personal = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Listar roles disponibles (excluye ESTUDIANTE)
 */
const listarRoles = async () => {
  const sql = `
    SELECT id_rol, nombre_rol, descripcion 
    FROM roles 
    WHERE nombre_rol != 'ESTUDIANTE' 
    ORDER BY id_rol
  `;
  const result = await query(sql);
  return result.rows;
};

/**
 * Crear un nuevo personal (transacción: usuario + personal + credencial QR)
 */
const crear = async (data) => {
  const client = await getClient();

  try {
    await client.query("BEGIN");

    // 1. Generar correo institucional si no lo envían
    const correoGenerado =
      data.correo_institucional ||
      `${data.nombres.toLowerCase().replace(/\s+/g, "")}.${data.apellidos.toLowerCase().replace(/\s+/g, "")}@unioncientifica.edu.pe`;

    // 2. Crear usuario (con correo_personal)
    const usuarioSql = `
      INSERT INTO usuarios (
        dni, nombres, apellidos, correo_institucional, correo_personal,
        password_hash, telefono, id_rol, estado
      )
      VALUES ($1, $2, $3, $4, $5, crypt($6, gen_salt('bf', 10)), $7, $8, 'ACTIVO')
      RETURNING id_usuario
    `;
    const usuarioResult = await client.query(usuarioSql, [
      data.dni,
      data.nombres,
      data.apellidos,
      correoGenerado,
      data.correo_personal || null,
      data.password || "UC2026*",
      data.telefono || null,
      data.id_rol,
    ]);
    const id_usuario = usuarioResult.rows[0].id_usuario;

    // 3. Crear personal
    const personalSql = `
      INSERT INTO personal (id_usuario, especialidad, cargo, fecha_ingreso)
      VALUES ($1, $2, $3, $4)
      RETURNING id_personal
    `;
    const personalResult = await client.query(personalSql, [
      id_usuario,
      data.especialidad || null,
      data.cargo || null,
      data.fecha_ingreso || new Date(),
    ]);
    const id_personal = personalResult.rows[0].id_personal;

    // 4. Crear credencial QR
    const tipoQR =
      data.id_rol === 1
        ? "ADMIN"
        : data.id_rol === 3
          ? "SECRETARIA"
          : "DOCENTE";
    await client.query(
      `INSERT INTO credenciales_qr (id_usuario, codigo_qr, tipo)
       VALUES ($1, 'QR-' || $2 || '-' || UPPER(MD5($2 || 'SIGAUC')), $3)`,
      [id_usuario, data.dni, tipoQR],
    );

    await client.query("COMMIT");

    return {
      id_personal,
      id_usuario,
      dni: data.dni,
      nombre_completo: `${data.nombres} ${data.apellidos}`,
      correo_institucional: correoGenerado,
      correo_personal: data.correo_personal || null,
      password_temporal: data.password || "UC2026*",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Actualizar personal y usuario
 */
const actualizar = async (id_personal, data) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Actualizar usuario
    const usuarioSql = `
      UPDATE usuarios SET
        nombres = COALESCE($1, nombres),
        apellidos = COALESCE($2, apellidos),
        correo_institucional = COALESCE($3, correo_institucional),
        correo_personal = COALESCE($4, correo_personal),
        telefono = COALESCE($5, telefono),
        id_rol = COALESCE($6, id_rol)
      WHERE id_usuario = (SELECT id_usuario FROM personal WHERE id_personal = $7)
    `;
    await client.query(usuarioSql, [
      data.nombres,
      data.apellidos,
      data.correo_institucional,
      data.correo_personal,
      data.telefono,
      data.id_rol,
      id_personal,
    ]);

    // Actualizar personal
    const personalSql = `
      UPDATE personal SET
        especialidad = COALESCE($1, especialidad),
        cargo = COALESCE($2, cargo)
      WHERE id_personal = $3
    `;
    await client.query(personalSql, [
      data.especialidad,
      data.cargo,
      id_personal,
    ]);

    await client.query("COMMIT");
    return await findById(id_personal);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Registrar cese de personal
 */
const cesar = async (id_personal, data) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    await client.query(
      `
      UPDATE personal SET
        fecha_cese = $1,
        motivo_cese = $2
      WHERE id_personal = $3
    `,
      [data.fecha_cese || new Date(), data.motivo_cese, id_personal],
    );

    await client.query(
      `
      UPDATE usuarios SET estado = 'CESADO'
      WHERE id_usuario = (SELECT id_usuario FROM personal WHERE id_personal = $1)
    `,
      [id_personal],
    );

    await client.query("COMMIT");
    return await findById(id_personal);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Reactivar personal
 */
const reactivar = async (id_personal) => {
  await query(
    `
    UPDATE usuarios SET estado = 'ACTIVO'
    WHERE id_usuario = (SELECT id_usuario FROM personal WHERE id_personal = $1)
  `,
    [id_personal],
  );

  await query(
    `
    UPDATE personal SET fecha_cese = NULL, motivo_cese = NULL
    WHERE id_personal = $1
  `,
    [id_personal],
  );

  return await findById(id_personal);
};

/**
 * Restablecer contraseña
 */
const resetPassword = async (id_usuario, dni) => {
  const passwordTemporal = "UC" + dni;

  await query(
    `
    UPDATE usuarios 
    SET password_hash = crypt($1, gen_salt('bf', 10)),
        requiere_cambio_password = TRUE
    WHERE id_usuario = $2
  `,
    [passwordTemporal, id_usuario],
  );

  return { password_temporal: passwordTemporal };
};

module.exports = {
  listar,
  findById,
  listarRoles,
  crear,
  actualizar,
  cesar,
  reactivar,
  resetPassword,
};
