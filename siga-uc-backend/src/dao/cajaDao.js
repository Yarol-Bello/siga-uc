/**
 * DAO para el módulo de Caja
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");

/**
 * Obtener la caja actualmente abierta (si existe)
 */
const obtenerCajaAbierta = async () => {
  const sql = `
    SELECT 
      ap.id_apertura,
      ap.monto_inicial,
      ap.fecha_apertura,
      ap.observaciones,
      c.id_caja,
      c.nombre_caja,
      u.nombres || ' ' || u.apellidos AS responsable,
      (SELECT COALESCE(SUM(monto), 0) FROM movimientos_caja 
       WHERE id_apertura = ap.id_apertura AND tipo = 'INGRESO') AS total_ingresos,
      (SELECT COALESCE(SUM(monto), 0) FROM movimientos_caja 
       WHERE id_apertura = ap.id_apertura AND tipo = 'EGRESO') AS total_egresos
    FROM aperturas_caja ap
    INNER JOIN cajas c ON c.id_caja = ap.id_caja
    LEFT JOIN usuarios u ON u.id_usuario = ap.id_usuario_apertura
    WHERE NOT EXISTS (
      SELECT 1 FROM cierres_caja cc WHERE cc.id_apertura = ap.id_apertura
    )
    ORDER BY ap.fecha_apertura DESC
    LIMIT 1
  `;
  const result = await query(sql);
  return result.rows[0] || null;
};

/**
 * Listar todas las cajas registradas
 */
const listarCajas = async () => {
  const sql = `
    SELECT 
      c.id_caja,
      c.nombre_caja,
      c.estado,
      u.nombres || ' ' || u.apellidos AS responsable
    FROM cajas c
    LEFT JOIN usuarios u ON u.id_usuario = c.responsable
    ORDER BY c.id_caja
  `;
  const result = await query(sql);
  return result.rows;
};

/**
 * Listar aperturas históricas
 */
