/**
 * DAO para la tabla personal y usuarios
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");

/**
 * Listar todo el personal con su usuario y rol
 */
const SELECT_PERSONAL = `
  SELECT 
    p.id_personal,
    p.especialidad,
    p.cargo,
    p.fecha_ingreso,
    p.fecha_cese,
    p.motivo_cese,
    to_jsonb(p)->>'observaciones' AS observaciones,
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
    r.descripcion AS rol_descripcion,
    cq.id_credencial,
    cq.codigo_qr,
    cq.tipo AS tipo_credencial
  FROM personal p
  INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
  INNER JOIN roles r ON r.id_rol = u.id_rol
  LEFT JOIN credenciales_qr cq
    ON cq.id_usuario = u.id_usuario
    AND cq.activo = TRUE
`;

const construirFiltrosPersonal = (filtros = {}) => {
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

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
};

/**
 * Listar todo el personal con su usuario y rol (sin paginar).
 */
const listar = async (filtros = {}) => {
  const { where, params } = construirFiltrosPersonal(filtros);
  const sql = `
    ${SELECT_PERSONAL}
    ${where}
    ORDER BY u.apellidos, u.nombres
  `;

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Listar personal paginado para la tabla ADMIN.
 */
const listarPaginado = async (filtros = {}) => {
  const { where, params } = construirFiltrosPersonal(filtros);
  const page = Math.max(Number.parseInt(String(filtros.page ?? ""), 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number.parseInt(String(filtros.pageSize ?? ""), 10) || 20, 1),
    100,
  );
  const offset = (page - 1) * pageSize;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM personal p
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    ${where}
  `;
  const countResult = await query(countSql, params);

  const dataSql = `
    ${SELECT_PERSONAL}
    ${where}
    ORDER BY u.apellidos, u.nombres
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  const dataResult = await query(dataSql, [...params, pageSize, offset]);

  return {
    data: dataResult.rows,
    total: Number(countResult.rows[0]?.total) || 0,
    page,
    pageSize,
  };
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
      r.id_rol, r.nombre_rol, r.descripcion AS rol_descripcion,
      cq.id_credencial, cq.codigo_qr, cq.tipo AS tipo_credencial
    FROM personal p
    INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
    INNER JOIN roles r ON r.id_rol = u.id_rol
    LEFT JOIN credenciales_qr cq
      ON cq.id_usuario = u.id_usuario
      AND cq.activo = TRUE
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
        password_hash, telefono, id_rol, estado, requiere_cambio_password
      )
      VALUES ($1, $2, $3, $4, $5, crypt($6, gen_salt('bf', 10)), $7, $8, 'ACTIVO', TRUE)
      RETURNING id_usuario
    `;
    const usuarioResult = await client.query(usuarioSql, [
      data.dni,
      data.nombres,
      data.apellidos,
      correoGenerado,
      data.correo_personal || null,
      data.password || String(data.dni),
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
      Number(data.id_rol) === 2 ? data.especialidad || null : null,
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
      password_temporal: data.password || String(data.dni),
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
      RETURNING id_rol
    `;
    const usuarioResult = await client.query(usuarioSql, [
      data.nombres,
      data.apellidos,
      data.correo_institucional,
      data.correo_personal,
      data.telefono,
      data.id_rol,
      id_personal,
    ]);
    const rolFinal = Number(usuarioResult.rows[0]?.id_rol);

    // Actualizar personal. La especialidad solo persiste para DOCENTE (2).
    const personalSql = `
      UPDATE personal SET
        especialidad = CASE
          WHEN $4 = 2 THEN COALESCE($1, especialidad)
          ELSE NULL
        END,
        cargo = COALESCE($2, cargo)
      WHERE id_personal = $3
    `;
    await client.query(personalSql, [
      data.especialidad,
      data.cargo,
      id_personal,
      rolFinal,
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
 * Comprueba si H59 está aplicada. Permite desplegar el código sin romper
 * `GET /personal` en bases que todavía no tienen la columna; el cese con
 * observación responde 503 en lugar de perder el texto.
 */
const existeColumnaObservaciones = async (client) => {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'personal'
       AND column_name = 'observaciones'
     LIMIT 1`,
  );
  return result.rows.length > 0;
};

/**
 * Registrar cese de personal
 */
const cesar = async (id_personal, data) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const tieneObservaciones = await existeColumnaObservaciones(client);
    const observaciones =
      data.observaciones ? String(data.observaciones).trim() : null;

    if (observaciones && !tieneObservaciones) {
      const error = new Error(
        "La base de datos no tiene aplicada H59; no se puede guardar la observación del cese.",
      );
      error.statusCode = 503;
      error.details = { codigo: "H59_NO_APLICADO" };
      throw error;
    }

    const columnas = tieneObservaciones
      ? "fecha_cese = $1, motivo_cese = $2, observaciones = $3"
      : "fecha_cese = $1, motivo_cese = $2";
    const parametros = tieneObservaciones
      ? [
          data.fecha_cese || new Date(),
          data.motivo_cese,
          observaciones,
          id_personal,
        ]
      : [data.fecha_cese || new Date(), data.motivo_cese, id_personal];

    await client.query(
      `
      UPDATE personal SET
        ${columnas}
      WHERE id_personal = $${parametros.length}
    `,
      parametros,
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

  const columna = await query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'personal'
       AND column_name = 'observaciones'
     LIMIT 1`,
  );
  const limpiaObservaciones =
    columna.rows.length > 0 ? ", observaciones = NULL" : "";

  await query(
    `
    UPDATE personal SET fecha_cese = NULL, motivo_cese = NULL${limpiaObservaciones}
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
  const passwordTemporal = dni;

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
  listarPaginado,
  findById,
  listarRoles,
  crear,
  actualizar,
  cesar,
  reactivar,
  resetPassword,
};
