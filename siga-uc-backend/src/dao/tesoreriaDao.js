/**
 * DAO para Tesorería: pre_tickets, pagos, pensiones, becas, boletas
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");

// ============================================================
// CONCEPTOS DE PAGO
// ============================================================
const listarConceptos = async (anioLectivo = 2026) => {
  const sql = `
    SELECT id_concepto, nombre, monto_base, tipo, mes, anio_lectivo
    FROM conceptos_pago
    WHERE anio_lectivo = $1
    ORDER BY tipo, mes NULLS FIRST
  `;
  const result = await query(sql, [anioLectivo]);
  return result.rows;
};

const findConceptoById = async (id) => {
  const sql = `SELECT * FROM conceptos_pago WHERE id_concepto = $1`;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

// ============================================================
// PRE-TICKETS
// ============================================================
const listarPreTickets = async (filtros = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filtros.estado) {
    conditions.push(`pt.estado = $${idx++}`);
    params.push(filtros.estado);
  }
  if (filtros.id_alumno) {
    conditions.push(`pt.id_alumno = $${idx++}`);
    params.push(filtros.id_alumno);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT 
      pt.id_preticket,
      pt.monto,
      pt.estado,
      pt.fecha_emision,
      pt.fecha_pago,
      a.id_alumno,
      a.dni,
      a.nombres || ' ' || a.apellidos AS alumno_nombre,
      g.nombre_grado,
      g.seccion,
      c.id_concepto,
      c.nombre AS concepto_nombre,
      c.tipo AS concepto_tipo,
      u.nombres || ' ' || u.apellidos AS emitido_por
    FROM pre_tickets pt
    INNER JOIN alumnos a ON a.id_alumno = pt.id_alumno
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    INNER JOIN conceptos_pago c ON c.id_concepto = pt.id_concepto
    LEFT JOIN usuarios u ON u.id_usuario = pt.id_usuario_emite
    ${where}
    ORDER BY pt.fecha_emision DESC
  `;
  const result = await query(sql, params);
  return result.rows;
};

const findPreTicketById = async (id) => {
  const sql = `
    SELECT 
      pt.*,
      a.dni, a.nombres, a.apellidos,
      a.nombres || ' ' || a.apellidos AS alumno_nombre,
      g.nombre_grado, g.seccion,
      c.nombre AS concepto_nombre, c.tipo AS concepto_tipo
    FROM pre_tickets pt
    INNER JOIN alumnos a ON a.id_alumno = pt.id_alumno
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    INNER JOIN conceptos_pago c ON c.id_concepto = pt.id_concepto
    WHERE pt.id_preticket = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

const crearPreTicket = async (data) => {
  const sql = `
    INSERT INTO pre_tickets (id_alumno, id_concepto, monto, estado, id_usuario_emite)
    VALUES ($1, $2, $3, 'PENDIENTE', $4)
    RETURNING *
  `;
  const result = await query(sql, [
    data.id_alumno,
    data.id_concepto,
    data.monto,
    data.id_usuario_emite,
  ]);
  return result.rows[0];
};

// ============================================================
// PAGOS
// ============================================================
const listarPagos = async (filtros = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filtros.id_alumno) {
    conditions.push(`p.id_alumno = $${idx++}`);
    params.push(filtros.id_alumno);
  }
  if (filtros.desde) {
    conditions.push(`p.fecha_pago >= $${idx++}`);
    params.push(filtros.desde);
  }
  if (filtros.hasta) {
    conditions.push(`p.fecha_pago <= $${idx++}`);
    params.push(filtros.hasta);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT 
      p.id_pago,
      p.monto,
      p.forma_pago,
      p.nro_operacion,
      p.fecha_pago,
      p.estado,
      a.id_alumno,
      a.dni,
      a.nombres || ' ' || a.apellidos AS alumno_nombre,
      g.nombre_grado,
      c.nombre AS concepto_nombre,
      u.nombres || ' ' || u.apellidos AS cobrador,
      b.numero_boleta,
      b.estado_sunat
    FROM pagos p
    INNER JOIN alumnos a ON a.id_alumno = p.id_alumno
    LEFT JOIN grados g ON g.id_grado = a.id_grado
    INNER JOIN conceptos_pago c ON c.id_concepto = p.id_concepto
    LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario_cobrador
    LEFT JOIN boletas_electronicas b ON b.id_pago = p.id_pago
    ${where}
    ORDER BY p.fecha_pago DESC
  `;
  const result = await query(sql, params);
  return result.rows;
};

const findPagoById = async (id) => {
  const sql = `
    SELECT 
      p.*,
      a.dni, a.nombres, a.apellidos,
      a.nombres || ' ' || a.apellidos AS alumno_nombre,
      c.nombre AS concepto_nombre,
      b.numero_boleta, b.serie, b.numero AS num_boleta, b.estado_sunat, b.hash_cpe
    FROM pagos p
    INNER JOIN alumnos a ON a.id_alumno = p.id_alumno
    INNER JOIN conceptos_pago c ON c.id_concepto = p.id_concepto
    LEFT JOIN boletas_electronicas b ON b.id_pago = p.id_pago
    WHERE p.id_pago = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Registrar pago + generar boleta electrónica (transacción)
 */
