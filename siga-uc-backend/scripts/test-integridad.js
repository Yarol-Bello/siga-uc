#!/usr/bin/env node
/**
 * Suite de integridad de SIGA-UC (SOLO LECTURA).
 *
 * Verifica invariantes de datos sobre cualquier base: local, e2e o producción.
 * No escribe nada: el pool se abre con `default_transaction_read_only=on`.
 *
 * Uso:
 *   npm run test:integridad
 *
 * Conexión: usa DATABASE_URL si existe; si no, DB_HOST/DB_PORT/DB_USER/
 * DB_PASSWORD/DB_NAME. Las credenciales nunca se imprimen.
 *
 * Códigos de salida: 0 si las 10 invariantes pasan; 1 si hay algún FAIL.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const rutaEnv = path.join(__dirname, "..", ".env");
if (fs.existsSync(rutaEnv) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rutaEnv);
}

const databaseUrl = (process.env.DATABASE_URL || "").trim();
const sslActivo =
  String(process.env.DB_SSL).toLowerCase() === "true" ||
  /[?&]sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl);

const configuracionPool = {
  options: "-c default_transaction_read_only=on",
};

let nombreBase = process.env.DB_NAME || "siga_uc";
let hostBase = process.env.DB_HOST || "localhost";

if (databaseUrl) {
  configuracionPool.connectionString = databaseUrl;
  try {
    const url = new URL(databaseUrl);
    nombreBase = url.pathname.replace(/^\//, "") || nombreBase;
    hostBase = url.hostname;
  } catch {
    // Si la URL no se puede parsear, solo se muestra el nombre lógico.
  }
} else {
  configuracionPool.host = process.env.DB_HOST || "localhost";
  configuracionPool.port = parseInt(process.env.DB_PORT, 10) || 5432;
  configuracionPool.user = process.env.DB_USER || "postgres";
  configuracionPool.password = process.env.DB_PASSWORD;
  configuracionPool.database = nombreBase;
}

if (sslActivo) {
  configuracionPool.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(configuracionPool);
const resultados = [];
const ANCHO_PRUEBA = 64;
const ANCHO_ESTADO = 9;

const TABLAS_ESPERADAS = [
  "actas_bimestrales",
  "alumnos",
  "alumnos_riesgo",
  "aperturas_caja",
  "apoderados",
  "asistencia_alumnos",
  "asistencia_personal",
  "becas",
  "bitacora_auditoria",
  "boletas_electronicas",
  "cajas",
  "calificaciones",
  "carga_curricular",
  "cierres_caja",
  "competencias",
  "conceptos_pago",
  "conclusiones_descriptivas",
  "credenciales_qr",
  "cuadro_merito",
  "cursos",
  "escala_calificacion",
  "estado_carga_docentes",
  "expediente_alumno",
  "exportaciones_siagie",
  "grados",
  "horarios",
  "libretas",
  "movimientos_caja",
  "notas_finales_area",
  "notificaciones",
  "pagos",
  "pensiones",
  "personal",
  "pre_tickets",
  "recuperacion_password",
  "resumen_asistencia_curso",
  "roles",
  "tutores_grado",
  "usuarios",
];

function registrar(numero, nombre, estado, detalle = "") {
  resultados.push({ numero, nombre, estado, detalle });
  console.log(
    `${String(numero).padEnd(3)} ${nombre.padEnd(ANCHO_PRUEBA)} ${estado.padEnd(ANCHO_ESTADO)} ${detalle}`,
  );
}

function describirError(error) {
  if (error?.code && error?.message) {
    return `${error.code}: ${error.message}`.slice(0, 220);
  }
  return String(error?.message || error).slice(0, 220);
}

async function prueba(numero, nombre, fn) {
  try {
    await fn();
  } catch (error) {
    registrar(numero, nombre, "FAIL", describirError(error));
  }
}

function formatearFilas(filas) {
  const textos = filas.map((fila) => {
    const texto = Object.entries(fila)
      .map(([clave, valor]) => `${clave}=${String(valor)}`)
      .join(", ");
    return texto.length > 110 ? `${texto.slice(0, 107)}...` : texto;
  });
  return textos.join(" | ").slice(0, 420);
}

/**
 * Ejecuta una consulta de violaciones. La consulta debe devolver como máximo
 * 5 filas y una columna `_total` con el conteo total (COUNT(*) OVER()).
 */
