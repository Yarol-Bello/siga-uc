/**
 * DAO de tarifas y conceptos de pago (Fase 2 / H75)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");

const CAMPOS = `
  c.id_concepto,
  c.nombre,
  c.monto_base,
  c.tipo,
  c.mes,
  c.anio_lectivo,
  c.nivel,
  c.id_grado,
  c.activo,
  c.descripcion,
  c.orden,
  c.vigente_desde,
  c.vigente_hasta,
  c.creado_por,
  c.actualizado_por,
  c.fecha_creacion,
  c.fecha_actualizacion,
  g.nombre_grado,
  g.seccion,
  g.nivel AS grado_nivel
`;

const ejecutar = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

/**
 * Lista las tarifas del año con conteos de uso.
 */
const listar = async (
  { anio, tipo = null, idGrado = null, nivel = null, incluirInactivos = false },
  client = null,
) => {
  const condiciones = ["c.anio_lectivo = $1"];
  const params = [anio];
  let idx = 2;

  if (tipo) {
    condiciones.push(`c.tipo = $${idx++}`);
    params.push(tipo);
  }
  if (idGrado) {
    condiciones.push(`c.id_grado = $${idx++}`);
    params.push(idGrado);
  }
  if (nivel) {
    condiciones.push(`c.nivel = $${idx++}`);
    params.push(nivel);
  }
  if (!incluirInactivos) {
    condiciones.push("c.activo = true");
  }

  const result = await ejecutar(
    client,
    `SELECT ${CAMPOS},
       (SELECT COUNT(*)::int FROM pre_tickets pt WHERE pt.id_concepto = c.id_concepto) AS pretickets,
       (SELECT COUNT(*)::int FROM pagos p WHERE p.id_concepto = c.id_concepto AND p.estado = 'PAGADO') AS pagos,
       (SELECT COUNT(*)::int FROM pensiones pe WHERE pe.id_concepto = c.id_concepto) AS pensiones
     FROM conceptos_pago c
     LEFT JOIN grados g ON g.id_grado = c.id_grado
     WHERE ${condiciones.join(" AND ")}
     ORDER BY c.anio_lectivo DESC, c.tipo, c.mes NULLS FIRST,
              COALESCE(g.nivel, c.nivel, '') , c.id_grado NULLS FIRST, c.id_concepto`,
    params,
  );
  return result.rows;
};

const findById = async (id, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT ${CAMPOS},
       (SELECT COUNT(*)::int FROM pre_tickets pt WHERE pt.id_concepto = c.id_concepto) AS pretickets,
       (SELECT COUNT(*)::int FROM pagos p WHERE p.id_concepto = c.id_concepto AND p.estado = 'PAGADO') AS pagos,
       (SELECT COUNT(*)::int FROM pensiones pe WHERE pe.id_concepto = c.id_concepto) AS pensiones
     FROM conceptos_pago c
     LEFT JOIN grados g ON g.id_grado = c.id_grado
     WHERE c.id_concepto = $1`,
    [id],
  );
  return result.rows[0] || null;
};

const findByIdForUpdate = async (id, client) => {
  const result = await client.query(
    `SELECT * FROM conceptos_pago WHERE id_concepto = $1 FOR UPDATE`,
    [id],
  );
  return result.rows[0] || null;
};

const crear = async (data, client = null) => {
  const result = await ejecutar(
    client,
    `INSERT INTO conceptos_pago (
       nombre, monto_base, tipo, mes, anio_lectivo,
       nivel, id_grado, activo, descripcion, orden,
       vigente_desde, vigente_hasta, creado_por, actualizado_por
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12, $13, $14
     )
     RETURNING *`,
    [
      data.nombre,
      data.monto_base,
      data.tipo,
      data.mes,
      data.anio_lectivo,
      data.nivel,
      data.id_grado,
      data.activo,
      data.descripcion,
      data.orden,
      data.vigente_desde,
      data.vigente_hasta,
      data.id_usuario,
      data.id_usuario,
    ],
  );
  return result.rows[0];
};

const actualizar = async (id, data, client = null) => {
  const result = await ejecutar(
    client,
    `UPDATE conceptos_pago SET
       nombre = $2,
       monto_base = $3,
       tipo = $4,
       mes = $5,
       anio_lectivo = $6,
       nivel = $7,
       id_grado = $8,
       activo = $9,
       descripcion = $10,
       orden = $11,
       vigente_desde = $12,
       vigente_hasta = $13,
       actualizado_por = $14,
       fecha_actualizacion = now()
     WHERE id_concepto = $1
     RETURNING *`,
    [
      id,
      data.nombre,
      data.monto_base,
      data.tipo,
      data.mes,
      data.anio_lectivo,
      data.nivel,
      data.id_grado,
      data.activo,
      data.descripcion,
      data.orden,
      data.vigente_desde,
      data.vigente_hasta,
      data.id_usuario,
    ],
  );
  return result.rows[0] || null;
};

const cerrarVigencia = async (id, hasta, idUsuario, client) => {
  const result = await client.query(
    `UPDATE conceptos_pago SET
       vigente_hasta = $2,
       actualizado_por = $3,
       fecha_actualizacion = now()
     WHERE id_concepto = $1
     RETURNING *`,
    [id, hasta, idUsuario || null],
  );
  return result.rows[0] || null;
};

const desactivar = async (id, idUsuario, client = null) => {
  const result = await ejecutar(
    client,
    `UPDATE conceptos_pago SET
       activo = false,
       actualizado_por = $2,
       fecha_actualizacion = now()
     WHERE id_concepto = $1
     RETURNING *`,
    [id, idUsuario || null],
  );
  return result.rows[0] || null;
};

/**
 * Resuelve la tarifa vigente. La lógica vive en la función SQL H75.
 */
const resolver = async (
  { anio, tipo, mes = null, idGrado = null, fecha = null },
  client = null,
) => {
  const result = await ejecutar(
    client,
    `SELECT * FROM resolver_concepto_pago($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE))`,
    [anio, tipo, mes, idGrado, fecha],
  );
  return result.rows[0] || null;
};

const contarDependencias = async (id, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT
       (SELECT COUNT(*)::int FROM pagos WHERE id_concepto = $1) AS pagos,
       (SELECT COUNT(*)::int FROM pre_tickets WHERE id_concepto = $1) AS pretickets,
       (SELECT COUNT(*)::int FROM pensiones WHERE id_concepto = $1) AS pensiones`,
    [id],
  );
  return result.rows[0] || { pagos: 0, pretickets: 0, pensiones: 0 };
};