const registrarPago = async (data) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // 1. Crear pago (casteando los parámetros NULLables)
    const pagoSql = `
      INSERT INTO pagos (
        id_alumno, id_preticket, id_pension, id_concepto,
        monto, forma_pago, nro_operacion, id_usuario_cobrador, estado
      ) VALUES (
        $1::INT, $2::INT, $3::INT, $4::INT,
        $5::DECIMAL, $6::VARCHAR, $7::VARCHAR, $8::INT, 'PAGADO'
      )
      RETURNING *
    `;
    const pagoResult = await client.query(pagoSql, [
      data.id_alumno,
      data.id_preticket || null,
      data.id_pension || null,
      data.id_concepto,
      data.monto,
      data.forma_pago,
      data.nro_operacion || null,
      data.id_usuario_cobrador,
    ]);
    const pago = pagoResult.rows[0];

    // 2. Generar número de boleta
    const numSql = `SELECT COALESCE(MAX(numero), 4820) + 1 AS siguiente FROM boletas_electronicas`;
    const numResult = await client.query(numSql);
    const numero = numResult.rows[0].siguiente;
    const numeroBoleta = `B001-${String(numero).padStart(6, "0")}`;

    // 3. Crear boleta electrónica
    const boletaSql = `
      INSERT INTO boletas_electronicas (
        id_pago, numero_boleta, serie, numero, monto_total, estado_sunat, hash_cpe
      ) VALUES ($1::INT, $2::VARCHAR, 'B001', $3::INT, $4::DECIMAL, 'ACEPTADO', MD5($2::text || NOW()::text))
      RETURNING *
    `;
    const boletaResult = await client.query(boletaSql, [
      pago.id_pago,
      numeroBoleta,
      numero,
      data.monto,
    ]);
    const boleta = boletaResult.rows[0];

    // 4. Actualizar pre-ticket si aplica
    if (data.id_preticket) {
      await client.query(
        `UPDATE pre_tickets SET estado = 'PAGADO', fecha_pago = NOW() WHERE id_preticket = $1::INT`,
        [data.id_preticket],
      );
    }

    // 5. Actualizar pensión si aplica
    if (data.id_pension) {
      await client.query(
        `UPDATE pensiones SET estado = 'PAGADO' WHERE id_pension = $1::INT`,
        [data.id_pension],
      );
    }

    // 6. Actualizar matrícula del alumno si el concepto es MATRICULA
    if (data.tipo_concepto === "MATRICULA") {
      await client.query(
        `UPDATE alumnos SET estado_matricula = 'Matriculado' WHERE id_alumno = $1::INT`,
        [data.id_alumno],
      );
    }

    await client.query("COMMIT");
    return { pago, boleta };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// PENSIONES
// ============================================================
const listarPensionesAlumno = async (id_alumno, anioLectivo = 2026) => {
  const sql = `
    SELECT 
      p.id_pension, p.mes, p.monto_base, p.descuento, p.monto_final, p.estado,
      c.nombre AS concepto_nombre, c.mes AS concepto_mes
    FROM pensiones p
    LEFT JOIN conceptos_pago c ON c.tipo = 'PENSION' AND c.mes = p.mes AND c.anio_lectivo = p.anio_lectivo
    WHERE p.id_alumno = $1 AND p.anio_lectivo = $2
    ORDER BY p.mes
  `;
  const result = await query(sql, [id_alumno, anioLectivo]);
  return result.rows;
};

