/**
 * DAO para la tabla alumnos y apoderados
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");
const { getAnioLectivo } = require("../config/academico");

/**
 * Construir el WHERE dinámico del listado de alumnos.
 */
const construirFiltros = (filtros = {}) => {
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
      `(unaccent(LOWER(a.nombres)) LIKE unaccent(LOWER($${idx}))
        OR unaccent(LOWER(a.apellidos)) LIKE unaccent(LOWER($${idx}))
        OR unaccent(LOWER(a.nombres || ' ' || a.apellidos)) LIKE unaccent(LOWER($${idx}))
        OR unaccent(LOWER(a.apellidos || ' ' || a.nombres)) LIKE unaccent(LOWER($${idx}))
        OR a.dni LIKE $${idx})`,
    );
    params.push(`%${filtros.search}%`);
    idx++;
  }
  if (filtros.solo_activos) {
    conditions.push(`a.estado_matricula <> 'Retirado'`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return { whereClause, params, nextIdx: idx };
};

/**
 * Listar alumnos con filtros.
 * Con `page` + `pageSize` aplica LIMIT/OFFSET; sin `page` mantiene el
 * comportamiento histórico (arreglo completo o `limit` del buscador).
 */
const listar = async (filtros = {}) => {
  const { whereClause, params, nextIdx } = construirFiltros(filtros);
  let idx = nextIdx;
  let paginacionClause = "";

  const page = Number.parseInt(String(filtros.page ?? ""), 10);
  const pageSize = Number.parseInt(String(filtros.pageSize ?? ""), 10);

  if (Number.isInteger(page) && page > 0 && Number.isInteger(pageSize) && pageSize > 0) {
    const size = Math.min(pageSize, 100);
    const offset = (page - 1) * size;
    paginacionClause = `LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(size, offset);
  } else if (filtros.limit !== undefined && filtros.limit !== null) {
    const limite = Number.parseInt(String(filtros.limit), 10);
    if (Number.isInteger(limite) && limite > 0) {
      paginacionClause = `LIMIT $${idx}`;
      params.push(Math.min(limite, 50));
    }
  }

  const sql = `
    SELECT 
      a.id_alumno, a.dni, a.nombres, a.apellidos,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      a.fecha_nacimiento, a.condicion, a.estado_matricula,
      a.codigo_estudiante, a.anio_lectivo, a.id_grado,
      g.nombre_grado, g.seccion,
      u.correo_personal,
      a.id_apoderado,
      ap.nombres || ' ' || ap.apellidos AS apoderado_nombre,
      ap.telefono AS apoderado_telefono,
      ap.correo AS apoderado_correo
    FROM alumnos a
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
    LEFT JOIN apoderados ap ON ap.id_apoderado = a.id_apoderado
    ${whereClause}
    ORDER BY g.id_grado, a.apellidos, a.nombres
    ${paginacionClause}
  `;

  const result = await query(sql, params);
  return result.rows;
};

/**
 * Contar alumnos con los mismos filtros del listado.
 */
const contar = async (filtros = {}) => {
  const { whereClause, params } = construirFiltros(filtros);
  const sql = `
    SELECT COUNT(*)::int AS total
    FROM alumnos a
    ${whereClause}
  `;
  const result = await query(sql, params);
  return result.rows[0].total;
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
      u.correo_personal,
      ap.nombres AS apoderado_nombres,
      ap.apellidos AS apoderado_apellidos,
      ap.dni AS apoderado_dni,
      ap.telefono AS apoderado_telefono,
      ap.correo AS apoderado_correo
    FROM alumnos a
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
    LEFT JOIN apoderados ap ON ap.id_apoderado = a.id_apoderado
    WHERE a.id_alumno = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Buscar la matrícula anual de un alumno por DNI.
 * No devuelve una fila de otro año: el llamador debe indicar el año.
 */
const findByDni = async (dni, anioLectivo) => {
  const sql = `
    SELECT 
      a.*,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      g.nombre_grado, g.seccion,
      u.correo_personal
    FROM alumnos a
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
    WHERE a.dni = $1
      AND a.anio_lectivo = $2
  `;
  const result = await query(sql, [dni, anioLectivo]);
  return result.rows[0] || null;
};

/**
 * Buscar una persona por DNI sin filtrar año.
 * Solo para el alta de primera matrícula y para detectar continuidad.
 */
const findByDniGlobal = async (dni) => {
  const sql = `
    SELECT
      a.*,
      a.nombres || ' ' || a.apellidos AS nombre_completo,
      g.nombre_grado, g.seccion,
      u.correo_personal
    FROM alumnos a
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
    WHERE a.dni = $1
    ORDER BY a.anio_lectivo DESC
  `;
  const result = await query(sql, [dni]);
  return result.rows;
};

/**
 * Obtener el siguiente código de estudiante
 */
const getSiguienteCodigo = async (client = null) => {
  // Bloqueo por transacción: evita que dos matrículas simultáneas calculen
  // el mismo MAX+1. Se libera al hacer COMMIT/ROLLBACK.
  if (client) {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('codigo_alumno'))",
    );
  }

  const sql = `
    SELECT MAX(CAST(SUBSTRING(codigo_estudiante FROM 5) AS INTEGER)) AS max_codigo
    FROM alumnos WHERE codigo_estudiante LIKE 'EST-%'
  `;
  const result = client ? await client.query(sql) : await query(sql);
  const next = (result.rows[0].max_codigo || 0) + 1;
  return `EST-${String(next).padStart(3, "0")}`;
};

/**
 * Crear un alumno (transacción: apoderado + usuario + alumno + expediente + QR)
 */
const crear = async (data) => {
  const client = await getClient();
  const anioLectivo = Number(data.anio_lectivo) || getAnioLectivo();
  try {
    await client.query("BEGIN");

    const apoderadoData = data.apoderado || null;
    if (
      apoderadoData &&
      (apoderadoData.nombres ||
        apoderadoData.apellidos ||
        apoderadoData.dni ||
        apoderadoData.correo) &&
      (!String(apoderadoData.nombres || "").trim() ||
        !String(apoderadoData.apellidos || "").trim())
    ) {
      const error = new Error(
        "Si envía datos del apoderado, debe incluir nombres y apellidos.",
      );
      error.statusCode = 400;
      throw error;
    }

    // 0. Validar que el grado pertenezca al año destino y que exista el
    // concepto de matrícula de ese año.
    const gradoResult = await client.query(
      `SELECT 1 FROM grados WHERE id_grado = $1 AND anio_lectivo = $2 LIMIT 1`,
      [data.id_grado, anioLectivo],
    );
    if (gradoResult.rows.length === 0) {
      const error = new Error(
        "El grado seleccionado no pertenece al año lectivo de la matrícula.",
      );
      error.statusCode = 400;
      throw error;
    }

    const conceptoResult = await client.query(
      `SELECT id_concepto, monto_base
       FROM conceptos_pago
       WHERE tipo = 'MATRICULA' AND anio_lectivo = $1
       ORDER BY id_concepto
       LIMIT 1`,
      [anioLectivo],
    );
    if (conceptoResult.rows.length === 0) {
      const error = new Error(
        `No hay concepto de matrícula para el año ${anioLectivo}; ejecute el rollover.`,
      );
      error.statusCode = 400;
      throw error;
    }
    const conceptoMatricula = conceptoResult.rows[0];

    // 1. Crear o reutilizar apoderado por DNI.
    let id_apoderado = null;
    if (apoderadoData && String(apoderadoData.nombres || "").trim()) {
      if (apoderadoData.dni) {
        const insertResult = await client.query(
          `INSERT INTO apoderados (nombres, apellidos, dni, telefono, correo)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (dni) DO NOTHING
           RETURNING id_apoderado`,
          [
            apoderadoData.nombres,
            apoderadoData.apellidos,
            apoderadoData.dni,
            apoderadoData.telefono || null,
            apoderadoData.correo || null,
          ],
        );

        if (insertResult.rows.length > 0) {
          id_apoderado = insertResult.rows[0].id_apoderado;
        } else {
          const existenteResult = await client.query(
            `SELECT id_apoderado, nombres, apellidos
             FROM apoderados
             WHERE dni = $1
             LIMIT 1`,
            [apoderadoData.dni],
          );
          if (existenteResult.rows.length === 0) {
            const error = new Error(
              "No se pudo reutilizar el apoderado existente por DNI.",
            );
            error.statusCode = 409;
            throw error;
          }
          id_apoderado = existenteResult.rows[0].id_apoderado;
          const existente = existenteResult.rows[0];
          if (
            existente.nombres !== apoderadoData.nombres ||
            existente.apellidos !== apoderadoData.apellidos
          ) {
            console.warn(
              "⚠️ Apoderado con DNI existente y nombres distintos; se reutiliza la ficha existente sin sobrescribirla.",
            );
          }
        }
      } else {
        const apoderadoResult = await client.query(
          `INSERT INTO apoderados (nombres, apellidos, dni, telefono, correo)
           VALUES ($1, $2, NULL, $3, $4) RETURNING id_apoderado`,
          [
            apoderadoData.nombres,
            apoderadoData.apellidos,
            apoderadoData.telefono || null,
            apoderadoData.correo || null,
          ],
        );
        id_apoderado = apoderadoResult.rows[0].id_apoderado;
      }
    }

    // 2. Generar correo institucional
    const correoGenerado =
      data.correo_institucional ||
      `${data.nombres.toLowerCase().replace(/\s+/g, "")}.${data.apellidos.toLowerCase().replace(/\s+/g, "")}@unioncientifica.edu.pe`;

    // 3. Determinar correo personal (prioridad: alumno, si no, apoderado)
    const correoPersonal =
      data.correo_personal || (apoderadoData && apoderadoData.correo) || null;

    // 4. Crear usuario
    const usuarioSql = `
      INSERT INTO usuarios (
        dni, nombres, apellidos, correo_institucional, correo_personal,
        password_hash, telefono, id_rol, estado, requiere_cambio_password
      )
      VALUES ($1, $2, $3, $4, $5, crypt($6, gen_salt('bf', 10)), $7,
        (SELECT id_rol FROM roles WHERE nombre_rol = 'ESTUDIANTE'), 'ACTIVO', TRUE)
      RETURNING id_usuario
    `;
    const usuarioResult = await client.query(usuarioSql, [
      data.dni,
      data.nombres,
      data.apellidos,
      correoGenerado,
      correoPersonal,
      String(data.dni),
      data.telefono || null,
    ]);
    const id_usuario = usuarioResult.rows[0].id_usuario;

    // 5. Generar código estudiante
    const codigo = await getSiguienteCodigo(client);

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
      anioLectivo,
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

    // 9. Crear pre-ticket de matrícula pendiente (el concepto ya se validó
    // al inicio de la transacción).
    let idPreticket = null;
    const preticketResult = await client.query(
      `INSERT INTO pre_tickets (id_alumno, id_concepto, monto, estado, id_usuario_emite)
       VALUES ($1, $2, $3, 'PENDIENTE', $4)
       RETURNING id_preticket`,
      [
        id_alumno,
        conceptoMatricula.id_concepto,
        conceptoMatricula.monto_base,
        data.id_usuario_emite || null,
      ],
    );
    idPreticket = preticketResult.rows[0].id_preticket;

    await client.query("COMMIT");

    return {
      id_alumno,
      id_preticket: idPreticket,
      id_usuario,
      codigo_estudiante: codigo,
      dni: data.dni,
      nombre_completo: `${data.nombres} ${data.apellidos}`,
      password_temporal: String(data.dni),
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
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const actualResult = await client.query(
      `SELECT anio_lectivo FROM alumnos WHERE id_alumno = $1 FOR UPDATE`,
      [id],
    );
    const actual = actualResult.rows[0];
    if (!actual) {
      await client.query("ROLLBACK");
      return null;
    }

    if (data.id_grado !== undefined && data.id_grado !== null) {
      const gradoResult = await client.query(
        `SELECT 1 FROM grados WHERE id_grado = $1 AND anio_lectivo = $2 LIMIT 1`,
        [data.id_grado, actual.anio_lectivo],
      );
      if (gradoResult.rows.length === 0) {
        const error = new Error(
          "El grado seleccionado no pertenece al año lectivo de la matrícula.",
        );
        error.statusCode = 400;
        throw error;
      }
    }

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
    const result = await client.query(sql, [
      data.nombres,
      data.apellidos,
      data.fecha_nacimiento,
      data.id_grado,
      data.condicion,
      data.colegio_procedencia,
      id,
    ]);
    const alumno = result.rows[0];

    if (!alumno) {
      await client.query("ROLLBACK");
      return null;
    }

    if (data.correo_personal !== undefined) {
      await client.query(
        `UPDATE usuarios SET correo_personal = $1 WHERE id_usuario = $2`,
        [data.correo_personal || null, alumno.id_usuario],
      );
      alumno.correo_personal = data.correo_personal || null;
    }

    // Mantener el nombre del usuario alineado con la ficha del alumno.
    if (data.nombres !== undefined || data.apellidos !== undefined) {
      await client.query(
        `UPDATE usuarios SET
          nombres = COALESCE($1, nombres),
          apellidos = COALESCE($2, apellidos)
        WHERE id_usuario = $3`,
        [data.nombres ?? null, data.apellidos ?? null, alumno.id_usuario],
      );
    }

    await client.query("COMMIT");
    return alumno;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Registrar retiro
 */
const retirar = async (id, data) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const fechaRetiro = data.fecha_retiro || new Date();
    const sql = `
      UPDATE alumnos SET
        estado_matricula = 'Retirado',
        fecha_retiro = $1,
        motivo_retiro = $2,
        colegio_destino = $3,
        resolucion_directoral = $4
      WHERE id_alumno = $5 RETURNING *
    `;
    const result = await client.query(sql, [
      fechaRetiro,
      data.motivo_retiro,
      data.colegio_destino || null,
      data.resolucion_directoral || null,
      id,
    ]);
    const alumno = result.rows[0];

    if (!alumno) {
      await client.query("ROLLBACK");
      return null;
    }

    // El usuario solo se desactiva si no queda otra matrícula viva del mismo
    // alumno en otro año. Si tiene una matrícula futura vigente, conserva el
    // acceso y el contexto se resolverá por el año activo.
    await client.query(
      `UPDATE usuarios u
       SET estado = 'INACTIVO'
       WHERE u.id_usuario = $1
         AND NOT EXISTS (
           SELECT 1
           FROM alumnos a
           WHERE a.id_usuario = $1
             AND a.id_alumno <> $2
             AND a.estado_matricula <> 'Retirado'
         )`,
      [alumno.id_usuario, id],
    );

    // Congelar el expediente para que no siga recibiendo cambios.
    await client.query(
      `UPDATE expediente_alumno SET congelado = TRUE WHERE id_alumno = $1`,
      [id],
    );

    // Anular pensiones pendientes posteriores al mes de retiro.
    const pensionesResult = await client.query(
      `UPDATE pensiones SET estado = 'ANULADO'
       WHERE id_alumno = $1
         AND anio_lectivo = $2
         AND estado = 'PENDIENTE'
         AND mes > EXTRACT(MONTH FROM $3::date)::int`,
      [id, alumno.anio_lectivo, fechaRetiro],
    );

    // Anular pre-tickets pendientes del alumno.
    const preticketsResult = await client.query(
      `UPDATE pre_tickets SET estado = 'ANULADO'
       WHERE id_alumno = $1 AND estado = 'PENDIENTE'`,
      [id],
    );

    await client.query("COMMIT");
    return {
      alumno,
      pensiones_anuladas: pensionesResult.rowCount,
      pretickets_anulados: preticketsResult.rowCount,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
  contar,
  findById,
  findByDni,
  findByDniGlobal,
  crear,
  actualizar,
  retirar,
  cambiarEstado,
  getSiguienteCodigo,
};
