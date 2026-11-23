/**
 * DAO de becas y tipos de beca (Fase 5 / H78)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

const ejecutar = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

const CAMPOS_TIPO = `
  t.id_tipo_beca, t.codigo, t.nombre, t.descripcion,
  t.alcance, t.modalidad, t.valor_default, t.tope_monto,
  t.permite_combinacion, t.grupo_exclusividad, t.prioridad,
  t.requiere_evidencia, t.requiere_aprobacion, t.activo, t.orden,
  t.fecha_creacion, t.fecha_actualizacion
`;

const CAMPOS_BECA = `
  b.id_beca, b.id_alumno, b.id_tipo_beca, b.tipo,
  b.porcentaje_descuento, b.monto_descuento, b.fecha_inicio, b.fecha_fin,
  b.activo, b.alcance, b.modalidad, b.valor, b.monto_maximo, b.estado,
  b.motivo, b.evidencia, b.aprobado_por, b.fecha_aprobacion,
  b.grupo_exclusividad, b.prioridad, b.creado_por,
  b.fecha_creacion, b.fecha_actualizacion,
  ${CAMPOS_TIPO},
  t.codigo AS tipo_codigo, t.nombre AS tipo_nombre,
  t.requiere_evidencia, t.requiere_aprobacion,
  a.dni, a.nombres, a.apellidos,
  a.nombres || ' ' || a.apellidos AS alumno_nombre,
  a.anio_lectivo, a.id_grado
`;

const listarTipos = async (incluirInactivos = false) => {
  const result = await query(
    `SELECT ${CAMPOS_TIPO},
       (SELECT COUNT(*)::int FROM becas b WHERE b.id_tipo_beca = t.id_tipo_beca) AS total_becas
     FROM tipos_beca t
     WHERE ($1::boolean = TRUE OR t.activo = TRUE)
     ORDER BY t.orden, t.nombre`,
    [incluirInactivos],
  );
  return result.rows;
};

const findTipoById = async (id) => {
  const result = await query(
    `SELECT ${CAMPOS_TIPO} FROM tipos_beca t WHERE t.id_tipo_beca = $1`,
    [id],
  );
  return result.rows[0] || null;
};

const findTipoByCodigo = async (codigo) => {
  const result = await query(
    `SELECT ${CAMPOS_TIPO} FROM tipos_beca t WHERE upper(t.codigo) = upper($1)`,
    [codigo],
  );
  return result.rows[0] || null;
};

const crearTipo = async (data, client = null) => {
  const result = await ejecutar(
    client,
    `INSERT INTO tipos_beca (
       codigo, nombre, descripcion, alcance, modalidad, valor_default,
       tope_monto, permite_combinacion, grupo_exclusividad, prioridad,
       requiere_evidencia, requiere_aprobacion, activo, orden, creado_por
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
     ) RETURNING *`,
    [
      data.codigo,
      data.nombre,
      data.descripcion,
      data.alcance,
      data.modalidad,
      data.valor_default,
      data.tope_monto,
      data.permite_combinacion,
      data.grupo_exclusividad,
      data.prioridad,
      data.requiere_evidencia,
      data.requiere_aprobacion,
      data.activo,
      data.orden,
      data.id_usuario,
    ],
  );
  return result.rows[0];
};

const actualizarTipo = async (id, data, client = null) => {
  const result = await ejecutar(
    client,
    `UPDATE tipos_beca SET
       codigo = $2, nombre = $3, descripcion = $4, alcance = $5,
       modalidad = $6, valor_default = $7, tope_monto = $8,
       permite_combinacion = $9, grupo_exclusividad = $10, prioridad = $11,
       requiere_evidencia = $12, requiere_aprobacion = $13, activo = $14,
       orden = $15, actualizado_por = $16, fecha_actualizacion = now()
     WHERE id_tipo_beca = $1
     RETURNING *`,
    [
      id,
      data.codigo,
      data.nombre,
      data.descripcion,
      data.alcance,
      data.modalidad,
      data.valor_default,
      data.tope_monto,
      data.permite_combinacion,
      data.grupo_exclusividad,
      data.prioridad,
      data.requiere_evidencia,
      data.requiere_aprobacion,
      data.activo,
      data.orden,
      data.id_usuario,
    ],
  );
  return result.rows[0] || null;
};

const listarBecas = async (filtros = {}, client = null) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filtros.anio) {
    conditions.push(`a.anio_lectivo = $${idx++}`);
    params.push(filtros.anio);
  }
  if (filtros.id_alumno) {
    conditions.push(`b.id_alumno = $${idx++}`);
    params.push(filtros.id_alumno);
  }
  if (filtros.id_tipo_beca) {
    conditions.push(`b.id_tipo_beca = $${idx++}`);
    params.push(filtros.id_tipo_beca);
  }
  if (filtros.estado) {
    conditions.push(`b.estado = $${idx++}`);
    params.push(filtros.estado);
  }
  if (filtros.activo !== undefined) {
    conditions.push(`b.activo = $${idx++}`);
    params.push(filtros.activo);
  }
  if (filtros.id_grado) {
    conditions.push(`a.id_grado = $${idx++}`);
    params.push(filtros.id_grado);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await ejecutar(
    client,
    `SELECT ${CAMPOS_BECA}
     FROM becas b
     INNER JOIN tipos_beca t ON t.id_tipo_beca = b.id_tipo_beca
     INNER JOIN alumnos a ON a.id_alumno = b.id_alumno
     ${where}
     ORDER BY a.apellidos, a.nombres, b.fecha_inicio DESC, b.id_beca`,
    params,
  );
  return result.rows;
};

const findBecaById = async (id, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT ${CAMPOS_BECA}
     FROM becas b
     INNER JOIN tipos_beca t ON t.id_tipo_beca = b.id_tipo_beca
     INNER JOIN alumnos a ON a.id_alumno = b.id_alumno
     WHERE b.id_beca = $1`,
    [id],
  );
  return result.rows[0] || null;
};

const findBecaForUpdate = async (id, client) => {
  const result = await client.query(
    `SELECT * FROM becas WHERE id_beca = $1 FOR UPDATE`,
    [id],
  );
  return result.rows[0] || null;
};

const crearBeca = async (data, client = null) => {
  const result = await ejecutar(
    client,
    `INSERT INTO becas (
       id_alumno, id_tipo_beca, tipo, porcentaje_descuento, monto_descuento,
       fecha_inicio, fecha_fin, activo, alcance, modalidad, valor,
       monto_maximo, estado, motivo, evidencia, aprobado_por,
       fecha_aprobacion, grupo_exclusividad, prioridad, creado_por
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15::jsonb, $16, $17, $18, $19, $20
     ) RETURNING *`,
    [
      data.id_alumno,
      data.id_tipo_beca,
      data.tipo,
      data.porcentaje_descuento,
      data.monto_descuento,
      data.fecha_inicio,
      data.fecha_fin,
      data.activo,
      data.alcance,
      data.modalidad,
      data.valor,
      data.monto_maximo,
      data.estado,
      data.motivo,
      data.evidencia ? JSON.stringify(data.evidencia) : null,
      data.aprobado_por,
      data.fecha_aprobacion,
      data.grupo_exclusividad,
      data.prioridad,
      data.id_usuario,
    ],
  );
  return result.rows[0];
};

const actualizarBeca = async (id, data, client = null) => {
  const result = await ejecutar(
    client,
    `UPDATE becas SET
       id_tipo_beca = $2, tipo = $3, porcentaje_descuento = $4,
       monto_descuento = $5, fecha_inicio = $6, fecha_fin = $7,
       activo = $8, alcance = $9, modalidad = $10, valor = $11,
       monto_maximo = $12, estado = $13, motivo = $14,
       evidencia = $15::jsonb, aprobado_por = $16,
       fecha_aprobacion = $17, grupo_exclusividad = $18,
       prioridad = $19, fecha_actualizacion = now()
     WHERE id_beca = $1
     RETURNING *`,
    [
      id,
      data.id_tipo_beca,
      data.tipo,
      data.porcentaje_descuento,
      data.monto_descuento,
      data.fecha_inicio,
      data.fecha_fin,
      data.activo,
      data.alcance,
      data.modalidad,
      data.valor,
      data.monto_maximo,
      data.estado,
      data.motivo,
      data.evidencia ? JSON.stringify(data.evidencia) : null,
      data.aprobado_por,
      data.fecha_aprobacion,
      data.grupo_exclusividad,
      data.prioridad,
    ],
  );
  return result.rows[0] || null;
};

const cambiarEstado = async (id, estado, data, client = null) => {
  const result = await ejecutar(
    client,
    `UPDATE becas SET
       estado = $2, activo = $3, motivo = $4, aprobado_por = $5,
       fecha_aprobacion = $6, fecha_actualizacion = now()
     WHERE id_beca = $1
     RETURNING *`,
    [
      id,
      estado,
      data.activo,
      data.motivo,
      data.aprobado_por,
      data.fecha_aprobacion,
    ],
  );
  return result.rows[0] || null;
};

const listarAplicables = async (
  { idAlumno, alcance, fecha },
  client = null,
) => {
  const result = await ejecutar(
    client,
    `SELECT
       b.*, t.codigo AS tipo_codigo, t.nombre AS tipo_nombre,
       t.permite_combinacion,
       COALESCE(NULLIF(b.grupo_exclusividad, ''), t.grupo_exclusividad) AS grupo,
       COALESCE(b.prioridad, t.prioridad) AS prioridad_efectiva
     FROM becas b
     INNER JOIN tipos_beca t ON t.id_tipo_beca = b.id_tipo_beca
     WHERE b.id_alumno = $1
       AND b.estado = 'APROBADA'
       AND b.activo = TRUE
       AND t.activo = TRUE
       AND b.fecha_inicio <= $2
       AND (b.fecha_fin IS NULL OR b.fecha_fin >= $2)
       AND b.alcance IN ('AMBOS', $3)
     ORDER BY COALESCE(b.prioridad, t.prioridad) DESC, b.id_beca`,
    [idAlumno, fecha, alcance],
  );
  return result.rows;
};

const eliminarAplicacionesPension = async (idPension, client) => {
  await client.query(
    `DELETE FROM aplicaciones_beca WHERE id_pension = $1`,
    [idPension],
  );
};

const eliminarAplicacionesPreticket = async (idPreticket, client) => {
  await client.query(
    `DELETE FROM aplicaciones_beca WHERE id_preticket = $1`,
    [idPreticket],
  );
};

const crearAplicacion = async (data, client) => {
  const result = await client.query(
    `INSERT INTO aplicaciones_beca (
       id_beca, id_pension, id_preticket, monto_aplicado,
       porcentaje_aplicado, creado_por
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      data.id_beca,
      data.id_pension,
      data.id_preticket,
      data.monto_aplicado,
      data.porcentaje_aplicado,
      data.creado_por,
    ],
  );
  return result.rows[0] || null;
};

const actualizarPension = async (
  idPension,
  { descuento, montoFinal, idBeca },
  client,
) => {
  const result = await client.query(
    `UPDATE pensiones SET
       descuento = $2,
       monto_final = $3,
       id_beca = $4,
       estado = CASE
         WHEN estado IN ('PAGADO', 'ANULADO') THEN estado
         WHEN $3::numeric = 0 THEN 'EXONERADO'
         ELSE 'PENDIENTE'
       END
     WHERE id_pension = $1
     RETURNING *`,
    [idPension, descuento, montoFinal, idBeca],
  );
  return result.rows[0] || null;
};

const actualizarPreticket = async (
  idPreticket,
  { descuento, monto, exonerado },
  client,
) => {
  const result = await client.query(
    `UPDATE pre_tickets SET
       descuento = $2,
       monto = $3,
       estado = CASE
         WHEN $4::boolean THEN 'EXONERADO'
         WHEN estado = 'EXONERADO' THEN 'PENDIENTE'
         ELSE estado
       END,
       fecha_pago = CASE
         WHEN $4::boolean THEN NULL
         WHEN estado = 'EXONERADO' THEN NULL
         ELSE fecha_pago
       END
     WHERE id_preticket = $1
     RETURNING *`,
    [idPreticket, descuento, monto, Boolean(exonerado)],
  );
  return result.rows[0] || null;
};

const listarPreticketsMatriculaPendientes = async (
  idAlumno,
  client = null,
) => {
  const result = await ejecutar(
    client,
    `SELECT pt.*
     FROM pre_tickets pt
     INNER JOIN conceptos_pago c ON c.id_concepto = pt.id_concepto
     WHERE pt.id_alumno = $1
       AND pt.estado = 'PENDIENTE'
       AND c.tipo = 'MATRICULA'
     ORDER BY pt.fecha_emision DESC`,
    [idAlumno],
  );
  return result.rows;
};

const listarPreticketsExonerados = async (idAlumno, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT pt.*
     FROM pre_tickets pt
     INNER JOIN conceptos_pago c ON c.id_concepto = pt.id_concepto
     WHERE pt.id_alumno = $1
       AND pt.estado = 'EXONERADO'
       AND pt.descuento > 0
       AND c.tipo = 'MATRICULA'
       AND NOT EXISTS (
         SELECT 1 FROM pagos p
         WHERE p.id_preticket = pt.id_preticket
           AND p.estado = 'PAGADO'
       )
     ORDER BY pt.fecha_emision DESC`,
    [idAlumno],
  );
  return result.rows;
};

const contarAplicacionesBeca = async (idBeca, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT COUNT(*)::int AS total FROM aplicaciones_beca WHERE id_beca = $1`,
    [idBeca],
  );
  return Number(result.rows[0]?.total || 0);
};

const findPreticketPendiente = async (idAlumno, idConcepto, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT * FROM pre_tickets
     WHERE id_alumno = $1 AND id_concepto = $2 AND estado = 'PENDIENTE'
     ORDER BY fecha_emision DESC
     LIMIT 1`,
    [idAlumno, idConcepto],
  );
  return result.rows[0] || null;
};

module.exports = {
  listarTipos,
  findTipoById,
  findTipoByCodigo,
  crearTipo,
  actualizarTipo,
  listarBecas,
  findBecaById,
  findBecaForUpdate,
  crearBeca,
  actualizarBeca,
  cambiarEstado,
  listarAplicables,
  eliminarAplicacionesPension,
  eliminarAplicacionesPreticket,
  crearAplicacion,
  actualizarPension,
  actualizarPreticket,
  listarPreticketsMatriculaPendientes,
  listarPreticketsExonerados,
  findPreticketPendiente,
  contarAplicacionesBeca,
};