/**
 * Impacto estimado de una tarifa. No escribe.
 */
const impacto = async (
  { anio, tipo, mes = null, idGrado = null, nivel = null, idConcepto = null },
  client = null,
) => {
  const params = [anio, idGrado, nivel, mes, idConcepto];
  const filtroScope = `
    AND ($2::int IS NULL OR a.id_grado = $2)
    AND ($3::varchar IS NULL OR g.nivel = $3)
  `;

  const result = await ejecutar(
    client,
    `SELECT
       (SELECT COUNT(*)::int
        FROM alumnos a
        INNER JOIN grados g ON g.id_grado = a.id_grado
        WHERE a.anio_lectivo = $1
          AND a.estado_matricula IN ('Matriculado', 'PendientePago')
          ${filtroScope}) AS alumnos_afectados,
       (SELECT COUNT(*)::int
        FROM pensiones p
        INNER JOIN alumnos a ON a.id_alumno = p.id_alumno
        INNER JOIN grados g ON g.id_grado = a.id_grado
        WHERE p.anio_lectivo = $1
          AND p.estado = 'PENDIENTE'
          AND ($4::int IS NULL OR p.mes = $4)
          ${filtroScope}) AS pensiones_pendientes,
       (SELECT COUNT(*)::int
        FROM pre_tickets pt
        INNER JOIN alumnos a ON a.id_alumno = pt.id_alumno
        INNER JOIN grados g ON g.id_grado = a.id_grado
        WHERE a.anio_lectivo = $1
          AND pt.estado = 'PENDIENTE'
          AND ($5::int IS NULL OR pt.id_concepto = $5)
          ${filtroScope}) AS pretickets_pendientes,
       (SELECT COUNT(*)::int
        FROM pagos p
        INNER JOIN alumnos a ON a.id_alumno = p.id_alumno
        INNER JOIN grados g ON g.id_grado = a.id_grado
        WHERE a.anio_lectivo = $1
          AND p.estado = 'PAGADO'
          AND ($5::int IS NULL OR p.id_concepto = $5)
          ${filtroScope}) AS pagos_realizados`,
    params,
  );
  return result.rows[0] || {};
};

module.exports = {
  listar,
  findById,
  findByIdForUpdate,
  crear,
  actualizar,
  cerrarVigencia,
  desactivar,
  resolver,
  contarDependencias,
  impacto,
};