async function consultarViolaciones(sql, params = []) {
  const resultado = await pool.query(sql, params);

  if (resultado.rows.length === 0) {
    return { total: 0, filas: [] };
  }

  const total = Number(resultado.rows[0]._total);
  const filas = resultado.rows.map(({ _total, ...fila }) => fila);
  return { total: Number.isFinite(total) ? total : filas.length, filas };
}

async function verificarInvariante(numero, nombre, sql, params = []) {
  await prueba(numero, nombre, async () => {
    const { total, filas } = await consultarViolaciones(sql, params);

    if (total === 0) {
      registrar(numero, nombre, "PASS", "0 violaciones");
      return;
    }

    registrar(
      numero,
      nombre,
      "FAIL",
      `${total} violación(es): ${formatearFilas(filas)}`,
    );
  });
}

async function main() {
  console.log(`SIGA-UC integridad — ${nombreBase}@${hostBase}`);
  console.log("Modo: solo lectura (default_transaction_read_only=on)\n");
  console.log(
    `${"#".padEnd(3)} ${"Invariante".padEnd(ANCHO_PRUEBA)} ${"Resultado".padEnd(ANCHO_ESTADO)} Detalle`,
  );
  console.log(
    `${"-".repeat(3)} ${"-".repeat(ANCHO_PRUEBA)} ${"-".repeat(ANCHO_ESTADO)} ${"-".repeat(40)}`,
  );

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error(
      `No se pudo conectar a ${nombreBase}@${hostBase}: ${describirError(error)}`,
    );
    process.exitCode = 1;
    await pool.end();
    return;
  }

  // 1. Las 39 tablas del esquema existen.
  await verificarInvariante(
    1,
    "Las 39 tablas esperadas existen",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT t.nombre AS tabla_faltante
        FROM unnest($1::text[]) AS t(nombre)
        LEFT JOIN information_schema.tables it
          ON it.table_schema = 'public'
         AND it.table_name = t.nombre
         AND it.table_type = 'BASE TABLE'
        WHERE it.table_name IS NULL
      ) q
      ORDER BY q.tabla_faltante
      LIMIT 5
    `,
    [TABLAS_ESPERADAS],
  );

  // 2. Los índices críticos existen.
  await verificarInvariante(
    2,
    "Índices ux_pago_pension_activo y boletas_serie_numero_key",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT t.nombre AS indice_faltante
        FROM (VALUES
          ('ux_pago_pension_activo'),
          ('boletas_serie_numero_key')
        ) AS t(nombre)
        LEFT JOIN pg_indexes pi
          ON pi.schemaname = 'public'
         AND pi.indexname = t.nombre
        WHERE pi.indexname IS NULL
      ) q
      ORDER BY q.indice_faltante
      LIMIT 5
    `,
  );

  // 3. Una pensión no puede tener más de un pago PAGADO.
  await verificarInvariante(
    3,
    "Pensión con más de un pago PAGADO",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT p.id_pension, COUNT(*) AS pagos_pagados
        FROM pagos p
        WHERE p.estado = 'PAGADO' AND p.id_pension IS NOT NULL
        GROUP BY p.id_pension
        HAVING COUNT(*) > 1
      ) q
      ORDER BY q.id_pension
      LIMIT 5
    `,
  );

  // 4. Todo pago PAGADO tiene un movimiento INGRESO.
  await verificarInvariante(
    4,
    "Pago PAGADO sin movimiento INGRESO",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT p.id_pago, p.id_alumno, p.monto, p.forma_pago
        FROM pagos p
        WHERE p.estado = 'PAGADO'
          AND NOT EXISTS (
            SELECT 1 FROM movimientos_caja m
            WHERE m.id_pago = p.id_pago AND m.tipo = 'INGRESO'
          )
      ) q
      ORDER BY q.id_pago
      LIMIT 5
    `,
  );

  // 5. Todo pago ANULADO tiene su movimiento EGRESO.
  await verificarInvariante(
    5,
    "Pago ANULADO sin movimiento EGRESO",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT p.id_pago, p.id_alumno, p.monto, p.forma_pago
        FROM pagos p
        WHERE p.estado = 'ANULADO'
          AND NOT EXISTS (
            SELECT 1 FROM movimientos_caja m
            WHERE m.id_pago = p.id_pago AND m.tipo = 'EGRESO'
          )
      ) q
      ORDER BY q.id_pago
      LIMIT 5
    `,
  );

  // 6. La boleta de un pago ANULADO debe estar ANULADA.
  await verificarInvariante(
    6,
    "Boleta de pago ANULADO con estado distinto",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT b.id_boleta, b.id_pago, b.estado_sunat
        FROM boletas_electronicas b
        INNER JOIN pagos p ON p.id_pago = b.id_pago
        WHERE p.estado = 'ANULADO'
          AND b.estado_sunat IS DISTINCT FROM 'ANULADO'
      ) q
      ORDER BY q.id_boleta
      LIMIT 5
    `,
  );

  // 7. Todo usuario ACTIVO debe tener alumno o personal asociado.
  await verificarInvariante(
    7,
    "Usuario ACTIVO sin alumno ni personal",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT u.id_usuario, u.dni, u.id_rol
        FROM usuarios u
        WHERE u.estado = 'ACTIVO'
          AND NOT EXISTS (
            SELECT 1 FROM alumnos a WHERE a.id_usuario = u.id_usuario
          )
          AND NOT EXISTS (
            SELECT 1 FROM personal p WHERE p.id_usuario = u.id_usuario
          )
      ) q
      ORDER BY q.id_usuario
      LIMIT 5
    `,
  );

  // 8. Toda pensión PAGADO debe tener un pago PAGADO que la respalde.
  await verificarInvariante(
    8,
    "Pensión PAGADO sin pago que la respalde",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT pe.id_pension, pe.id_alumno, pe.anio_lectivo, pe.mes
        FROM pensiones pe
        WHERE pe.estado = 'PAGADO'
          AND NOT EXISTS (
            SELECT 1 FROM pagos p
            WHERE p.id_pension = pe.id_pension AND p.estado = 'PAGADO'
          )
      ) q
      ORDER BY q.id_pension
      LIMIT 5
    `,
  );

  // 9. Las calificaciones solo usan la escala AD/A/B/C.
  await verificarInvariante(
    9,
    "Calificación fuera de AD/A/B/C",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT c.id_calificacion, c.id_alumno, c.id_curso,
               c.bimestre, c.calificacion
        FROM calificaciones c
        WHERE c.calificacion IS NULL
           OR c.calificacion NOT IN ('AD', 'A', 'B', 'C')
      ) q
      ORDER BY q.id_calificacion
      LIMIT 5
    `,
  );

  // 10. Todo alumno Matriculado tiene un usuario ACTIVO.
  await verificarInvariante(
    10,
    "Alumno Matriculado sin usuario ACTIVO",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT a.id_alumno, a.dni, a.id_usuario, u.estado AS estado_usuario
        FROM alumnos a
        LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
        WHERE a.estado_matricula = 'Matriculado'
          AND (u.id_usuario IS NULL OR u.estado IS DISTINCT FROM 'ACTIVO')
      ) q
      ORDER BY q.id_alumno
      LIMIT 5
    `,
  );

  const pass = resultados.filter((r) => r.estado === "PASS").length;
  const fail = resultados.filter((r) => r.estado === "FAIL").length;

  console.log("");
  console.log(`${pass} PASS, ${fail} FAIL, 0 SKIP`);

  if (fail > 0) {
    console.log("Resultado: FALLO");
    process.exitCode = 1;
  } else {
    console.log("Resultado: OK");
    process.exitCode = 0;
  }

  await pool.end();
}

main().catch(async (error) => {
  console.error(`Error inesperado en la suite de integridad: ${describirError(error)}`);
  process.exitCode = 1;
  try {
    await pool.end();
  } catch {
    // El pool ya estaba cerrado.
  }
});