const generarPensionesMensuales = async (
  anioLectivo,
  mes,
  montoBase = 250.0,
) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Insertar pensión para todos los alumnos matriculados si no existe
    const sql = `
      INSERT INTO pensiones (id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado)
      SELECT 
        a.id_alumno, $1, $2, $3,
        COALESCE(
          (SELECT monto_descuento FROM becas WHERE id_alumno = a.id_alumno AND activo = TRUE LIMIT 1), 
          0
        ),
        $3 - COALESCE(
          (SELECT monto_descuento FROM becas WHERE id_alumno = a.id_alumno AND activo = TRUE LIMIT 1), 
          0
        ),
        'PENDIENTE'
      FROM alumnos a
      WHERE a.estado_matricula = 'Matriculado' AND a.anio_lectivo = $1
      ON CONFLICT (id_alumno, anio_lectivo, mes) DO NOTHING
      RETURNING id_pension
    `;
    const result = await client.query(sql, [anioLectivo, mes, montoBase]);
    await client.query("COMMIT");
    return result.rowCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ============================================================
// BECAS
// ============================================================
const listarBecas = async (filtros = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filtros.activo !== undefined) {
    conditions.push(`b.activo = $${idx++}`);
    params.push(filtros.activo);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT 
      b.id_beca, b.tipo, b.porcentaje_descuento, b.monto_descuento,
      b.fecha_inicio, b.fecha_fin, b.activo,
      a.id_alumno, a.dni,
      a.nombres || ' ' || a.apellidos AS alumno_nombre
    FROM becas b
    INNER JOIN alumnos a ON a.id_alumno = b.id_alumno
    ${where}
    ORDER BY b.fecha_inicio DESC
  `;
  const result = await query(sql, params);
  return result.rows;
};

const crearBeca = async (data) => {
  const sql = `
    INSERT INTO becas (
      id_alumno, tipo, porcentaje_descuento, monto_descuento, fecha_inicio, fecha_fin, activo
    ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
    RETURNING *
  `;
  const result = await query(sql, [
    data.id_alumno,
    data.tipo,
    data.porcentaje_descuento,
    data.monto_descuento || 0,
    data.fecha_inicio,
    data.fecha_fin || null,
  ]);
  return result.rows[0];
};

// ============================================================
// ESTADÍSTICAS
// ============================================================
const getEstadisticasMes = async (anioLectivo, mes) => {
  const sql = `
    SELECT 
      COALESCE(SUM(monto), 0) AS total_recaudado,
      COUNT(*) AS total_pagos,
      COUNT(*) FILTER (WHERE forma_pago = 'Efectivo') AS pagos_efectivo,
      COUNT(*) FILTER (WHERE forma_pago != 'Efectivo') AS pagos_digital
    FROM pagos
    WHERE EXTRACT(YEAR FROM fecha_pago) = $1
      AND EXTRACT(MONTH FROM fecha_pago) = $2
      AND estado = 'PAGADO'
  `;
  const result = await query(sql, [anioLectivo, mes]);
  return result.rows[0];
};

const getPendientesCobro = async (anioLectivo = 2026) => {
  const sql = `
    SELECT 
      COUNT(*) AS total_pendientes,
      COALESCE(SUM(monto), 0) AS monto_pendiente
    FROM pre_tickets
    WHERE estado = 'PENDIENTE'
  `;
  const result = await query(sql);
  return result.rows[0];
};

module.exports = {
  // Conceptos
  listarConceptos,
  findConceptoById,
  // Pre-tickets
  listarPreTickets,
  findPreTicketById,
  crearPreTicket,
  // Pagos
  listarPagos,
  findPagoById,
  registrarPago,
  // Pensiones
  listarPensionesAlumno,
  generarPensionesMensuales,
  // Becas
  listarBecas,
  crearBeca,
  // Estadísticas
  getEstadisticasMes,
  getPendientesCobro,
};