const listarAperturas = async (filtros = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filtros.desde) {
    conditions.push(`ap.fecha_apertura >= $${idx++}`);
    params.push(filtros.desde);
  }
  if (filtros.hasta) {
    conditions.push(`ap.fecha_apertura <= $${idx++}`);
    params.push(filtros.hasta);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT 
      ap.id_apertura,
      ap.monto_inicial,
      ap.fecha_apertura,
      ap.observaciones,
      c.nombre_caja,
      u.nombres || ' ' || u.apellidos AS usuario_apertura,
      cc.id_cierre,
      cc.fecha_cierre,
      cc.efectivo_fisico,
      cc.diferencia,
      cc.estado AS estado_cierre
    FROM aperturas_caja ap
    INNER JOIN cajas c ON c.id_caja = ap.id_caja
    LEFT JOIN usuarios u ON u.id_usuario = ap.id_usuario_apertura
    LEFT JOIN cierres_caja cc ON cc.id_apertura = ap.id_apertura
    ${where}
    ORDER BY ap.fecha_apertura DESC
  `;
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Buscar apertura por ID
 */
const findAperturaById = async (id) => {
  const sql = `
    SELECT 
      ap.*,
      c.nombre_caja,
      u.nombres || ' ' || u.apellidos AS usuario_apertura
    FROM aperturas_caja ap
    INNER JOIN cajas c ON c.id_caja = ap.id_caja
    LEFT JOIN usuarios u ON u.id_usuario = ap.id_usuario_apertura
    WHERE ap.id_apertura = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Aperturar caja
 */
const aperturar = async (data) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Verificar que no haya una caja abierta
    const cajaAbierta = await obtenerCajaAbierta();
    if (cajaAbierta) {
      const error = new Error(
        "Ya existe una caja abierta. Cierre la actual antes de aperturar una nueva.",
      );
      error.statusCode = 409;
      throw error;
    }

    // Obtener la primera caja o crearla
    let id_caja = data.id_caja;
    if (!id_caja) {
      const cajaResult = await client.query(
        `SELECT id_caja FROM cajas ORDER BY id_caja LIMIT 1`,
      );
      if (cajaResult.rows.length === 0) {
        const newCaja = await client.query(
          `
          INSERT INTO cajas (nombre_caja, responsable, estado) 
          VALUES ('Caja Principal', $1, 'ABIERTA') RETURNING id_caja
        `,
          [data.id_usuario_apertura],
        );
        id_caja = newCaja.rows[0].id_caja;
      } else {
        id_caja = cajaResult.rows[0].id_caja;
      }
    }

    // Crear apertura
    const aperturaSql = `
      INSERT INTO aperturas_caja (id_caja, monto_inicial, id_usuario_apertura, observaciones)
      VALUES ($1::INT, $2::DECIMAL, $3::INT, $4::VARCHAR)
      RETURNING *
    `;
    const aperturaResult = await client.query(aperturaSql, [
      id_caja,
      data.monto_inicial,
      data.id_usuario_apertura,
      data.observaciones || null,
    ]);

    // Registrar movimiento de apertura
    await client.query(
      `
      INSERT INTO movimientos_caja (
        id_apertura, tipo, concepto, monto, medio_pago, id_usuario
      ) VALUES ($1::INT, 'APERTURA', 'Fondo inicial de caja', $2::DECIMAL, 'Efectivo', $3::INT)
    `,
      [
        aperturaResult.rows[0].id_apertura,
        data.monto_inicial,
        data.id_usuario_apertura,
      ],
    );

    // Actualizar estado de la caja
    await client.query(
      `UPDATE cajas SET estado = 'ABIERTA' WHERE id_caja = $1::INT`,
      [id_caja],
    );

    await client.query("COMMIT");
    return aperturaResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Listar movimientos de una apertura
 */
const listarMovimientos = async (id_apertura) => {
  const sql = `
    SELECT 
      m.id_movimiento,
      m.tipo,
      m.concepto,
      m.monto,
      m.medio_pago,
      m.nro_comprobante,
      m.fecha_hora,
      u.nombres || ' ' || u.apellidos AS usuario
    FROM movimientos_caja m
    LEFT JOIN usuarios u ON u.id_usuario = m.id_usuario
    WHERE m.id_apertura = $1
    ORDER BY m.fecha_hora DESC
  `;
  const result = await query(sql, [id_apertura]);
  return result.rows;
};

/**
 * Registrar egreso
 */
const registrarEgreso = async (data) => {
  const cajaAbierta = await obtenerCajaAbierta();
  if (!cajaAbierta) {
    const error = new Error("No hay caja abierta. Aperture una caja primero.");
    error.statusCode = 400;
    throw error;
  }

  const sql = `
    INSERT INTO movimientos_caja (
      id_apertura, tipo, concepto, monto, medio_pago, nro_comprobante, id_usuario
    ) VALUES ($1::INT, 'EGRESO', $2::VARCHAR, $3::DECIMAL, 'Efectivo', $4::VARCHAR, $5::INT)
    RETURNING *
  `;
  const result = await query(sql, [
    cajaAbierta.id_apertura,
    data.concepto,
    data.monto,
    data.nro_comprobante || null,
    data.id_usuario,
  ]);
  return result.rows[0];
};

/**
 * Cerrar caja con arqueo
 */
const cerrar = async (data) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const cajaAbierta = await obtenerCajaAbierta();
    if (!cajaAbierta) {
      const error = new Error("No hay caja abierta para cerrar.");
      error.statusCode = 400;
      throw error;
    }

    // Calcular totales
    const totalesSql = `
      SELECT 
        COALESCE(SUM(monto) FILTER (WHERE tipo = 'INGRESO' AND medio_pago = 'Efectivo'), 0) AS ingresos_efectivo,
        COALESCE(SUM(monto) FILTER (WHERE tipo = 'INGRESO' AND medio_pago != 'Efectivo'), 0) AS ingresos_digital,
        COALESCE(SUM(monto) FILTER (WHERE tipo = 'EGRESO'), 0) AS egresos
      FROM movimientos_caja
      WHERE id_apertura = $1
    `;
    const totalesResult = await client.query(totalesSql, [
      cajaAbierta.id_apertura,
    ]);
    const t = totalesResult.rows[0];

    const montoApertura = parseFloat(cajaAbierta.monto_inicial);
    const ingresosEfectivo = parseFloat(t.ingresos_efectivo);
    const ingresosDigital = parseFloat(t.ingresos_digital);
    const egresos = parseFloat(t.egresos);
    const efectivoEsperado = montoApertura + ingresosEfectivo - egresos;
    const efectivoFisico = parseFloat(data.efectivo_fisico);
    const diferencia = efectivoFisico - efectivoEsperado;
    const totalGeneral = efectivoFisico + ingresosDigital;

    // Estado del cierre
    let estado = "CUADRADO";
    if (diferencia > 0.01) estado = "SOBRANTE";
    else if (diferencia < -0.01) estado = "FALTANTE";

    // Crear cierre
    const cierreSql = `
      INSERT INTO cierres_caja (
        id_apertura, monto_apertura, total_ingresos_efectivo, total_ingresos_digital,
        total_egresos, efectivo_esperado, efectivo_fisico, diferencia, total_general,
        id_usuario_cierre, estado
      ) VALUES (
        $1::INT, $2::DECIMAL, $3::DECIMAL, $4::DECIMAL,
        $5::DECIMAL, $6::DECIMAL, $7::DECIMAL, $8::DECIMAL, $9::DECIMAL,
        $10::INT, $11::VARCHAR
      )
      RETURNING *
    `;
    const cierreResult = await client.query(cierreSql, [
      cajaAbierta.id_apertura,
      montoApertura,
      ingresosEfectivo,
      ingresosDigital,
      egresos,
      efectivoEsperado,
      efectivoFisico,
      diferencia,
      totalGeneral,
      data.id_usuario_cierre,
      estado,
    ]);

    // Actualizar estado de la caja
    await client.query(
      `UPDATE cajas SET estado = 'CERRADA' WHERE id_caja = (SELECT id_caja FROM aperturas_caja WHERE id_apertura = $1::INT)`,
      [cajaAbierta.id_apertura],
    );

    await client.query("COMMIT");
    return cierreResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Listar cierres históricos
 */
const listarCierres = async () => {
  const sql = `
    SELECT 
      cc.id_cierre,
      cc.fecha_cierre,
      cc.monto_apertura,
      cc.total_ingresos_efectivo,
      cc.total_ingresos_digital,
      cc.total_egresos,
      cc.efectivo_esperado,
      cc.efectivo_fisico,
      cc.diferencia,
      cc.total_general,
      cc.estado,
      c.nombre_caja,
      u.nombres || ' ' || u.apellidos AS usuario_cierre
    FROM cierres_caja cc
    INNER JOIN aperturas_caja ap ON ap.id_apertura = cc.id_apertura
    INNER JOIN cajas c ON c.id_caja = ap.id_caja
    LEFT JOIN usuarios u ON u.id_usuario = cc.id_usuario_cierre
    ORDER BY cc.fecha_cierre DESC
  `;
  const result = await query(sql);
  return result.rows;
};

module.exports = {
  obtenerCajaAbierta,
  listarCajas,
  listarAperturas,
  findAperturaById,
  aperturar,
  listarMovimientos,
  registrarEgreso,
  cerrar,
  listarCierres,
};
