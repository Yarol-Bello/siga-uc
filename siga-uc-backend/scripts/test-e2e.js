#!/usr/bin/env node
/**
 * Suite E2E de SIGA-UC sobre una base DESECHABLE.
 *
 * Seguridad:
 *  - Solo opera sobre una base cuyo nombre contenga "_e2e" (por defecto
 *    siga_uc_e2e). Nunca toca siga_uc ni una base de Supabase.
 *  - Crea la base, carga el dump y las migraciones, arranca el backend en el
 *    puerto 3101, ejecuta 75 flujos y al final detiene el backend y elimina la
 *    base con dropdb --force.
 *  - Si la limpieza falla, imprime los comandos manuales.
 *
 * Uso:
 *   npm run test:e2e
 *
 * Requiere las credenciales del seed en SMOKE_* (el .env local ya las tiene).
 * Nunca imprime tokens, contraseñas ni claves temporales de alumnos.
 *
 * Códigos de salida: 0 si todas las pruebas pasan y la limpieza es correcta;
 * 1 si hay algún FAIL, falla la preparación o falla la limpieza.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { Pool } = require("pg");
const ExcelJS = require("exceljs");

const rutaEnv = path.join(__dirname, "..", ".env");
if (fs.existsSync(rutaEnv) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rutaEnv);
}

const RAIZ_REPO = path.join(__dirname, "..", "..");
const DIR_BACKEND = path.join(__dirname, "..");
const SQL_COMPLETO = path.join(RAIZ_REPO, "database", "siga_uc_completo.sql");
const MIGRACIONES = [
  path.join(RAIZ_REPO, "database", "migracion_h32_anulacion_pagos.sql"),
  path.join(RAIZ_REPO, "database", "migracion_h10_h38_concurrencia_pagos.sql"),
  path.join(RAIZ_REPO, "database", "migracion_h07_auditoria.sql"),
  path.join(RAIZ_REPO, "database", "migracion_h45_pensiones_anuladas.sql"),
  path.join(RAIZ_REPO, "database", "migracion_h47_horarios.sql"),
  path.join(RAIZ_REPO, "database", "migracion_h48_actas.sql"),
  path.join(RAIZ_REPO, "database", "migracion_h61_dia_semana.sql"),
  path.join(RAIZ_REPO, "database", "migracion_h49_multianio_base.sql"),
  path.join(RAIZ_REPO, "database", "migracion_h73_promociones.sql"),
  path.join(
    RAIZ_REPO,
    "database",
    "migracion_h59_observaciones_personal.sql",
  ),
  path.join(
    RAIZ_REPO,
    "database",
    "migracion_h71_retirados_historicos.sql",
  ),
];

const PUERTO = 3101;
const BASE_URL = `http://localhost:${PUERTO}/api`;
const DB_NAME = (process.env.E2E_DB_NAME || "siga_uc_e2e").trim();
const DB_HOST = (process.env.DB_HOST || "localhost").trim();
const DB_PORT = String(process.env.DB_PORT || "5432").trim();
const DB_USER = (process.env.DB_USER || "postgres").trim();
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_APP = (process.env.DB_NAME || "siga_uc").trim();
const ANIO = Number(process.env.ANIO_LECTIVO) || 2026;
const ANIO_DESTINO = ANIO + 1;
const DNI_ALUMNO_1 = "99999001";
const DNI_ALUMNO_2 = "99999002";
const DNI_APODERADO = "99999011";

let pool = null;
let backend = null;
let baseCreada = false;
let seCreoBase = false;
let seArrancoBackend = false;
let cabeceraImpresa = false;
let backendSalida = "";
const logsBackend = [];
const resultados = [];
const ctx = {
  adminToken: null,
  adminId: null,
  alumno1Id: null,
  alumno2Id: null,
  alumno2IdDestino: null,
  idGradoDestino: null,
  pagoMatriculaId: null,
  pagoPensionId: null,
  idPension: null,
  idConceptoPension: null,
  idConceptoCaja50: null,
  idConceptoCaja80: null,
};

const ANCHO_PRUEBA = 82;
const ANCHO_ESTADO = 9;

function abortar(mensaje) {
  console.error(`ABORTADO: ${mensaje}`);
  process.exit(1);
}

// ============================================================
// GUARDAS DE SEGURIDAD (antes de tocar cualquier base)
// ============================================================
if (!DB_NAME.includes("_e2e")) {
  abortar(
    `DB_NAME debe contener "_e2e" para usar una base desechable. Recibido: "${DB_NAME}".`,
  );
}
if (!/^[a-z][a-z0-9_]*$/.test(DB_NAME)) {
  abortar(`DB_NAME inválido: "${DB_NAME}". Use solo minúsculas, números y "_".`);
}
if (DB_NAME === DB_APP) {
  abortar(
    `La base E2E no puede ser la base de la aplicación ("${DB_APP}"). Use E2E_DB_NAME.`,
  );
}
if (/supabase/i.test(DB_HOST) || /supabase/i.test(process.env.DATABASE_URL || "")) {
  abortar("No se permite ejecutar la suite E2E contra Supabase.");
}
if (!DB_PASSWORD) {
  abortar("Falta DB_PASSWORD en el entorno/.env.");
}
for (const archivo of [SQL_COMPLETO, ...MIGRACIONES]) {
  if (!fs.existsSync(archivo)) {
    abortar(`No existe el archivo SQL requerido: ${archivo}`);
  }
}
const credenciales = {
  ADMIN: [process.env.SMOKE_ADMIN_DNI, process.env.SMOKE_ADMIN_PASSWORD],
  DOCENTE: [process.env.SMOKE_DOCENTE_DNI, process.env.SMOKE_DOCENTE_PASSWORD],
  ESTUDIANTE: [
    process.env.SMOKE_ESTUDIANTE_DNI,
    process.env.SMOKE_ESTUDIANTE_PASSWORD,
  ],
};
for (const [rol, [dni, password]] of Object.entries(credenciales)) {
  if (!dni || !password) {
    abortar(`Faltan SMOKE_${rol}_DNI / SMOKE_${rol}_PASSWORD en el .env.`);
  }
}

const entornoPg = {
  ...process.env,
  PGPASSWORD: DB_PASSWORD,
  PGCLIENTENCODING: "UTF8",
};
delete entornoPg.DATABASE_URL;

const entornoBackend = {
  ...process.env,
  PORT: String(PUERTO),
  DB_NAME,
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_SSL: "false",
  JWT_SECRET: "e2e-siga-uc-secret-2026-solo-para-pruebas-locales",
  NODE_ENV: "test",
  TZ: "America/Lima",
  ANIO_LECTIVO: String(ANIO),
  RESEND_API_KEY: "re_test_no_enviar",
};
delete entornoBackend.DATABASE_URL;

const argsConexion = [
  "-h",
  DB_HOST,
  "-p",
  DB_PORT,
  "-U",
  DB_USER,
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ejecutar(comando, args, etiqueta) {
  try {
    return execFileSync(comando, args, {
      env: entornoPg,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    const salida = `${error.stdout || ""}\n${error.stderr || ""}`.trim();
    throw new Error(
      `${etiqueta} falló: ${(salida || error.message || "error desconocido").slice(-1600)}`,
    );
  }
}

function registrar(numero, nombre, estado, detalle = "") {
  resultados.push({ numero, nombre, estado, detalle });
  console.log(
    `${String(numero).padEnd(3)} ${nombre.padEnd(ANCHO_PRUEBA)} ${estado.padEnd(ANCHO_ESTADO)} ${detalle}`,
  );
}

function describirError(error) {
  if (error?.code && error?.message) {
    return `${error.code}: ${error.message}`.slice(0, 240);
  }
  return String(error?.message || error).slice(0, 240);
}

async function prueba(numero, nombre, fn) {
  try {
    await fn();
  } catch (error) {
    registrar(numero, nombre, "FAIL", describirError(error));
  }
}

function imprimirCabeceraTabla() {
  if (cabeceraImpresa) return;
  cabeceraImpresa = true;
  console.log(
    `${"#".padEnd(3)} ${"Prueba".padEnd(ANCHO_PRUEBA)} ${"Resultado".padEnd(ANCHO_ESTADO)} Detalle`,
  );
  console.log(
    `${"-".repeat(3)} ${"-".repeat(ANCHO_PRUEBA)} ${"-".repeat(ANCHO_ESTADO)} ${"-".repeat(40)}`,
  );
}

function guardarLog(bloque) {
  for (const linea of String(bloque).split(/\r?\n/)) {
    if (!linea.trim()) continue;
    logsBackend.push(linea);
    if (logsBackend.length > 400) logsBackend.shift();
  }
}

function imprimirLogsBackend() {
  if (logsBackend.length === 0) return;
  console.error("\nÚltimas líneas del backend E2E:");
  for (const linea of logsBackend.slice(-40)) {
    console.error(`  ${linea}`);
  }
}

// ============================================================
// HTTP
// ============================================================
async function api(ruta, opciones = {}) {
  const {
    method = "GET",
    token = null,
    body = undefined,
    accept = "application/json",
  } = opciones;

  const headers = { Accept: accept };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  return fetch(`${BASE_URL}${ruta}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
}

async function leerJson(respuesta) {
  const texto = await respuesta.text();
  try {
    return { datos: JSON.parse(texto), texto };
  } catch {
    return { datos: null, texto };
  }
}

function detalleHttp(respuesta, datos) {
  const mensaje = datos?.message ? `: ${String(datos.message).slice(0, 160)}` : "";
  return `HTTP ${respuesta.status}${mensaje}`;
}

async function iniciarSesion(rol, dni, password) {
  const respuesta = await api("/auth/login", {
    method: "POST",
    body: { dni, password },
  });
  const { datos } = await leerJson(respuesta);

  assert.equal(
    respuesta.status,
    200,
    `Login ${rol} falló (${detalleHttp(respuesta, datos)})`,
  );
  assert.ok(datos?.data?.token, `Login ${rol} no devolvió token`);

  return { token: datos.data.token, usuario: datos.data.usuario };
}

async function crearAlumno(dni, nombres, apellidos, extra = {}) {
  const respuesta = await api("/alumnos", {
    method: "POST",
    token: ctx.adminToken,
    body: {
      dni,
      nombres,
      apellidos,
      fecha_nacimiento: "2012-05-10",
      id_grado: 1,
      ...extra,
    },
  });
  const { datos } = await leerJson(respuesta);

  assert.equal(
    respuesta.status,
    201,
    `Crear alumno ${dni} falló (${detalleHttp(respuesta, datos)})`,
  );
  assert.ok(datos?.data?.id_alumno, "La creación del alumno no devolvió id_alumno");

  return datos.data;
}

async function verificarPdf(ruta, token) {
  const respuesta = await api(ruta, { token, accept: "application/pdf" });
  const tipo = respuesta.headers.get("content-type") || "";
  const buffer = Buffer.from(await respuesta.arrayBuffer());

  assert.equal(respuesta.status, 200, `PDF ${ruta} respondió HTTP ${respuesta.status}`);
  assert.ok(
    tipo.includes("application/pdf"),
    `PDF ${ruta} tiene Content-Type inesperado: ${tipo || "ausente"}`,
  );
  assert.equal(
    buffer.subarray(0, 4).toString("ascii"),
    "%PDF",
    `PDF ${ruta} no tiene firma %PDF`,
  );

  return buffer.length;
}

async function sql(texto, params = []) {
  const resultado = await pool.query(texto, params);
  return resultado.rows;
}

async function saldoCajaAbierta() {
  const filas = await sql(`
    SELECT COALESCE(SUM(
      CASE
        WHEN m.tipo = 'INGRESO' THEN m.monto
        WHEN m.tipo = 'EGRESO' THEN -m.monto
        ELSE 0
      END
    ), 0)::numeric AS saldo
    FROM movimientos_caja m
    INNER JOIN aperturas_caja ap ON ap.id_apertura = m.id_apertura
    WHERE NOT EXISTS (
      SELECT 1 FROM cierres_caja cc WHERE cc.id_apertura = ap.id_apertura
    )
  `);
  return Number(filas[0]?.saldo || 0);
}

async function resetCajaParaPrueba() {
  await sql("DELETE FROM cierres_caja");
  await sql("DELETE FROM movimientos_caja");
  await sql("DELETE FROM aperturas_caja");
  await sql("UPDATE cajas SET estado = 'CERRADA'");
}

async function abrirCajaPrueba(montoInicial) {
  const respuesta = await api("/caja/aperturar", {
    method: "POST",
    token: ctx.adminToken,
    body: {
      id_caja: 1,
      monto_inicial: montoInicial,
      observaciones: "Apertura de prueba H50",
    },
  });
  const { datos } = await leerJson(respuesta);
  assert.equal(
    respuesta.status,
    201,
    `Aperturar caja falló (${detalleHttp(respuesta, datos)})`,
  );
  assert.ok(datos?.data?.id_apertura, "La apertura no devolvió id_apertura");
  return datos.data;
}

async function crearConceptoPrueba(nombre, monto) {
  const filas = await sql(
    `INSERT INTO conceptos_pago (nombre, monto_base, tipo, mes, anio_lectivo)
     VALUES ($1, $2, 'OTROS', NULL, $3)
     RETURNING id_concepto`,
    [nombre, monto, ANIO],
  );
  return filas[0].id_concepto;
}

async function pagarConceptoPrueba(idConcepto, monto, formaPago, nroOperacion = null) {
  const body = {
    id_alumno: ctx.alumno2Id,
    id_concepto: idConcepto,
    monto,
    forma_pago: formaPago,
  };
  if (nroOperacion) body.nro_operacion = nroOperacion;

  const respuesta = await api("/tesoreria/pagos", {
    method: "POST",
    token: ctx.adminToken,
    body,
  });
  const { datos } = await leerJson(respuesta);
  assert.equal(
    respuesta.status,
    201,
    `Pago ${formaPago} de S/ ${monto} falló (${detalleHttp(respuesta, datos)})`,
  );
  assert.ok(datos?.data?.pago?.id_pago, "El pago no devolvió id_pago");
  return datos.data.pago;
}

// ============================================================
// PREPARACIÓN Y LIMPIEZA
// ============================================================
function prepararBase() {
  console.log("Limpiando restos de una ejecución anterior...");
  ejecutar(
    "dropdb",
    [...argsConexion, "--if-exists", "--force", DB_NAME],
    "dropdb inicial",
  );

  console.log("Creando base y cargando esquema/datos...");
  ejecutar("createdb", [...argsConexion, DB_NAME], "createdb");
  baseCreada = true;
  seCreoBase = true;

  const archivos = [SQL_COMPLETO, ...MIGRACIONES];
  for (const archivo of archivos) {
    console.log(`  - ${path.basename(archivo)}`);
    ejecutar(
      "psql",
      [
        ...argsConexion,
        "-d",
        DB_NAME,
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        archivo,
      ],
      `psql ${path.basename(archivo)}`,
    );
  }
}

async function puertoOcupado() {
  try {
    await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

async function iniciarBackend() {
  if (await puertoOcupado()) {
    throw new Error(
      `El puerto ${PUERTO} ya está ocupado. Detenga el proceso y vuelva a intentar.`,
    );
  }

  console.log(`Arrancando backend en el puerto ${PUERTO}...`);
  backend = spawn(process.execPath, ["src/app.js"], {
    cwd: DIR_BACKEND,
    env: entornoBackend,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  seArrancoBackend = true;

  backend.stdout.on("data", guardarLog);
  backend.stderr.on("data", guardarLog);
  backend.on("exit", (codigo, senal) => {
    backendSalida = `código ${codigo ?? "null"}${senal ? `, señal ${senal}` : ""}`;
  });
}

async function esperarHealth() {
  const limite = Date.now() + 30_000;

  while (Date.now() < limite) {
    if (backend.exitCode !== null) {
      throw new Error(`El backend terminó antes de estar listo (${backendSalida})`);
    }

    try {
      const respuesta = await fetch(`${BASE_URL}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (respuesta.ok) {
        const datos = await respuesta.json();
        if (datos?.data?.database === "ok") return;
      }
    } catch {
      // El backend todavía no escucha; se reintenta.
    }

    await delay(300);
  }

  throw new Error("Timeout de 30 s esperando /api/health con database=ok");
}

async function detenerBackend() {
  if (!backend || backend.exitCode !== null) return true;

  try {
    if (process.platform === "win32") {
      ejecutar(
        "taskkill",
        ["/PID", String(backend.pid), "/T", "/F"],
        "taskkill",
      );
    } else {
      backend.kill("SIGTERM");
    }
  } catch {
    // Se intenta el kill directo más abajo.
  }

  await Promise.race([
    new Promise((resolve) => backend.once("exit", resolve)),
    delay(5000),
  ]);

  if (backend.exitCode === null) {
    try {
      backend.kill("SIGKILL");
    } catch {
      // Sin más acciones posibles.
    }
    await delay(1000);
  }

  return backend.exitCode !== null;
}

async function limpiar() {
  let ok = true;

  try {
    if (!(await detenerBackend())) {
      ok = false;
    }
  } catch {
    ok = false;
  }

  if (pool) {
    try {
      await pool.end();
    } catch {
      ok = false;
    }
  }

  if (baseCreada) {
    let eliminada = false;
    let ultimoError = null;

    for (let intento = 1; intento <= 3 && !eliminada; intento += 1) {
      try {
        ejecutar(
          "dropdb",
          [...argsConexion, "--if-exists", "--force", DB_NAME],
          "dropdb final",
        );
        eliminada = true;
      } catch (error) {
        ultimoError = error;
        await delay(500);
      }
    }

    if (eliminada) {
      baseCreada = false;
    } else {
      ok = false;
      if (ultimoError) {
        console.error(`No se pudo eliminar ${DB_NAME}: ${describirError(ultimoError)}`);
      }
    }
  }

  return ok;
}

function imprimirLimpiezaManual() {
  console.error("\nLIMPIEZA MANUAL REQUERIDA:");
  if (backend?.pid) {
    if (process.platform === "win32") {
      console.error(`  taskkill /PID ${backend.pid} /T /F`);
    } else {
      console.error(`  kill -9 ${backend.pid}`);
    }
  }
  console.error(
    `  dropdb --force -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} ${DB_NAME}`,
  );
  console.error("  Defina PGPASSWORD en la sesión antes de ejecutar dropdb.");
}

// ============================================================
// PRUEBAS
// ============================================================
async function ejecutarPruebas() {
  // 1. Health.
  await prueba(1, "Health 200 con database ok", async () => {
    const respuesta = await api("/health");
    const { datos } = await leerJson(respuesta);
    assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
    assert.equal(datos?.data?.database, "ok", "database distinto de ok");
    registrar(1, "Health 200 con database ok", "PASS", "200, database=ok");
  });

  // 2. Login ADMIN.
  await prueba(2, "Login ADMIN del seed", async () => {
    const sesion = await iniciarSesion(
      "ADMIN",
      credenciales.ADMIN[0],
      credenciales.ADMIN[1],
    );
    assert.equal(sesion.usuario?.rol, "ADMIN", "El usuario no tiene rol ADMIN");
    ctx.adminToken = sesion.token;
    ctx.adminId = sesion.usuario?.id_usuario;
    registrar(2, "Login ADMIN del seed", "PASS", "200, rol ADMIN");
  });

  // 3. Alta de alumno con apoderado.
  await prueba(3, "Crear alumno con apoderado (alumno, usuario, expediente, QR)", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    const data = await crearAlumno(DNI_ALUMNO_1, "E2E Uno", "Prueba", {
      correo_personal: "e2e.alumno1@example.com",
      apoderado: {
        nombres: "Apoderado",
        apellidos: "E2E",
        dni: DNI_APODERADO,
        telefono: "999999999",
        correo: "e2e.apoderado@example.com",
      },
    });
    ctx.alumno1Id = data.id_alumno;

    const filas = await sql(
      `
        SELECT a.id_alumno, a.estado_matricula, a.id_usuario, a.id_apoderado,
               u.estado AS estado_usuario, e.id_expediente, e.congelado,
               q.id_credencial, q.codigo_qr, q.tipo AS tipo_qr
        FROM alumnos a
        INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
        LEFT JOIN expediente_alumno e ON e.id_alumno = a.id_alumno
        LEFT JOIN credenciales_qr q ON q.id_usuario = a.id_usuario
        WHERE a.id_alumno = $1
      `,
      [ctx.alumno1Id],
    );
    const fila = filas[0];
    assert.ok(fila, "No se encontró el alumno creado");
    assert.equal(fila.estado_matricula, "PendientePago");
    assert.equal(fila.estado_usuario, "ACTIVO");
    assert.ok(fila.id_apoderado, "No se creó el apoderado");
    assert.ok(fila.id_expediente, "No se creó el expediente");
    assert.equal(fila.congelado, false);
    assert.ok(fila.id_credencial && fila.codigo_qr, "No se creó el QR");
    assert.equal(fila.tipo_qr, "ESTUDIANTE", "El QR no es de tipo ESTUDIANTE");

    const apoderados = await sql(
      "SELECT nombres, apellidos, dni FROM apoderados WHERE id_apoderado = $1",
      [fila.id_apoderado],
    );
    assert.equal(apoderados[0]?.dni, DNI_APODERADO, "El apoderado no se guardó correctamente");

    registrar(
      3,
      "Crear alumno con apoderado (alumno, usuario, expediente, QR)",
      "PASS",
      "alumno/usuario/expediente/QR OK, PendientePago",
    );
  });

  // 4. Retiro del alumno.
  await prueba(4, "Retirar alumno (Retirado, usuario INACTIVO, expediente congelado, login 403)", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    assert.ok(ctx.alumno1Id, "No hay alumno para retirar");

    const respuesta = await api(`/alumnos/${ctx.alumno1Id}/retirar`, {
      method: "PUT",
      token: ctx.adminToken,
      body: {
        motivo_retiro: "Retiro de prueba E2E",
        colegio_destino: "Colegio E2E",
        resolucion_directoral: "RD-E2E-001",
      },
    });
    const { datos } = await leerJson(respuesta);
    assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));

    const filas = await sql(
      `
        SELECT a.estado_matricula, u.estado AS estado_usuario, e.congelado
        FROM alumnos a
        INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
        LEFT JOIN expediente_alumno e ON e.id_alumno = a.id_alumno
        WHERE a.id_alumno = $1
      `,
      [ctx.alumno1Id],
    );
    const fila = filas[0];
    assert.equal(fila.estado_matricula, "Retirado");
    assert.equal(fila.estado_usuario, "INACTIVO");
    assert.equal(fila.congelado, true);

    const login = await api("/auth/login", {
      method: "POST",
      body: { dni: DNI_ALUMNO_1, password: DNI_ALUMNO_1 },
    });
    await leerJson(login);
    assert.equal(
      login.status,
      403,
      `El login del alumno retirado debía ser 403 y fue ${login.status}`,
    );

    registrar(
      4,
      "Retirar alumno (Retirado, usuario INACTIVO, expediente congelado, login 403)",
      "PASS",
      "Retirado, usuario INACTIVO, expediente congelado, login 403",
    );
  });

  // 5. Segundo alumno + pago de matrícula.
  await prueba(5, "Pago de matrícula (pago, boleta, INGRESO, Matriculado)", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");

    const cajaActual = await api("/caja/actual", { token: ctx.adminToken });
    const cajaDatos = await leerJson(cajaActual);
    if (
      cajaActual.status !== 200 ||
      !cajaDatos.datos?.data?.id_apertura
    ) {
      const apertura = await api("/caja/aperturar", {
        method: "POST",
        token: ctx.adminToken,
        body: {
          id_caja: 1,
          monto_inicial: 100,
          observaciones: "Apertura E2E",
        },
      });
      const aperturaDatos = await leerJson(apertura);
      assert.equal(
        apertura.status,
        201,
        `No se pudo aperturar caja (${detalleHttp(apertura, aperturaDatos)})`,
      );
    }

    const alumno = await crearAlumno(DNI_ALUMNO_2, "E2E Dos", "Prueba", {
      correo_personal: "e2e.alumno2@example.com",
    });
    ctx.alumno2Id = alumno.id_alumno;

    const conceptos = await sql(
      `
        SELECT id_concepto, monto_base
        FROM conceptos_pago
        WHERE tipo = 'MATRICULA' AND anio_lectivo = $1
        ORDER BY id_concepto
        LIMIT 1
      `,
      [ANIO],
    );
    assert.ok(conceptos[0], `No hay concepto de matrícula para ${ANIO}`);
    const concepto = conceptos[0];

    const respuesta = await api("/tesoreria/pagos", {
      method: "POST",
      token: ctx.adminToken,
      body: {
        id_alumno: ctx.alumno2Id,
        id_concepto: concepto.id_concepto,
        monto: Number(concepto.monto_base),
        forma_pago: "Efectivo",
      },
    });
    const { datos } = await leerJson(respuesta);
    assert.equal(
      respuesta.status,
      201,
      `Pago de matrícula falló (${detalleHttp(respuesta, datos)})`,
    );
    assert.ok(datos?.data?.pago?.id_pago, "El pago no devolvió id_pago");
    assert.ok(datos?.data?.boleta?.id_boleta, "El pago no devolvió boleta");
    ctx.pagoMatriculaId = datos.data.pago.id_pago;

    const pagos = await sql(
      "SELECT estado, id_preticket FROM pagos WHERE id_pago = $1",
      [ctx.pagoMatriculaId],
    );
    const boletas = await sql(
      "SELECT estado_sunat, monto_total FROM boletas_electronicas WHERE id_pago = $1",
      [ctx.pagoMatriculaId],
    );
    const movimientos = await sql(
      `SELECT tipo, monto, medio_pago
       FROM movimientos_caja
       WHERE id_pago = $1 AND tipo = 'INGRESO'`,
      [ctx.pagoMatriculaId],
    );
    const alumnos = await sql(
      "SELECT estado_matricula FROM alumnos WHERE id_alumno = $1",
      [ctx.alumno2Id],
    );

    assert.equal(pagos[0]?.estado, "PAGADO");
    assert.equal(boletas[0]?.estado_sunat, "ACEPTADO");
    assert.equal(movimientos.length, 1);
    assert.equal(Number(movimientos[0].monto), Number(concepto.monto_base));
    assert.equal(movimientos[0].medio_pago, "Efectivo");
    assert.equal(alumnos[0]?.estado_matricula, "Matriculado");

    registrar(
      5,
      "Pago de matrícula (pago, boleta, INGRESO, Matriculado)",
      "PASS",
      `pago #${ctx.pagoMatriculaId}, boleta ACEPTADO, INGRESO, Matriculado`,
    );
  });

  // 6. Pensión: primer pago y segundo intento bloqueado.
  await prueba(6, "Segundo pago de la misma pensión (400/409, sin duplicado)", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    assert.ok(ctx.alumno2Id, "No hay segundo alumno");

    const pensiones = await sql(
      `
        INSERT INTO pensiones (
          id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado
        ) VALUES ($1, $2, 3, 250, 0, 250, 'PENDIENTE')
        ON CONFLICT (id_alumno, anio_lectivo, mes)
        DO UPDATE SET
          monto_base = EXCLUDED.monto_base,
          descuento = 0,
          monto_final = EXCLUDED.monto_final,
          estado = 'PENDIENTE'
        RETURNING id_pension
      `,
      [ctx.alumno2Id, ANIO],
    );
    ctx.idPension = pensiones[0].id_pension;

    const conceptos = await sql(
      `
        SELECT id_concepto
        FROM conceptos_pago
        WHERE tipo = 'PENSION' AND mes = 3 AND anio_lectivo = $1
        ORDER BY id_concepto
        LIMIT 1
      `,
      [ANIO],
    );
    assert.ok(conceptos[0], `No hay concepto de pensión de marzo ${ANIO}`);
    ctx.idConceptoPension = conceptos[0].id_concepto;

    const saldoAntes = await saldoCajaAbierta();
    const cuerpo = {
      id_alumno: ctx.alumno2Id,
      id_concepto: ctx.idConceptoPension,
      id_pension: ctx.idPension,
      monto: 250,
      forma_pago: "Efectivo",
    };

    const primerPago = await api("/tesoreria/pagos", {
      method: "POST",
      token: ctx.adminToken,
      body: cuerpo,
    });
    const primerDatos = await leerJson(primerPago);
    assert.equal(
      primerPago.status,
      201,
      `Primer pago de pensión falló (${detalleHttp(primerPago, primerDatos)})`,
    );
    ctx.pagoPensionId = primerDatos.datos.data.pago.id_pago;

    const saldoDespues = await saldoCajaAbierta();
    assert.ok(
      Math.abs(saldoDespues - saldoAntes - 250) < 0.001,
      `El saldo de caja no subió S/ 250 (antes ${saldoAntes}, después ${saldoDespues})`,
    );

    const segundoPago = await api("/tesoreria/pagos", {
      method: "POST",
      token: ctx.adminToken,
      body: cuerpo,
    });
    const segundoDatos = await leerJson(segundoPago);
    assert.ok(
      [400, 409].includes(segundoPago.status),
      `El segundo pago debía ser 400/409 y fue ${detalleHttp(segundoPago, segundoDatos)}`,
    );

    const conteo = await sql(
      "SELECT COUNT(*)::int AS total FROM pagos WHERE id_pension = $1",
      [ctx.idPension],
    );
    assert.equal(conteo[0].total, 1, "Se registró más de un pago para la pensión");

    registrar(
      6,
      "Segundo pago de la misma pensión (400/409, sin duplicado)",
      "PASS",
      `segundo intento HTTP ${segundoPago.status}, 1 pago`,
    );
  });

  // 7. Anulación del pago de pensión.
  await prueba(7, "Anular pago (ANULADO, boleta ANULADA, pensión PENDIENTE, EGRESO)", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    assert.ok(ctx.pagoPensionId, "No hay pago de pensión");

    const saldoAntes = await saldoCajaAbierta();
    const respuesta = await api(
      `/tesoreria/pagos/${ctx.pagoPensionId}/anular`,
      {
        method: "PUT",
        token: ctx.adminToken,
        body: { motivo: "Anulación E2E de pensión" },
      },
    );
    const { datos } = await leerJson(respuesta);
    assert.equal(
      respuesta.status,
      200,
      `Anulación falló (${detalleHttp(respuesta, datos)})`,
    );

    const pagos = await sql(
      "SELECT estado FROM pagos WHERE id_pago = $1",
      [ctx.pagoPensionId],
    );
    const boletas = await sql(
      "SELECT estado_sunat FROM boletas_electronicas WHERE id_pago = $1",
      [ctx.pagoPensionId],
    );
    const pensiones = await sql(
      "SELECT estado FROM pensiones WHERE id_pension = $1",
      [ctx.idPension],
    );
    const movimientos = await sql(
      `SELECT tipo, monto, medio_pago
       FROM movimientos_caja
       WHERE id_pago = $1
       ORDER BY id_movimiento`,
      [ctx.pagoPensionId],
    );
    const saldoDespues = await saldoCajaAbierta();

    const egreso = movimientos.find((m) => m.tipo === "EGRESO");
    assert.equal(pagos[0]?.estado, "ANULADO");
    assert.equal(boletas[0]?.estado_sunat, "ANULADO");
    assert.equal(pensiones[0]?.estado, "PENDIENTE");
    assert.ok(egreso, "No se creó el EGRESO de anulación");
    assert.equal(Number(egreso.monto), 250);
    assert.equal(egreso.medio_pago, "Efectivo");
    assert.ok(
      Math.abs(saldoAntes - 250 - saldoDespues) < 0.001,
      `El saldo no bajó S/ 250 (antes ${saldoAntes}, después ${saldoDespues})`,
    );

    registrar(
      7,
      "Anular pago (ANULADO, boleta ANULADA, pensión PENDIENTE, EGRESO)",
      "PASS",
      "ANULADO, boleta ANULADA, pensión PENDIENTE, EGRESO Efectivo, saldo -250",
    );
  });

  // 8. Doble anulación.
  await prueba(8, "Doble anulación (409 y un solo EGRESO)", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    assert.ok(ctx.pagoPensionId, "No hay pago de pensión");

    const respuesta = await api(
      `/tesoreria/pagos/${ctx.pagoPensionId}/anular`,
      {
        method: "PUT",
        token: ctx.adminToken,
        body: { motivo: "Segunda anulación E2E" },
      },
    );
    const { datos } = await leerJson(respuesta);
    assert.equal(
      respuesta.status,
      409,
      `La segunda anulación debía ser 409 y fue ${detalleHttp(respuesta, datos)}`,
    );

    const egresos = await sql(
      `SELECT COUNT(*)::int AS total
       FROM movimientos_caja
       WHERE id_pago = $1 AND tipo = 'EGRESO'`,
      [ctx.pagoPensionId],
    );
    assert.equal(egresos[0].total, 1, "Hay más de un EGRESO para el pago anulado");

    registrar(
      8,
      "Doble anulación (409 y un solo EGRESO)",
      "PASS",
      "409, 1 EGRESO",
    );
  });

  // 9. Calificación individual + nota final + auditoría.
  await prueba(9, "Guardar calificación (nota final y auditoría con usuario)", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    assert.ok(ctx.alumno2Id, "No hay segundo alumno");

    const competencias = await sql(
      `SELECT id_competencia
       FROM competencias
       WHERE id_curso = 1
       ORDER BY id_competencia
       LIMIT 1`,
    );
    assert.ok(competencias[0], "No hay competencias para el curso 1");
    const idCompetencia = competencias[0].id_competencia;

    const respuesta = await api("/calificaciones", {
      method: "POST",
      token: ctx.adminToken,
      body: {
        id_alumno: ctx.alumno2Id,
        id_curso: 1,
        id_competencia: idCompetencia,
        id_grado: 1,
        bimestre: 3,
        anio_lectivo: ANIO,
        calificacion: "AD",
      },
    });
    const { datos } = await leerJson(respuesta);
    assert.equal(
      respuesta.status,
      201,
      `Guardar calificación falló (${detalleHttp(respuesta, datos)})`,
    );

    const notas = await sql(
      `SELECT nota_final
       FROM notas_finales_area
       WHERE id_alumno = $1 AND id_curso = 1
         AND bimestre = 3 AND anio_lectivo = $2`,
      [ctx.alumno2Id, ANIO],
    );
    assert.ok(notas[0]?.nota_final, "No se guardó la nota final");
    assert.ok(
      ["AD", "A", "B", "C"].includes(notas[0].nota_final),
      `Nota final inválida: ${notas[0].nota_final}`,
    );

    const esperadas = await sql(
      "SELECT public.calcular_nota_final_area($1, $2, $3, $4) AS nota",
      [ctx.alumno2Id, 1, 1, ANIO],
    );
    assert.equal(notas[0].nota_final, esperadas[0]?.nota);

    const auditoria = await sql(
      `SELECT id_usuario, accion
       FROM bitacora_auditoria
       WHERE modulo_afectado = 'Evaluaciones'
         AND descripcion LIKE '%' || $1::text || '%'
       ORDER BY id_bitacora DESC
       LIMIT 1`,
      [ctx.alumno2Id],
    );
    assert.ok(auditoria[0], "No se encontró la fila de auditoría de la calificación");
    assert.ok(auditoria[0].id_usuario, "La auditoría de la calificación no tiene id_usuario");
    assert.equal(
      auditoria[0].id_usuario,
      ctx.adminId,
      "La auditoría no registró al usuario que guardó la calificación",
    );

    registrar(
      9,
      "Guardar calificación (nota final y auditoría con usuario)",
      "PASS",
      `nota_final=${notas[0].nota_final}, auditoría con id_usuario`,
    );
  });

  // 10. Guardado masivo con una fila inválida.
  await prueba(10, "Guardado masivo con 1 fila inválida (2 guardadas, 1 error)", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    assert.ok(ctx.alumno2Id, "No hay segundo alumno");

    const respuesta = await api("/calificaciones/masivo", {
      method: "POST",
      token: ctx.adminToken,
      body: {
        registros: [
          {
            id_alumno: ctx.alumno2Id,
            id_curso: 1,
            id_competencia: 1,
            id_grado: 1,
            bimestre: 3,
            anio_lectivo: ANIO,
            calificacion: "A",
          },
          {
            id_alumno: ctx.alumno2Id,
            id_curso: 1,
            id_competencia: 2,
            id_grado: 1,
            bimestre: 3,
            anio_lectivo: ANIO,
            calificacion: "B",
          },
          {
            id_alumno: ctx.alumno2Id,
            id_curso: 1,
            id_competencia: 3,
            id_grado: 1,
            bimestre: 3,
            anio_lectivo: ANIO,
            calificacion: "X",
          },
        ],
      },
    });
    const { datos } = await leerJson(respuesta);
    assert.equal(
      respuesta.status,
      201,
      `Guardado masivo falló (${detalleHttp(respuesta, datos)})`,
    );
    assert.equal(datos?.data?.guardados, 2, "Se esperaban 2 calificaciones guardadas");
    assert.equal(datos?.data?.total_errores, 1, "Se esperaba 1 error");
    assert.equal(datos?.data?.errores?.length, 1, "No se devolvió el detalle del error");

    const conteo = await sql(
      `SELECT COUNT(*)::int AS total
       FROM calificaciones
       WHERE id_alumno = $1 AND id_curso = 1
         AND bimestre = 3 AND anio_lectivo = $2`,
      [ctx.alumno2Id, ANIO],
    );
    assert.equal(conteo[0].total, 2, "La fila inválida se guardó o faltó una válida");

    registrar(
      10,
      "Guardado masivo con 1 fila inválida (2 guardadas, 1 error)",
      "PASS",
      "guardados=2, total_errores=1",
    );
  });

  // 11. PDFs de libreta y boleta.
  await prueba(11, "Descargar libreta y boleta PDF (200, application/pdf, %PDF)", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    assert.ok(ctx.alumno2Id, "No hay segundo alumno");
    assert.ok(ctx.pagoMatriculaId, "No hay pago de matrícula");

    const bytesLibreta = await verificarPdf(
      `/reportes/libreta/${ctx.alumno2Id}/pdf?bimestre=3`,
      ctx.adminToken,
    );
    const bytesBoleta = await verificarPdf(
      `/tesoreria/boletas/${ctx.pagoMatriculaId}/pdf`,
      ctx.adminToken,
    );

    registrar(
      11,
      "Descargar libreta y boleta PDF (200, application/pdf, %PDF)",
      "PASS",
      `libreta ${bytesLibreta} bytes, boleta ${bytesBoleta} bytes`,
    );
  });

  // 12. RBAC de estudiante y docente.
  await prueba(12, "RBAC: ESTUDIANTE /alumnos 403 y DOCENTE curso ajeno 403", async () => {
    const estudiante = await iniciarSesion(
      "ESTUDIANTE",
      credenciales.ESTUDIANTE[0],
      credenciales.ESTUDIANTE[1],
    );
    assert.equal(
      estudiante.usuario?.requiere_cambio_password,
      false,
      "El estudiante del seed requiere cambio de contraseña",
    );

    const alumnos = await api("/alumnos", { token: estudiante.token });
    const alumnosDatos = await leerJson(alumnos);
    assert.equal(
      alumnos.status,
      403,
      `ESTUDIANTE en /alumnos debía recibir 403 (${detalleHttp(alumnos, alumnosDatos)})`,
    );

    const docente = await iniciarSesion(
      "DOCENTE",
      credenciales.DOCENTE[0],
      credenciales.DOCENTE[1],
    );
    const cursoAjeno = await api(
      "/calificaciones/curso/1/grado/1?bimestre=1",
      { token: docente.token },
    );
    const cursoDatos = await leerJson(cursoAjeno);
    assert.equal(
      cursoAjeno.status,
      403,
      `DOCENTE en curso ajeno debía recibir 403 (${detalleHttp(cursoAjeno, cursoDatos)})`,
    );

    registrar(
      12,
      "RBAC: ESTUDIANTE /alumnos 403 y DOCENTE curso ajeno 403",
      "PASS",
      "403 y 403",
    );
  });

  // 13. Auditoría de los flujos y ausencia de datos sensibles.
  await prueba(13, "Auditoría LOGIN/CREAR/ANULAR sin datos sensibles", async () => {
    const acciones = await sql(`
      SELECT
        COUNT(*) FILTER (WHERE accion = 'LOGIN')::int AS login,
        COUNT(*) FILTER (
          WHERE accion = 'CREAR' AND modulo_afectado = 'Tesorería'
        )::int AS crear_pago,
        COUNT(*) FILTER (
          WHERE accion = 'ANULAR' AND modulo_afectado = 'Tesorería'
        )::int AS anular
      FROM bitacora_auditoria
    `);
    const fila = acciones[0];
    assert.ok(fila.login > 0, "No hay filas LOGIN en la auditoría");
    assert.ok(fila.crear_pago > 0, "No hay filas CREAR de pago en la auditoría");
    assert.ok(fila.anular > 0, "No hay filas ANULAR en la auditoría");

    const sensibles = await sql(`
      SELECT COUNT(*)::int AS total
      FROM bitacora_auditoria
      WHERE lower(
        COALESCE(descripcion, '') || ' ' ||
        COALESCE(valor_anterior::text, '') || ' ' ||
        COALESCE(valor_nuevo::text, '')
      ) LIKE '%password%'
         OR lower(
           COALESCE(descripcion, '') || ' ' ||
           COALESCE(valor_anterior::text, '') || ' ' ||
           COALESCE(valor_nuevo::text, '')
         ) LIKE '%$2a$%'
         OR lower(
           COALESCE(descripcion, '') || ' ' ||
           COALESCE(valor_anterior::text, '') || ' ' ||
           COALESCE(valor_nuevo::text, '')
         ) LIKE '%$2b$%'
         OR lower(
           COALESCE(descripcion, '') || ' ' ||
           COALESCE(valor_anterior::text, '') || ' ' ||
           COALESCE(valor_nuevo::text, '')
         ) LIKE '%$2y$%'
         OR lower(
           COALESCE(descripcion, '') || ' ' ||
           COALESCE(valor_anterior::text, '') || ' ' ||
           COALESCE(valor_nuevo::text, '')
         ) LIKE '%eyj%'
         OR lower(
           COALESCE(descripcion, '') || ' ' ||
           COALESCE(valor_anterior::text, '') || ' ' ||
           COALESCE(valor_nuevo::text, '')
         ) LIKE '%bearer %'
         OR lower(
           COALESCE(descripcion, '') || ' ' ||
           COALESCE(valor_anterior::text, '') || ' ' ||
           COALESCE(valor_nuevo::text, '')
         ) LIKE '%"token"%'
    `);
    assert.equal(sensibles[0].total, 0, "La auditoría contiene datos sensibles");

    registrar(
      13,
      "Auditoría LOGIN/CREAR/ANULAR sin datos sensibles",
      "PASS",
      `LOGIN=${fila.login}, CREAR pago=${fila.crear_pago}, ANULAR=${fila.anular}, 0 sensibles`,
    );
  });

  // 14. Cierre real por API, bloqueo de nota y reapertura.
  await prueba(14, "Cerrar acta real, bloquear nota y reabrir", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    assert.ok(ctx.alumno2Id, "No hay segundo alumno");

    const actasAntes = await sql(
      `SELECT COUNT(*)::int AS total
       FROM actas_bimestrales
       WHERE anio_lectivo = $1 AND bimestre = 3 AND id_grado = 1`,
      [ANIO],
    );
    assert.equal(actasAntes[0].total, 0, "Ya existía un acta de 3er Bimestre");

    const cierre = await api("/auditoria/actas/cerrar", {
      method: "POST",
      token: ctx.adminToken,
      body: {
        bimestre: 3,
        anio_lectivo: ANIO,
        id_grado: 1,
      },
    });
    const cierreDatos = await leerJson(cierre);
    assert.equal(
      cierre.status,
      200,
      `Cerrar acta falló (${detalleHttp(cierre, cierreDatos)})`,
    );

    const acta = cierreDatos.datos.data;
    assert.equal(acta.estado, "CERRADO");
    assert.equal(Number(acta.bimestre), 3);
    assert.equal(acta.periodo, "3er Bimestre");

    const intento = await api("/calificaciones", {
      method: "POST",
      token: ctx.adminToken,
      body: {
        id_alumno: ctx.alumno2Id,
        id_curso: 1,
        id_competencia: 4,
        id_grado: 1,
        bimestre: 3,
        anio_lectivo: ANIO,
        calificacion: "B",
      },
    });
    const intentoDatos = await leerJson(intento);
    assert.equal(
      intento.status,
      409,
      `Guardar nota con acta cerrada debía ser 409 (${detalleHttp(intento, intentoDatos)})`,
    );

    const reapertura = await api(`/auditoria/actas/${acta.id_acta}/reabrir`, {
      method: "POST",
      token: ctx.adminToken,
      body: { motivo: "Reapertura E2E para continuar el registro de notas" },
    });
    const reaperturaDatos = await leerJson(reapertura);
    assert.equal(
      reapertura.status,
      200,
      `Reabrir acta falló (${detalleHttp(reapertura, reaperturaDatos)})`,
    );
    assert.equal(reaperturaDatos.datos.data.estado, "ABIERTO");
    assert.equal(reaperturaDatos.datos.data.hash_integridad, null);

    const guardado = await api("/calificaciones", {
      method: "POST",
      token: ctx.adminToken,
      body: {
        id_alumno: ctx.alumno2Id,
        id_curso: 1,
        id_competencia: 4,
        id_grado: 1,
        bimestre: 3,
        anio_lectivo: ANIO,
        calificacion: "B",
      },
    });
    const guardadoDatos = await leerJson(guardado);
    assert.equal(
      guardado.status,
      201,
      `Guardar nota tras reabrir falló (${detalleHttp(guardado, guardadoDatos)})`,
    );

    registrar(
      14,
      "Cerrar acta real, bloquear nota y reabrir",
      "PASS",
      "cierre 200, nota 409, reapertura 200, nota 201",
    );
  });

  // 15. Caja con efectivo + Yape + anulación: el digital neto vuelve a 0.
  await prueba(15, "Caja digital: Yape anulado no descuenta efectivo", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    assert.ok(ctx.alumno2Id, "No hay segundo alumno");

    ctx.idConceptoCaja50 = await crearConceptoPrueba("H50 efectivo 50", 50);
    ctx.idConceptoCaja80 = await crearConceptoPrueba("H50 Yape 80", 80);

    await resetCajaParaPrueba();
    await abrirCajaPrueba(100);

    await pagarConceptoPrueba(ctx.idConceptoCaja50, 50, "Efectivo");
    const pagoYape = await pagarConceptoPrueba(
      ctx.idConceptoCaja80,
      80,
      "Yape",
      "YAPE-H50-1",
    );

    const anulacion = await api(
      `/tesoreria/pagos/${pagoYape.id_pago}/anular`,
      {
        method: "PUT",
        token: ctx.adminToken,
        body: { motivo: "Anulación H50 de pago Yape" },
      },
    );
    const anulacionDatos = await leerJson(anulacion);
    assert.equal(
      anulacion.status,
      200,
      `Anular Yape falló (${detalleHttp(anulacion, anulacionDatos)})`,
    );

    const cajaRespuesta = await api("/caja/actual", { token: ctx.adminToken });
    const cajaDatos = await leerJson(cajaRespuesta);
    assert.equal(cajaRespuesta.status, 200, "No se pudo leer /caja/actual");
    const caja = cajaDatos.datos.data;

    assert.equal(Number(caja.total_ingresos_efectivo), 50);
    assert.equal(Number(caja.total_ingresos_digital), 80);
    assert.equal(Number(caja.total_egresos_efectivo), 0);
    assert.equal(Number(caja.total_egresos_digital), 80);
    assert.equal(Number(caja.total_ingresos), 130);
    assert.equal(Number(caja.total_egresos), 80);

    const cierre = await api("/caja/cerrar", {
      method: "POST",
      token: ctx.adminToken,
      body: { efectivo_fisico: 150 },
    });
    const cierreDatos = await leerJson(cierre);
    assert.equal(
      cierre.status,
      200,
      `Cerrar caja falló (${detalleHttp(cierre, cierreDatos)})`,
    );
    const c = cierreDatos.datos.data;

    assert.equal(Number(c.efectivo_esperado), 150);
    assert.equal(Number(c.egresos_efectivo), 0);
    assert.equal(Number(c.egresos_digital), 80);
    assert.equal(Number(c.total_digital), 0);
    assert.equal(Number(c.total_general), 150);
    assert.equal(c.estado, "CUADRADO");

    registrar(
      15,
      "Caja digital: Yape anulado no descuenta efectivo",
      "PASS",
      "efectivo=150, digital=0, cierre CUADRADO",
    );
  });

  // 16. Caja sin anulación: digital neto S/ 80.
  await prueba(16, "Caja digital: Yape vigente suma digital S/ 80", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    assert.ok(ctx.idConceptoCaja50, "Falta concepto H50 efectivo");
    assert.ok(ctx.idConceptoCaja80, "Falta concepto H50 digital");

    await resetCajaParaPrueba();
    await abrirCajaPrueba(100);

    await pagarConceptoPrueba(ctx.idConceptoCaja50, 50, "Efectivo");
    await pagarConceptoPrueba(
      ctx.idConceptoCaja80,
      80,
      "Yape",
      "YAPE-H50-2",
    );

    const cajaRespuesta = await api("/caja/actual", { token: ctx.adminToken });
    const cajaDatos = await leerJson(cajaRespuesta);
    assert.equal(cajaRespuesta.status, 200, "No se pudo leer /caja/actual");
    const caja = cajaDatos.datos.data;

    assert.equal(Number(caja.total_ingresos_efectivo), 50);
    assert.equal(Number(caja.total_ingresos_digital), 80);
    assert.equal(Number(caja.total_egresos_efectivo), 0);
    assert.equal(Number(caja.total_egresos_digital), 0);
    assert.equal(Number(caja.total_ingresos), 130);
    assert.equal(Number(caja.total_egresos), 0);

    const cierre = await api("/caja/cerrar", {
      method: "POST",
      token: ctx.adminToken,
      body: { efectivo_fisico: 150 },
    });
    const cierreDatos = await leerJson(cierre);
    assert.equal(
      cierre.status,
      200,
      `Cerrar caja falló (${detalleHttp(cierre, cierreDatos)})`,
    );
    const c = cierreDatos.datos.data;

    assert.equal(Number(c.efectivo_esperado), 150);
    assert.equal(Number(c.egresos_efectivo), 0);
    assert.equal(Number(c.egresos_digital), 0);
    assert.equal(Number(c.total_digital), 80);
    assert.equal(Number(c.total_general), 230);
    assert.equal(c.estado, "CUADRADO");

    registrar(
      16,
      "Caja digital: Yape vigente suma digital S/ 80",
      "PASS",
      "efectivo=150, digital=80, cierre CUADRADO",
    );
  });

  // 17. H63: PDF de acta solo ADMIN.
  await prueba(17, "PDF de acta: ADMIN 200, DOCENTE 403, sin token 401", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");

    const actas = await sql(
      `SELECT id_acta
       FROM actas_bimestrales
       WHERE id_grado = 1 AND anio_lectivo = $1 AND bimestre = 3
       ORDER BY id_acta DESC
       LIMIT 1`,
      [ANIO],
    );
    assert.ok(actas[0]?.id_acta, "No hay acta de grado 1 para probar el PDF");

    const ruta = `/auditoria/actas/${actas[0].id_acta}/pdf`;
    const bytes = await verificarPdf(ruta, ctx.adminToken);

    const docente = await iniciarSesion(
      "DOCENTE",
      credenciales.DOCENTE[0],
      credenciales.DOCENTE[1],
    );
    const docenteRespuesta = await api(ruta, {
      token: docente.token,
      accept: "application/pdf",
    });
    assert.equal(
      docenteRespuesta.status,
      403,
      "DOCENTE no debe descargar el PDF de acta",
    );

    const sinToken = await api(ruta, { accept: "application/pdf" });
    assert.equal(sinToken.status, 401, "Sin token el PDF de acta debe dar 401");

    registrar(
      17,
      "PDF de acta: ADMIN 200, DOCENTE 403, sin token 401",
      "PASS",
      `ADMIN ${bytes} bytes, DOCENTE 403, sin token 401`,
    );
  });

  // 18. Acta global cerrada bloquea todos los grados.
  await prueba(18, "Acta global bloquea 1ro y 5to; reabrir libera", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");
    assert.ok(ctx.alumno2Id, "No hay segundo alumno");

    const cierre = await api("/auditoria/actas/cerrar", {
      method: "POST",
      token: ctx.adminToken,
      body: {
        bimestre: 4,
        anio_lectivo: ANIO,
      },
    });
    const cierreDatos = await leerJson(cierre);
    assert.equal(
      cierre.status,
      200,
      `Cerrar acta global falló (${detalleHttp(cierre, cierreDatos)})`,
    );
    const actaGlobal = cierreDatos.datos.data;
    assert.equal(actaGlobal.id_grado, null);
    assert.equal(actaGlobal.estado, "CERRADO");

    const notaBase = {
      id_alumno: ctx.alumno2Id,
      id_curso: 1,
      id_competencia: 1,
      bimestre: 4,
      anio_lectivo: ANIO,
      calificacion: "A",
    };

    const nota1 = await api("/calificaciones", {
      method: "POST",
      token: ctx.adminToken,
      body: { ...notaBase, id_grado: 1 },
    });
    const nota1Datos = await leerJson(nota1);
    assert.equal(
      nota1.status,
      409,
      `Acta global no bloqueó 1ro (${detalleHttp(nota1, nota1Datos)})`,
    );

    const nota5 = await api("/calificaciones", {
      method: "POST",
      token: ctx.adminToken,
      body: { ...notaBase, id_grado: 5 },
    });
    const nota5Datos = await leerJson(nota5);
    assert.equal(
      nota5.status,
      409,
      `Acta global no bloqueó 5to (${detalleHttp(nota5, nota5Datos)})`,
    );

    const reapertura = await api(
      `/auditoria/actas/${actaGlobal.id_acta}/reabrir`,
      {
        method: "POST",
        token: ctx.adminToken,
        body: { motivo: "Reapertura global E2E para continuar notas" },
      },
    );
    const reaperturaDatos = await leerJson(reapertura);
    assert.equal(
      reapertura.status,
      200,
      `Reabrir acta global falló (${detalleHttp(reapertura, reaperturaDatos)})`,
    );

    const nota1Despues = await api("/calificaciones", {
      method: "POST",
      token: ctx.adminToken,
      body: { ...notaBase, id_grado: 1 },
    });
    const nota1DespuesDatos = await leerJson(nota1Despues);
    assert.equal(
      nota1Despues.status,
      201,
      `Guardar nota tras reabrir global falló (${detalleHttp(nota1Despues, nota1DespuesDatos)})`,
    );

    registrar(
      18,
      "Acta global bloquea 1ro y 5to; reabrir libera",
      "PASS",
      "global 200, notas 409/409, reapertura 200, nota 201",
    );
  });

  // 19. Duplicado, motivo corto y autorización de cierre/reapertura.
  await prueba(19, "Cierre duplicado 409, motivo corto 400 y roles 403/401", async () => {
    assert.ok(ctx.adminToken, "No hay sesión ADMIN");

    const cierre = await api("/auditoria/actas/cerrar", {
      method: "POST",
      token: ctx.adminToken,
      body: { bimestre: 3, anio_lectivo: ANIO, id_grado: 1 },
    });
    const cierreDatos = await leerJson(cierre);
    assert.equal(
      cierre.status,
      200,
      `Cerrar acta para duplicado falló (${detalleHttp(cierre, cierreDatos)})`,
    );
    const actaId = cierreDatos.datos.data.id_acta;

    const segundo = await api("/auditoria/actas/cerrar", {
      method: "POST",
      token: ctx.adminToken,
      body: { bimestre: 3, anio_lectivo: ANIO, id_grado: 1 },
    });
    const segundoDatos = await leerJson(segundo);
    assert.equal(
      segundo.status,
      409,
      `Cerrar dos veces debía dar 409 (${detalleHttp(segundo, segundoDatos)})`,
    );

    const corto = await api(`/auditoria/actas/${actaId}/reabrir`, {
      method: "POST",
      token: ctx.adminToken,
      body: { motivo: "corto" },
    });
    const cortoDatos = await leerJson(corto);
    assert.equal(
      corto.status,
      400,
      `Motivo corto debía dar 400 (${detalleHttp(corto, cortoDatos)})`,
    );

    const reapertura = await api(`/auditoria/actas/${actaId}/reabrir`, {
      method: "POST",
      token: ctx.adminToken,
      body: { motivo: "Reapertura E2E para probar autorización" },
    });
    const reaperturaDatos = await leerJson(reapertura);
    assert.equal(
      reapertura.status,
      200,
      `Reapertura válida falló (${detalleHttp(reapertura, reaperturaDatos)})`,
    );

    const docente = await iniciarSesion(
      "DOCENTE",
      credenciales.DOCENTE[0],
      credenciales.DOCENTE[1],
    );
    const secretaria = await iniciarSesion(
      "SECRETARIA",
      process.env.SMOKE_SECRETARIA_DNI || "40596837",
      process.env.SMOKE_SECRETARIA_PASSWORD ||
        process.env.SMOKE_ADMIN_PASSWORD,
    );

    for (const [rol, token] of [
      ["DOCENTE", docente.token],
      ["SECRETARIA", secretaria.token],
    ]) {
      const cierreRol = await api("/auditoria/actas/cerrar", {
        method: "POST",
        token,
        body: { bimestre: 3, anio_lectivo: ANIO, id_grado: 1 },
      });
      assert.equal(
        cierreRol.status,
        403,
        `${rol} no debe cerrar actas`,
      );

      const reabrirRol = await api(`/auditoria/actas/${actaId}/reabrir`, {
        method: "POST",
        token,
        body: { motivo: "Intento de reapertura por rol no autorizado" },
      });
      assert.equal(
        reabrirRol.status,
        403,
        `${rol} no debe reabrir actas`,
      );
    }

    const cierreSinToken = await api("/auditoria/actas/cerrar", {
      method: "POST",
      body: { bimestre: 3, anio_lectivo: ANIO, id_grado: 1 },
    });
    assert.equal(cierreSinToken.status, 401);

    const reabrirSinToken = await api(
      `/auditoria/actas/${actaId}/reabrir`,
      {
        method: "POST",
        body: { motivo: "Intento de reapertura sin token" },
      },
    );
    assert.equal(reabrirSinToken.status, 401);

    registrar(
      19,
      "Cierre duplicado 409, motivo corto 400 y roles 403/401",
      "PASS",
      "409, 400, DOCENTE/SECRETARIA 403, sin token 401",
    );
  });

  // 20. Configuración table-backed y catálogo de años.
  await prueba(20, "Año activo desde anios_lectivos y 43 tablas base", async () => {
    const tablas = await sql(
      `SELECT COUNT(*)::int AS total
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name <> 'horarios_h47_backup'`,
    );
    const activos = await sql(
      `SELECT anio FROM anios_lectivos WHERE estado = 'ACTIVO'`,
    );
    const respuesta = await api("/configuracion");
    const { datos } = await leerJson(respuesta);

    assert.equal(tablas[0].total, 43, "Se esperaban 43 tablas base");
    assert.equal(activos.length, 1, "Debe haber exactamente un año ACTIVO");
    assert.equal(Number(activos[0].anio), ANIO, "El año ACTIVO inicial no es el esperado");
    assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
    assert.equal(
      Number(datos?.data?.anio_lectivo),
      ANIO,
      "GET /configuracion no devuelve el año de la tabla",
    );

    registrar(
      20,
      "Año activo desde anios_lectivos y 43 tablas base",
      "PASS",
      `tablas=43, activo=${ANIO}`,
    );
  });

  // 21. Uniques por año y mismo alumno en dos años.
  await prueba(21, "Uniques por año: mismo alumno en dos años y duplicado rechazado", async () => {
    const grados = await sql(
      `INSERT INTO grados (nombre_grado, nivel, seccion, anio_lectivo, orden)
       VALUES ('1ro de Secundaria', 'SECUNDARIA', 'Única', $1, 1)
       ON CONFLICT (nombre_grado, seccion, anio_lectivo)
       DO UPDATE SET nivel = EXCLUDED.nivel, orden = EXCLUDED.orden
       RETURNING id_grado`,
      [ANIO_DESTINO],
    );
    ctx.idGradoDestino = grados[0].id_grado;

    const destino = await sql(
      `INSERT INTO alumnos (
         id_usuario, dni, nombres, apellidos, fecha_nacimiento,
         id_apoderado, id_grado, condicion, colegio_procedencia,
         estado_matricula, codigo_estudiante, anio_lectivo
       )
       SELECT id_usuario, dni, nombres, apellidos, fecha_nacimiento,
              id_apoderado, $1, condicion, colegio_procedencia,
              'Matriculado', codigo_estudiante, $2
       FROM alumnos
       WHERE id_alumno = $3
       RETURNING id_alumno`,
      [ctx.idGradoDestino, ANIO_DESTINO, ctx.alumno2Id],
    );
    ctx.alumno2IdDestino = destino[0].id_alumno;

    const original = await sql(
      `SELECT id_usuario, dni, codigo_estudiante FROM alumnos WHERE id_alumno = $1`,
      [ctx.alumno2IdDestino],
    );
    assert.equal(Number(original[0].dni), Number(DNI_ALUMNO_2));
    assert.ok(original[0].codigo_estudiante, "La matrícula destino no copió el código");

    await assert.rejects(
      () =>
        sql(
          `INSERT INTO alumnos (
             id_usuario, dni, nombres, apellidos, fecha_nacimiento,
             id_apoderado, id_grado, condicion, colegio_procedencia,
             estado_matricula, codigo_estudiante, anio_lectivo
           )
           SELECT id_usuario, dni, nombres, apellidos, fecha_nacimiento,
                  id_apoderado, $1, condicion, colegio_procedencia,
                  'Matriculado', codigo_estudiante, $2
           FROM alumnos
           WHERE id_alumno = $3`,
          [ctx.idGradoDestino, ANIO_DESTINO, ctx.alumno2IdDestino],
        ),
      (error) => error.code === "23505",
      "Un duplicado del mismo año debía violar un UNIQUE",
    );

    await sql(
      `UPDATE usuarios SET requiere_cambio_password = FALSE WHERE dni = $1`,
      [DNI_ALUMNO_2],
    );

    registrar(
      21,
      "Uniques por año: mismo alumno en dos años y duplicado rechazado",
      "PASS",
      `2027 id=${ctx.alumno2IdDestino}, duplicado 23505`,
    );
  });

  // 22. Apoderado compartido por DNI.
  await prueba(22, "Apoderado compartido por DNI entre hermanos", async () => {
    const dniApoderado = "99999012";
    const alumnoA = await crearAlumno("99999003", "Hermano", "Uno", {
      apoderado: {
        nombres: "Apoderado Compartido",
        apellidos: "E2E",
        dni: dniApoderado,
        telefono: "988888888",
        correo: "apoderado.compartido@example.com",
      },
    });
    const alumnoB = await crearAlumno("99999004", "Hermano", "Dos", {
      apoderado: {
        nombres: "Apoderado Compartido",
        apellidos: "E2E",
        dni: dniApoderado,
        telefono: "988888888",
        correo: "apoderado.compartido@example.com",
      },
    });

    const filas = await sql(
      `SELECT id_apoderado FROM apoderados WHERE dni = $1`,
      [dniApoderado],
    );
    const alumnos = await sql(
      `SELECT id_alumno, id_apoderado FROM alumnos WHERE id_alumno = ANY($1::int[]) ORDER BY id_alumno`,
      [[alumnoA.id_alumno, alumnoB.id_alumno]],
    );

    assert.equal(filas.length, 1, "Debe existir una sola fila de apoderado");
    assert.equal(
      new Set(alumnos.map((a) => Number(a.id_apoderado))).size,
      1,
      "Los hermanos no comparten el mismo id_apoderado",
    );

    registrar(
      22,
      "Apoderado compartido por DNI entre hermanos",
      "PASS",
      `apoderado=${filas[0].id_apoderado}, alumnos=2`,
    );
  });

  // 23. Login sin matrícula activa.
  await prueba(23, "Login sin matrícula activa y endpoint académico 403", async () => {
    const dni = "99999099";
    await sql(
      `INSERT INTO usuarios (
         dni, nombres, apellidos, correo_institucional, correo_personal,
         password_hash, telefono, id_rol, estado, requiere_cambio_password
       ) VALUES (
         $1, 'Sin', 'Matricula', 'sin.matricula@e2e.local', NULL,
         crypt($2, gen_salt('bf', 10)), NULL, 4, 'ACTIVO', FALSE
       )
       ON CONFLICT (dni) DO NOTHING`,
      [dni, dni],
    );

    const sesion = await iniciarSesion("ESTUDIANTE", dni, dni);
    assert.equal(
      sesion.usuario?.info_adicional?.matricula_activa,
      false,
      "El login debía indicar matricula_activa=false",
    );
    assert.equal(
      sesion.usuario?.info_adicional?.id_alumno,
      null,
      "Sin matrícula, id_alumno debe ser null",
    );

    const respuesta = await api("/asistencias/alumno/1", {
      token: sesion.token,
    });
    const { datos } = await leerJson(respuesta);
    assert.equal(respuesta.status, 403, detalleHttp(respuesta, datos));
    assert.equal(datos?.errors?.codigo, "SIN_MATRICULA_ACTIVA");
    assert.ok(
      String(datos?.message || "").includes("No tienes matrícula"),
      "El mensaje no explica la falta de matrícula",
    );

    registrar(
      23,
      "Login sin matrícula activa y endpoint académico 403",
      "PASS",
      "login 200, matricula_activa=false, 403 SIN_MATRICULA_ACTIVA",
    );
  });

  // 24. Consultas por año y libreta que no mezcla años.
  await prueba(24, "Consultas por año y libreta no mezclan matrículas", async () => {
    const alumnos2026 = await api("/alumnos?anio=2026", {
      token: ctx.adminToken,
    });
    const datos2026 = await leerJson(alumnos2026);
    const alumnos2027 = await api("/alumnos?anio=2027", {
      token: ctx.adminToken,
    });
    const datos2027 = await leerJson(alumnos2027);
    assert.equal(alumnos2026.status, 200, detalleHttp(alumnos2026, datos2026));
    assert.equal(alumnos2027.status, 200, detalleHttp(alumnos2027, datos2027));

    const ids2026 = (datos2026.datos?.data || []).map((a) => Number(a.id_alumno));
    const ids2027 = (datos2027.datos?.data || []).map((a) => Number(a.id_alumno));
    assert.ok(!ids2026.includes(ctx.alumno2IdDestino), "2026 incluyó la matrícula 2027");
    assert.ok(ids2027.includes(ctx.alumno2IdDestino), "2027 no incluyó su matrícula");
    assert.ok(!ids2027.includes(ctx.alumno2Id), "2027 incluyó la matrícula 2026");

    const porDni2027 = await api(
      `/alumnos/dni/${DNI_ALUMNO_2}?anio=2027`,
      { token: ctx.adminToken },
    );
    const datosDni2027 = await leerJson(porDni2027);
    assert.equal(porDni2027.status, 200, detalleHttp(porDni2027, datosDni2027));
    assert.equal(
      Number(datosDni2027.datos?.data?.id_alumno),
      ctx.alumno2IdDestino,
      "La búsqueda por DNI no devolvió la matrícula 2027",
    );

    const libreta2027 = await api(
      `/reportes/libreta/${ctx.alumno2IdDestino}?bimestre=3&anio=2027`,
      { token: ctx.adminToken },
    );
    const datosLibreta2027 = await leerJson(libreta2027);
    assert.equal(libreta2027.status, 200, detalleHttp(libreta2027, datosLibreta2027));
    assert.equal(Number(datosLibreta2027.datos?.data?.anio_lectivo), ANIO_DESTINO);

    const libretaCruzada = await api(
      `/reportes/libreta/${ctx.alumno2Id}?bimestre=3&anio=2027`,
      { token: ctx.adminToken },
    );
    const datosCruzada = await leerJson(libretaCruzada);
    assert.equal(
      libretaCruzada.status,
      404,
      `La libreta cruzada debía 404 (${detalleHttp(libretaCruzada, datosCruzada)})`,
    );

    const alumnoCruzado = await api(`/alumnos/${ctx.alumno2Id}?anio=2027`, {
      token: ctx.adminToken,
    });
    const datosAlumnoCruzado = await leerJson(alumnoCruzado);
    assert.equal(
      alumnoCruzado.status,
      404,
      `El alumno cruzado debía 404 (${detalleHttp(alumnoCruzado, datosAlumnoCruzado)})`,
    );

    registrar(
      24,
      "Consultas por año y libreta no mezclan matrículas",
      "PASS",
      `2026 id=${ctx.alumno2Id}, 2027 id=${ctx.alumno2IdDestino}, cruzada 404`,
    );
  });

  // 25. Retirar una matrícula no desactiva si queda otra viva.
  await prueba(25, "Retirar 2026 no desactiva al alumno con matrícula 2027", async () => {
    const respuesta = await api(`/alumnos/${ctx.alumno2Id}/retirar`, {
      method: "PUT",
      token: ctx.adminToken,
      body: { motivo_retiro: "Retiro de prueba E2E multi-año" },
    });
    const { datos } = await leerJson(respuesta);
    assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));

    const filas = await sql(
      `SELECT a.estado_matricula, u.estado AS estado_usuario
       FROM alumnos a
       INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
       WHERE a.id_alumno = $1`,
      [ctx.alumno2Id],
    );
    const destino = await sql(
      `SELECT estado_matricula FROM alumnos WHERE id_alumno = $1`,
      [ctx.alumno2IdDestino],
    );
    assert.equal(filas[0].estado_matricula, "Retirado");
    assert.equal(filas[0].estado_usuario, "ACTIVO");
    assert.equal(destino[0].estado_matricula, "Matriculado");

    registrar(
      25,
      "Retirar 2026 no desactiva al alumno con matrícula 2027",
      "PASS",
      "2026 Retirado, usuario ACTIVO, 2027 Matriculado",
    );
  });

  // 26. Login con el nuevo año activo (reinicio del backend).
  await prueba(26, "Login resuelve la matrícula del año activo (2027)", async () => {
    const sesionAntes = await iniciarSesion(
      "ESTUDIANTE",
      DNI_ALUMNO_2,
      DNI_ALUMNO_2,
    );
    assert.equal(
      Number(sesionAntes.usuario?.info_adicional?.anio_lectivo),
      ANIO,
      "El login previo debía resolver 2026",
    );

    await sql(
      `INSERT INTO anios_lectivos (anio) VALUES ($1)
       ON CONFLICT (anio) DO NOTHING`,
      [ANIO_DESTINO],
    );
    await sql(
      `UPDATE anios_lectivos SET estado = 'PLANIFICADO' WHERE anio = $1`,
      [ANIO],
    );
    await sql(
      `UPDATE anios_lectivos SET estado = 'ACTIVO' WHERE anio = $1`,
      [ANIO_DESTINO],
    );

    await detenerBackend();
    await iniciarBackend();
    await esperarHealth();

    const config = await api("/configuracion");
    const datosConfig = await leerJson(config);
    assert.equal(config.status, 200, detalleHttp(config, datosConfig));
    assert.equal(Number(datosConfig.datos?.data?.anio_lectivo), ANIO_DESTINO);

    const sesion = await iniciarSesion(
      "ESTUDIANTE",
      DNI_ALUMNO_2,
      DNI_ALUMNO_2,
    );
    assert.equal(
      Number(sesion.usuario?.info_adicional?.anio_lectivo),
      ANIO_DESTINO,
      "El perfil no resolvió el año activo",
    );
    assert.equal(
      Number(sesion.usuario?.info_adicional?.id_alumno),
      ctx.alumno2IdDestino,
      "El login no resolvió la matrícula 2027",
    );
    assert.equal(
      sesion.usuario?.info_adicional?.matricula_activa,
      true,
      "La matrícula 2027 debería estar activa",
    );

    const perfilConTokenViejo = await api("/auth/perfil", {
      token: sesionAntes.token,
    });
    const datosPerfilViejo = await leerJson(perfilConTokenViejo);
    assert.equal(
      perfilConTokenViejo.status,
      200,
      detalleHttp(perfilConTokenViejo, datosPerfilViejo),
    );
    assert.equal(
      Number(datosPerfilViejo.datos?.data?.info_adicional?.anio_lectivo),
      ANIO_DESTINO,
      "Un token anterior al cambio de año no se resolvió con el año activo",
    );

    registrar(
      26,
      "Login resuelve la matrícula del año activo (2027)",
      "PASS",
      `config=${ANIO_DESTINO}, id_alumno=${ctx.alumno2IdDestino}, token previo OK`,
    );
  });

  // 27. Pre-tickets y pendientes de cobro filtrados por año.
  await prueba(27, "Pre-tickets y pendientes de cobro no mezclan años", async () => {
    const antes = await api("/tesoreria/estadisticas?anio=2026&mes=11", {
      token: ctx.adminToken,
    });
    const datosAntes = await leerJson(antes);
    assert.equal(antes.status, 200, detalleHttp(antes, datosAntes));
    const monto2026Antes = Number(
      datosAntes.datos?.data?.pendiente?.monto_pendiente || 0,
    );

    const concepto = await sql(
      `INSERT INTO conceptos_pago (nombre, monto_base, tipo, mes, anio_lectivo)
       VALUES ('Pre-ticket E2E 2027', 777, 'OTROS', NULL, $1)
       RETURNING id_concepto`,
      [ANIO_DESTINO],
    );
    const preticket = await sql(
      `INSERT INTO pre_tickets (id_alumno, id_concepto, monto, estado)
       VALUES ($1, $2, 777, 'PENDIENTE')
       RETURNING id_preticket`,
      [ctx.alumno2IdDestino, concepto[0].id_concepto],
    );
    assert.ok(preticket[0].id_preticket);

    const pre2027 = await api(
      `/tesoreria/pre-tickets?estado=PENDIENTE&anio=2027`,
      { token: ctx.adminToken },
    );
    const datosPre2027 = await leerJson(pre2027);
    assert.equal(pre2027.status, 200, detalleHttp(pre2027, datosPre2027));
    assert.ok(
      (datosPre2027.datos?.data || []).some(
        (pt) => Number(pt.id_preticket) === Number(preticket[0].id_preticket),
      ),
      "El pre-ticket 2027 no apareció en su año",
    );

    const pre2026 = await api(
      `/tesoreria/pre-tickets?estado=PENDIENTE&anio=2026`,
      { token: ctx.adminToken },
    );
    const datosPre2026 = await leerJson(pre2026);
    assert.equal(pre2026.status, 200, detalleHttp(pre2026, datosPre2026));
    assert.ok(
      !(datosPre2026.datos?.data || []).some(
        (pt) => Number(pt.id_preticket) === Number(preticket[0].id_preticket),
      ),
      "El pre-ticket 2027 se mezcló con 2026",
    );

    const despues = await api("/tesoreria/estadisticas?anio=2026&mes=11", {
      token: ctx.adminToken,
    });
    const datosDespues = await leerJson(despues);
    assert.equal(despues.status, 200, detalleHttp(despues, datosDespues));
    assert.equal(
      Number(datosDespues.datos?.data?.pendiente?.monto_pendiente || 0),
      monto2026Antes,
      "El pendiente 2026 cambió al crear un pre-ticket 2027",
    );

    const stats2027 = await api("/tesoreria/estadisticas?anio=2027&mes=11", {
      token: ctx.adminToken,
    });
    const datosStats2027 = await leerJson(stats2027);
    assert.equal(stats2027.status, 200, detalleHttp(stats2027, datosStats2027));
    assert.ok(
      Number(datosStats2027.datos?.data?.pendiente?.monto_pendiente || 0) >= 777,
      "El pendiente 2027 no incluyó su pre-ticket",
    );

    registrar(
      27,
      "Pre-tickets y pendientes de cobro no mezclan años",
      "PASS",
      `pre-ticket 2027=${preticket[0].id_preticket}, 2026 sin cambios`,
    );
  });

  // ============================================================
  // FASE 6.2 — ROLLOVER, ACTIVACIÓN Y REVERSIÓN (H49)
  // Destinos limpios: 2028 en adelante para no chocar con el 2027
  // que dejan las pruebas 20–27.
  // ============================================================
  // El dump de demo asigna 60 h a un docente (capacidad 40). En esta base
  // desechable se equilibra la carga del año origen para probar el rollover
  // sin sobrecapacidad. No se toca ninguna base real.
  const equilibrarCargaOrigen = async () => {
    const periodos = await sql(
      `SELECT COUNT(*)::int AS total
       FROM periodos_clase
       WHERE anio_lectivo = $1 AND tipo = 'CLASE' AND activo`,
      [ANIO],
    );
    const capacidad = Number(periodos[0].total) * 5;
    const cargas = await sql(
      `SELECT cc.id_carga, cc.id_personal,
              COALESCE(cc.horas_asignadas, 0)::int AS horas
       FROM carga_curricular cc
       WHERE cc.anio_lectivo = $1
       ORDER BY cc.id_grado, cc.id_curso`,
      [ANIO],
    );
    assert.ok(cargas.length > 0, "No hay carga del año origen para equilibrar");

    const docentes = [...new Set(cargas.map((c) => Number(c.id_personal)))];
    const totales = new Map(docentes.map((id) => [id, 0]));
    for (const carga of cargas) {
      const id = Number(carga.id_personal);
      totales.set(id, totales.get(id) + Number(carga.horas));
    }

    const ordenadas = [...cargas].sort(
      (a, b) => Number(b.horas) - Number(a.horas) || a.id_carga - b.id_carga,
    );
    for (const carga of ordenadas) {
      const actual = Number(carga.id_personal);
      if (totales.get(actual) <= capacidad) continue;

      const destino = docentes.find(
        (id) =>
          id !== actual &&
          totales.get(id) + Number(carga.horas) <= capacidad,
      );
      if (!destino) continue;

      await sql(
        `UPDATE carga_curricular SET id_personal = $1 WHERE id_carga = $2`,
        [destino, carga.id_carga],
      );
      totales.set(actual, totales.get(actual) - Number(carga.horas));
      totales.set(destino, totales.get(destino) + Number(carga.horas));
    }

    const excedidos = [...totales.entries()].filter(
      ([, horas]) => horas > capacidad,
    );
    assert.equal(
      excedidos.length,
      0,
      `No se pudo equilibrar la carga (capacidad ${capacidad} h): ${JSON.stringify(
        excedidos,
      )}`,
    );
  };

  await equilibrarCargaOrigen();

  const ANIO_ROLLOVER = ANIO + 2; // 2028
  const ANIO_OFERTA_DISTINTA = ANIO + 3; // 2029
  const ANIO_DOCENTE = ANIO + 4; // 2030
  const ANIO_HASH = ANIO + 5; // 2031
  const ANIO_SIN_OFERTA = ANIO + 6; // 2032
  const ANIO_REVERSION = ANIO + 7; // 2033
  const ANIO_ROLLBACK = ANIO + 8; // 2034

  const contarAnio = async (anio) => {
    const filas = await sql(
      `SELECT
         (SELECT COUNT(*)::int FROM anios_lectivos WHERE anio = $1) AS anio,
         (SELECT COUNT(*)::int FROM grados WHERE anio_lectivo = $1) AS grados,
         (SELECT COUNT(*)::int FROM conceptos_pago WHERE anio_lectivo = $1) AS conceptos,
         (SELECT COUNT(*)::int FROM periodos_clase WHERE anio_lectivo = $1) AS periodos,
         (SELECT COUNT(*)::int FROM carga_curricular WHERE anio_lectivo = $1) AS carga,
         (SELECT COUNT(*)::int FROM tutores_grado WHERE anio_lectivo = $1) AS tutores,
         (SELECT COUNT(*)::int FROM alumnos WHERE anio_lectivo = $1) AS alumnos,
         (SELECT COUNT(*)::int FROM actas_bimestrales WHERE anio_lectivo = $1) AS actas,
         (SELECT COUNT(*)::int FROM horarios WHERE anio_lectivo = $1) AS horarios,
         (SELECT COUNT(*)::int FROM pagos p
            INNER JOIN alumnos a ON a.id_alumno = p.id_alumno
            WHERE a.anio_lectivo = $1) AS pagos`,
      [anio],
    );
    return filas[0];
  };

  const limpiarAnioRollover = async (anio) => {
    await sql(`DELETE FROM tutores_grado WHERE anio_lectivo = $1`, [anio]);
    await sql(`DELETE FROM carga_curricular WHERE anio_lectivo = $1`, [anio]);
    await sql(`DELETE FROM periodos_clase WHERE anio_lectivo = $1`, [anio]);
    await sql(`DELETE FROM conceptos_pago WHERE anio_lectivo = $1`, [anio]);
    await sql(`DELETE FROM grados WHERE anio_lectivo = $1`, [anio]);
    await sql(`DELETE FROM anios_lectivos WHERE anio = $1`, [anio]);
  };

  // 28. Preview sin escrituras.
  await prueba(
    28,
    "Rollover: preview 2026→2028 sin escrituras y con hash",
    async () => {
      const antes = await contarAnio(ANIO_ROLLOVER);
      const respuesta = await api("/anios-lectivos/preview", {
        method: "POST",
        token: ctx.adminToken,
        body: { anio_origen: ANIO, anio_destino: ANIO_ROLLOVER },
      });
      const { datos } = await leerJson(respuesta);
      const despues = await contarAnio(ANIO_ROLLOVER);

      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
      const preview = datos?.data;
      assert.ok(preview?.preview_hash, "El preview no devolvió preview_hash");
      assert.match(
        preview.preview_hash,
        /^[a-f0-9]{64}$/,
        "El preview_hash no es SHA-256 hexadecimal",
      );
      assert.equal(
        preview.bloqueos?.length,
        0,
        `El preview no debía tener bloqueos: ${JSON.stringify(preview.bloqueos)}`,
      );
      assert.ok(
        Number(preview.resumen?.grados?.total) >= 1,
        "El preview no contó grados",
      );
      assert.ok(
        Number(preview.resumen?.conceptos?.matricula) >= 1,
        "El preview no contó el concepto MATRICULA",
      );
      assert.ok(
        Number(preview.resumen?.carga?.total) >= 1,
        "El preview no contó carga curricular",
      );
      assert.deepEqual(despues, antes, "El preview escribió en el año destino");

      ctx.rolloverHash = preview.preview_hash;
      ctx.rolloverResumen = preview.resumen;
      ctx.rolloverCreables =
        Number(preview.resumen.grados.total) +
        Number(preview.resumen.conceptos.total) +
        Number(preview.resumen.periodos.total) +
        Number(preview.resumen.carga.total) +
        Number(preview.resumen.tutores.total);

      registrar(
        28,
        "Rollover: preview 2026→2028 sin escrituras y con hash",
        "PASS",
        `hash=${preview.preview_hash.slice(0, 12)}…, bloqueos=0`,
      );
    },
  );

  // 29. Confirmación: solo oferta, sin actividad.
  await prueba(
    29,
    "Rollover: confirm clona solo oferta (0 alumnos/actas/horarios/pagos)",
    async () => {
      const respuesta = await api("/anios-lectivos/rollover", {
        method: "POST",
        token: ctx.adminToken,
        body: {
          anio_origen: ANIO,
          anio_destino: ANIO_ROLLOVER,
          preview_hash: ctx.rolloverHash,
          confirmar: true,
        },
      });
      const { datos } = await leerJson(respuesta);

      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
      assert.ok(
        Number(datos?.data?.creados) > 0,
        "El confirm no creó ninguna fila de oferta",
      );

      const conteos = await contarAnio(ANIO_ROLLOVER);
      assert.ok(Number(conteos.grados) > 0, "No se clonaron grados");
      assert.ok(Number(conteos.conceptos) > 0, "No se clonaron conceptos");
      assert.ok(Number(conteos.periodos) > 0, "No se clonaron períodos");
      assert.ok(Number(conteos.carga) > 0, "No se clonó carga curricular");
      assert.equal(conteos.alumnos, 0, "El rollover creó alumnos");
      assert.equal(conteos.actas, 0, "El rollover creó actas");
      assert.equal(conteos.horarios, 0, "El rollover creó horarios");
      assert.equal(conteos.pagos, 0, "El rollover creó pagos");

      const anio = await sql(
        `SELECT estado, observacion FROM anios_lectivos WHERE anio = $1`,
        [ANIO_ROLLOVER],
      );
      assert.equal(anio[0]?.estado, "PLANIFICADO", "El destino no quedó PLANIFICADO");
      assert.match(
        String(anio[0]?.observacion || ""),
        /Rollover desde \d{4}/,
        "El destino no guardó la marca del rollover",
      );

      ctx.rolloverConteos = conteos;
      ctx.rolloverCreados = Number(datos.data.creados);

      registrar(
        29,
        "Rollover: confirm clona solo oferta (0 alumnos/actas/horarios/pagos)",
        "PASS",
        `creados=${datos.data.creados}, grados=${conteos.grados}, carga=${conteos.carga}`,
      );
    },
  );

  // 30. Confirmación repetida: idempotente.
  await prueba(
    30,
    "Rollover: repetir confirm es idempotente y no duplica",
    async () => {
      const antes = await contarAnio(ANIO_ROLLOVER);
      const respuesta = await api("/anios-lectivos/rollover", {
        method: "POST",
        token: ctx.adminToken,
        body: {
          anio_origen: ANIO,
          anio_destino: ANIO_ROLLOVER,
          preview_hash: ctx.rolloverHash,
          confirmar: true,
        },
      });
      const { datos } = await leerJson(respuesta);
      const despues = await contarAnio(ANIO_ROLLOVER);

      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
      assert.equal(Number(datos?.data?.creados), 0, "El segundo confirm creó filas");
      assert.ok(
        Number(datos?.data?.existentes) > 0,
        "El segundo confirm no reportó existentes",
      );
      assert.deepEqual(despues, antes, "El segundo confirm duplicó filas");

      registrar(
        30,
        "Rollover: repetir confirm es idempotente y no duplica",
        "PASS",
        `creados=0, existentes=${datos.data.existentes}`,
      );
    },
  );

  // 31. Destino con oferta distinta.
  await prueba(
    31,
    "Rollover: destino con oferta distinta responde 409 con detalle",
    async () => {
      await sql(
        `INSERT INTO grados (nombre_grado, nivel, seccion, anio_lectivo, orden)
         VALUES ('1ro de Secundaria', 'SECUNDARIA', 'Única', $1, 2)`,
        [ANIO_OFERTA_DISTINTA],
      );

      const preview = await api("/anios-lectivos/preview", {
        method: "POST",
        token: ctx.adminToken,
        body: {
          anio_origen: ANIO,
          anio_destino: ANIO_OFERTA_DISTINTA,
        },
      });
      const datosPreview = await leerJson(preview);
      assert.equal(preview.status, 200, detalleHttp(preview, datosPreview));
      assert.ok(
        (datosPreview.datos?.data?.bloqueos || []).some(
          (item) => item.codigo === "OFERTA_DESTINO_DISTINTA",
        ),
        "El preview no detectó la oferta distinta",
      );

      const confirm = await api("/anios-lectivos/rollover", {
        method: "POST",
        token: ctx.adminToken,
        body: {
          anio_origen: ANIO,
          anio_destino: ANIO_OFERTA_DISTINTA,
          preview_hash: datosPreview.datos.data.preview_hash,
          confirmar: true,
        },
      });
      const datosConfirm = await leerJson(confirm);
      assert.equal(
        confirm.status,
        409,
        `El confirm debía responder 409 (${detalleHttp(confirm, datosConfirm)})`,
      );
      assert.ok(
        (datosConfirm.datos?.errors?.bloqueos || []).some(
          (item) =>
            item.codigo === "OFERTA_DESTINO_DISTINTA" &&
            Array.isArray(item.detalle) &&
            item.detalle.length > 0,
        ),
        "El 409 no incluyó el detalle de la oferta distinta",
      );

      await sql(`DELETE FROM grados WHERE anio_lectivo = $1`, [
        ANIO_OFERTA_DISTINTA,
      ]);
      await sql(`DELETE FROM anios_lectivos WHERE anio = $1`, [
        ANIO_OFERTA_DISTINTA,
      ]);

      registrar(
        31,
        "Rollover: destino con oferta distinta responde 409 con detalle",
        "PASS",
        "preview bloqueado y confirm 409",
      );
    },
  );

  // 32. Docente inactivo y sobrecapacidad.
  await prueba(
    32,
    "Rollover: docente inactivo/sobrecapacidad bloquea y no escribe",
    async () => {
      const origen = await sql(
        `SELECT cc.id_carga, cc.id_personal, cc.horas_asignadas, p.id_usuario
         FROM carga_curricular cc
         INNER JOIN personal p ON p.id_personal = cc.id_personal
         WHERE cc.anio_lectivo = $1
         ORDER BY cc.id_carga
         LIMIT 1`,
        [ANIO],
      );
      assert.ok(origen[0], "No hay carga del año origen para la prueba");

      const idCarga = origen[0].id_carga;
      const idUsuario = origen[0].id_usuario;
      const horasOriginales = origen[0].horas_asignadas;

      try {
        await sql(`UPDATE usuarios SET estado = 'INACTIVO' WHERE id_usuario = $1`, [
          idUsuario,
        ]);

        const previewInactivo = await api("/anios-lectivos/preview", {
          method: "POST",
          token: ctx.adminToken,
          body: { anio_origen: ANIO, anio_destino: ANIO_DOCENTE },
        });
        const datosInactivo = await leerJson(previewInactivo);
        assert.equal(
          previewInactivo.status,
          200,
          detalleHttp(previewInactivo, datosInactivo),
        );
        assert.ok(
          (datosInactivo.datos?.data?.bloqueos || []).some(
            (item) => item.codigo === "DOCENTE_INACTIVO",
          ),
          "El preview no bloqueó al docente inactivo",
        );

        const confirmInactivo = await api("/anios-lectivos/rollover", {
          method: "POST",
          token: ctx.adminToken,
          body: {
            anio_origen: ANIO,
            anio_destino: ANIO_DOCENTE,
            preview_hash: datosInactivo.datos.data.preview_hash,
            confirmar: true,
          },
        });
        assert.equal(
          confirmInactivo.status,
          422,
          `El confirm con docente inactivo debía fallar (${confirmInactivo.status})`,
        );

        await sql(`UPDATE usuarios SET estado = 'ACTIVO' WHERE id_usuario = $1`, [
          idUsuario,
        ]);
        await sql(
          `UPDATE carga_curricular SET horas_asignadas = 999 WHERE id_carga = $1`,
          [idCarga],
        );

        const previewSobrecarga = await api("/anios-lectivos/preview", {
          method: "POST",
          token: ctx.adminToken,
          body: { anio_origen: ANIO, anio_destino: ANIO_DOCENTE },
        });
        const datosSobrecarga = await leerJson(previewSobrecarga);
        assert.equal(
          previewSobrecarga.status,
          200,
          detalleHttp(previewSobrecarga, datosSobrecarga),
        );
        assert.ok(
          (datosSobrecarga.datos?.data?.bloqueos || []).some(
            (item) => item.codigo === "DOCENTE_SOBRECAPACIDAD",
          ),
          "El preview no bloqueó la sobrecapacidad",
        );

        const confirmSobrecarga = await api("/anios-lectivos/rollover", {
          method: "POST",
          token: ctx.adminToken,
          body: {
            anio_origen: ANIO,
            anio_destino: ANIO_DOCENTE,
            preview_hash: datosSobrecarga.datos.data.preview_hash,
            confirmar: true,
          },
        });
        assert.equal(
          confirmSobrecarga.status,
          422,
          `El confirm con sobrecapacidad debía fallar (${confirmSobrecarga.status})`,
        );

        const conteos = await contarAnio(ANIO_DOCENTE);
        assert.equal(conteos.anio, 0, "Se creó el año destino tras un bloqueo");
        assert.equal(conteos.grados, 0, "Se crearon grados tras un bloqueo");
      } finally {
        await sql(`UPDATE usuarios SET estado = 'ACTIVO' WHERE id_usuario = $1`, [
          idUsuario,
        ]);
        await sql(
          `UPDATE carga_curricular SET horas_asignadas = $1 WHERE id_carga = $2`,
          [horasOriginales, idCarga],
        );
        await limpiarAnioRollover(ANIO_DOCENTE);
      }

      registrar(
        32,
        "Rollover: docente inactivo/sobrecapacidad bloquea y no escribe",
        "PASS",
        "2 bloqueos, confirm 422",
      );
    },
  );

  // 33. Hash viejo.
  await prueba(
    33,
    "Rollover: hash viejo responde 409 PREVIEW_DESACTUALIZADA",
    async () => {
      const preview = await api("/anios-lectivos/preview", {
        method: "POST",
        token: ctx.adminToken,
        body: { anio_origen: ANIO, anio_destino: ANIO_HASH },
      });
      const datosPreview = await leerJson(preview);
      assert.equal(preview.status, 200, detalleHttp(preview, datosPreview));
      const hashViejo = datosPreview.datos.data.preview_hash;

      try {
        await sql(
          `UPDATE conceptos_pago
           SET monto_base = monto_base + 1
           WHERE anio_lectivo = $1 AND tipo = 'MATRICULA'`,
          [ANIO],
        );

        const confirm = await api("/anios-lectivos/rollover", {
          method: "POST",
          token: ctx.adminToken,
          body: {
            anio_origen: ANIO,
            anio_destino: ANIO_HASH,
            preview_hash: hashViejo,
            confirmar: true,
          },
        });
        const datosConfirm = await leerJson(confirm);
        assert.equal(
          confirm.status,
          409,
          `El hash viejo debía responder 409 (${detalleHttp(confirm, datosConfirm)})`,
        );
        assert.equal(
          datosConfirm.datos?.errors?.codigo,
          "PREVIEW_DESACTUALIZADA",
          "El 409 no indicó PREVIEW_DESACTUALIZADA",
        );
      } finally {
        await sql(
          `UPDATE conceptos_pago
           SET monto_base = monto_base - 1
           WHERE anio_lectivo = $1 AND tipo = 'MATRICULA'`,
          [ANIO],
        );
        await limpiarAnioRollover(ANIO_HASH);
      }

      registrar(
        33,
        "Rollover: hash viejo responde 409 PREVIEW_DESACTUALIZADA",
        "PASS",
        "409 PREVIEW_DESACTUALIZADA",
      );
    },
  );

  // 34. Activación auditada y caché.
  await prueba(
    34,
    "Activación: un solo ACTIVO, cierra el anterior y actualiza caché",
    async () => {
      const respuesta = await api(
        `/anios-lectivos/${ANIO_ROLLOVER}/activar`,
        {
          method: "PUT",
          token: ctx.adminToken,
          body: { confirmar: true },
        },
      );
      const { datos } = await leerJson(respuesta);
      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
      assert.equal(Number(datos?.data?.anio), ANIO_ROLLOVER);
      assert.equal(
        Number(datos?.data?.anterior),
        ANIO_DESTINO,
        "No se reportó el año anterior",
      );

      const estados = await sql(
        `SELECT anio, estado, cerrado_por, fecha_cierre
         FROM anios_lectivos
         WHERE anio IN ($1, $2)
         ORDER BY anio`,
        [ANIO_DESTINO, ANIO_ROLLOVER],
      );
      const activos = estados.filter((fila) => fila.estado === "ACTIVO");
      const anterior = estados.find(
        (fila) => Number(fila.anio) === ANIO_DESTINO,
      );
      const nuevo = estados.find(
        (fila) => Number(fila.anio) === ANIO_ROLLOVER,
      );

      assert.equal(activos.length, 1, "Debe quedar exactamente un año ACTIVO");
      assert.equal(Number(activos[0].anio), ANIO_ROLLOVER);
      assert.equal(anterior?.estado, "CERRADO", "El año anterior no se cerró");
      assert.ok(anterior?.cerrado_por, "No se registró cerrado_por");
      assert.ok(anterior?.fecha_cierre, "No se registró fecha_cierre");
      assert.equal(nuevo?.estado, "ACTIVO", "El año nuevo no quedó ACTIVO");

      const config = await api("/configuracion");
      const datosConfig = await leerJson(config);
      assert.equal(config.status, 200, detalleHttp(config, datosConfig));
      assert.equal(
        Number(datosConfig.datos?.data?.anio_lectivo),
        ANIO_ROLLOVER,
        "La caché del año activo no se actualizó",
      );

      const auditoria = await sql(
        `SELECT id_bitacora, valor_anterior, valor_nuevo
         FROM bitacora_auditoria
         WHERE modulo_afectado = 'Años Lectivos'
           AND accion = 'ACTIVAR'
           AND valor_nuevo->>'anio' = $1
         ORDER BY id_bitacora DESC
         LIMIT 1`,
        [String(ANIO_ROLLOVER)],
      );
      assert.ok(auditoria[0], "No se auditó la activación");

      registrar(
        34,
        "Activación: un solo ACTIVO, cierra el anterior y actualiza caché",
        "PASS",
        `${ANIO_DESTINO} CERRADO, ${ANIO_ROLLOVER} ACTIVO, auditoría OK`,
      );
    },
  );

  // 35. Activación sin oferta mínima.
  await prueba(
    35,
    "Activación: sin grados o sin MATRICULA se bloquea",
    async () => {
      await sql(
        `INSERT INTO anios_lectivos (anio, estado) VALUES ($1, 'PLANIFICADO')`,
        [ANIO_SIN_OFERTA],
      );

      const sinGrados = await api(
        `/anios-lectivos/${ANIO_SIN_OFERTA}/activar`,
        {
          method: "PUT",
          token: ctx.adminToken,
          body: { confirmar: true },
        },
      );
      const datosSinGrados = await leerJson(sinGrados);
      assert.equal(
        sinGrados.status,
        422,
        detalleHttp(sinGrados, datosSinGrados),
      );
      assert.equal(
        datosSinGrados.datos?.errors?.codigo,
        "ANIO_SIN_GRADOS",
        "El bloqueo no indicó ANIO_SIN_GRADOS",
      );

      await sql(
        `INSERT INTO grados (nombre_grado, nivel, seccion, anio_lectivo, orden)
         VALUES ('1ro de Secundaria', 'SECUNDARIA', 'Única', $1, 1)`,
        [ANIO_SIN_OFERTA],
      );

      const sinMatricula = await api(
        `/anios-lectivos/${ANIO_SIN_OFERTA}/activar`,
        {
          method: "PUT",
          token: ctx.adminToken,
          body: { confirmar: true },
        },
      );
      const datosSinMatricula = await leerJson(sinMatricula);
      assert.equal(
        sinMatricula.status,
        422,
        detalleHttp(sinMatricula, datosSinMatricula),
      );
      assert.equal(
        datosSinMatricula.datos?.errors?.codigo,
        "ANIO_SIN_MATRICULA",
        "El bloqueo no indicó ANIO_SIN_MATRICULA",
      );

      const activos = await sql(
        `SELECT COUNT(*)::int AS total FROM anios_lectivos WHERE estado = 'ACTIVO'`,
      );
      assert.equal(activos[0].total, 1, "La activación fallida cambió el año activo");

      await limpiarAnioRollover(ANIO_SIN_OFERTA);

      registrar(
        35,
        "Activación: sin grados o sin MATRICULA se bloquea",
        "PASS",
        "422 ANIO_SIN_GRADOS y ANIO_SIN_MATRICULA",
      );
    },
  );

  // 36. Reversión.
  await prueba(
    36,
    "Reversión: borra oferta vacía y rechaza un año con actividad",
    async () => {
      const preview = await api("/anios-lectivos/preview", {
        method: "POST",
        token: ctx.adminToken,
        body: { anio_origen: ANIO, anio_destino: ANIO_REVERSION },
      });
      const datosPreview = await leerJson(preview);
      assert.equal(preview.status, 200, detalleHttp(preview, datosPreview));
      assert.equal(
        datosPreview.datos?.data?.bloqueos?.length,
        0,
        `El preview de reversión no debía bloquear: ${JSON.stringify(
          datosPreview.datos?.data?.bloqueos,
        )}`,
      );

      const confirm = await api("/anios-lectivos/rollover", {
        method: "POST",
        token: ctx.adminToken,
        body: {
          anio_origen: ANIO,
          anio_destino: ANIO_REVERSION,
          preview_hash: datosPreview.datos.data.preview_hash,
          confirmar: true,
        },
      });
      const datosConfirm = await leerJson(confirm);
      assert.equal(confirm.status, 200, detalleHttp(confirm, datosConfirm));

      const alumno = await sql(
        `INSERT INTO alumnos (
           id_usuario, dni, nombres, apellidos, fecha_nacimiento,
           id_apoderado, id_grado, condicion, estado_matricula,
           codigo_estudiante, anio_lectivo
         )
         SELECT a.id_usuario, a.dni, a.nombres, a.apellidos, a.fecha_nacimiento,
                a.id_apoderado, g.id_grado, a.condicion, 'Matriculado',
                a.codigo_estudiante, $1
         FROM alumnos a
         CROSS JOIN (
           SELECT id_grado
           FROM grados
           WHERE anio_lectivo = $1
           ORDER BY orden
           LIMIT 1
         ) g
         WHERE a.anio_lectivo = $2
         ORDER BY a.id_alumno
         LIMIT 1
         RETURNING id_alumno`,
        [ANIO_REVERSION, ANIO],
      );
      assert.ok(alumno[0]?.id_alumno, "No se pudo crear la actividad de prueba");

      const conActividad = await api(
        `/anios-lectivos/${ANIO_REVERSION}/rollover`,
        {
          method: "DELETE",
          token: ctx.adminToken,
          body: {
            motivo: "Reversión de prueba E2E con actividad",
            confirmar: true,
          },
        },
      );
      const datosConActividad = await leerJson(conActividad);
      assert.equal(
        conActividad.status,
        409,
        `La reversión con actividad debía fallar (${detalleHttp(
          conActividad,
          datosConActividad,
        )})`,
      );
      assert.equal(
        datosConActividad.datos?.errors?.codigo,
        "ANIO_CON_ACTIVIDAD",
        "El 409 no indicó ANIO_CON_ACTIVIDAD",
      );

      await sql(`DELETE FROM alumnos WHERE id_alumno = $1`, [
        alumno[0].id_alumno,
      ]);

      const revertir = await api(
        `/anios-lectivos/${ANIO_REVERSION}/rollover`,
        {
          method: "DELETE",
          token: ctx.adminToken,
          body: {
            motivo: "Reversión de prueba E2E sin actividad",
            confirmar: true,
          },
        },
      );
      const datosRevertir = await leerJson(revertir);
      assert.equal(
        revertir.status,
        200,
        detalleHttp(revertir, datosRevertir),
      );
      assert.equal(
        datosRevertir.datos?.data?.anio_eliminado,
        true,
        "No se eliminó el año creado por el rollover",
      );

      const conteos = await contarAnio(ANIO_REVERSION);
      assert.equal(conteos.anio, 0, "El año revertido sigue en el catálogo");
      assert.equal(conteos.grados, 0, "Quedaron grados tras la reversión");
      assert.equal(conteos.conceptos, 0, "Quedaron conceptos tras la reversión");
      assert.equal(conteos.periodos, 0, "Quedaron períodos tras la reversión");
      assert.equal(conteos.carga, 0, "Quedó carga tras la reversión");
      assert.equal(conteos.tutores, 0, "Quedaron tutores tras la reversión");

      const auditoria = await sql(
        `SELECT id_bitacora
         FROM bitacora_auditoria
         WHERE modulo_afectado = 'Años Lectivos'
           AND accion = 'REVERTIR_ROLLOVER'
           AND valor_anterior->>'anio' = $1
         ORDER BY id_bitacora DESC
         LIMIT 1`,
        [String(ANIO_REVERSION)],
      );
      assert.ok(auditoria[0], "No se auditó la reversión");

      registrar(
        36,
        "Reversión: borra oferta vacía y rechaza un año con actividad",
        "PASS",
        "409 con actividad, reversión y auditoría OK",
      );
    },
  );

  // 37. RBAC del módulo.
  await prueba(
    37,
    "RBAC: ADMIN/SECRETARIA 200 en lectura y escritura solo ADMIN",
    async () => {
      const admin = await api("/anios-lectivos", { token: ctx.adminToken });
      const datosAdmin = await leerJson(admin);
      assert.equal(admin.status, 200, detalleHttp(admin, datosAdmin));
      assert.ok(
        Array.isArray(datosAdmin.datos?.data),
        "El catálogo no devolvió una lista",
      );

      const docente = await iniciarSesion(
        "DOCENTE",
        credenciales.DOCENTE[0],
        credenciales.DOCENTE[1],
      );
      const respuestaDocente = await api("/anios-lectivos", {
        token: docente.token,
      });
      assert.equal(respuestaDocente.status, 403);

      const secre = await sql(
        `INSERT INTO usuarios (
           dni, nombres, apellidos, correo_institucional, password_hash,
           id_rol, estado, requiere_cambio_password
         )
         VALUES (
           '99999097', 'Secretaria', 'E2E', 'secretaria.e2e@example.com',
           crypt('99999097', gen_salt('bf', 10)), 3, 'ACTIVO', FALSE
         )
         RETURNING id_usuario`,
      );

      try {
        const sesion = await iniciarSesion(
          "SECRETARIA",
          "99999097",
          "99999097",
        );
        const respuestaSecre = await api("/anios-lectivos", {
          token: sesion.token,
        });
        assert.equal(
          respuestaSecre.status,
          200,
          "SECRETARIA debe leer el catálogo de años (6.4)",
        );

        const escrituraSecre = await api("/anios-lectivos/preview", {
          method: "POST",
          token: sesion.token,
          body: { anio_origen: ANIO, anio_destino: ANIO_DESTINO },
        });
        assert.equal(
          escrituraSecre.status,
          403,
          "SECRETARIA no debe ejecutar escrituras de años",
        );
      } finally {
        await sql(`DELETE FROM usuarios WHERE id_usuario = $1`, [
          secre[0].id_usuario,
        ]);
      }

      const sinToken = await api("/anios-lectivos");
      assert.equal(sinToken.status, 401);

      registrar(
        37,
        "RBAC: ADMIN/SECRETARIA 200 en lectura y escritura solo ADMIN",
        "PASS",
        "ADMIN 200, DOCENTE 403, SECRETARIA 200/403, sin token 401",
      );
    },
  );

  // 38. Rollback completo ante un fallo en la última etapa.
  await prueba(
    38,
    "Rollover: fallo forzado en tutores no deja filas parciales",
    async () => {
      await sql(`
        CREATE OR REPLACE FUNCTION e2e_fallo_tutor()
        RETURNS trigger AS $$
        BEGIN
          IF NEW.anio_lectivo = ${Number(ANIO_ROLLBACK)} THEN
            RAISE EXCEPTION 'Fallo forzado E2E en tutores_grado';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await sql(`DROP TRIGGER IF EXISTS e2e_fallo_tutor ON tutores_grado`);
      await sql(`
        CREATE TRIGGER e2e_fallo_tutor
        BEFORE INSERT ON tutores_grado
        FOR EACH ROW EXECUTE FUNCTION e2e_fallo_tutor()
      `);

      try {
        const preview = await api("/anios-lectivos/preview", {
          method: "POST",
          token: ctx.adminToken,
          body: { anio_origen: ANIO, anio_destino: ANIO_ROLLBACK },
        });
        const datosPreview = await leerJson(preview);
        assert.equal(preview.status, 200, detalleHttp(preview, datosPreview));
        assert.equal(
          datosPreview.datos?.data?.bloqueos?.length,
          0,
          "El preview de rollback no debía bloquear",
        );

        const confirm = await api("/anios-lectivos/rollover", {
          method: "POST",
          token: ctx.adminToken,
          body: {
            anio_origen: ANIO,
            anio_destino: ANIO_ROLLBACK,
            preview_hash: datosPreview.datos.data.preview_hash,
            confirmar: true,
          },
        });
        assert.ok(
          confirm.status >= 500,
          `El fallo forzado debía responder 5xx (HTTP ${confirm.status})`,
        );

        const conteos = await contarAnio(ANIO_ROLLBACK);
        assert.equal(conteos.anio, 0, "Quedó el año destino tras el rollback");
        assert.equal(conteos.grados, 0, "Quedaron grados tras el rollback");
        assert.equal(conteos.conceptos, 0, "Quedaron conceptos tras el rollback");
        assert.equal(conteos.periodos, 0, "Quedaron períodos tras el rollback");
        assert.equal(conteos.carga, 0, "Quedó carga tras el rollback");
      } finally {
        await sql(`DROP TRIGGER IF EXISTS e2e_fallo_tutor ON tutores_grado`);
        await sql(`DROP FUNCTION IF EXISTS e2e_fallo_tutor()`);
        await limpiarAnioRollover(ANIO_ROLLBACK);
      }

      registrar(
        38,
        "Rollover: fallo forzado en tutores no deja filas parciales",
        "PASS",
        "5xx y 0 filas parciales",
      );
    },
  );

  // ============================================================
  // FASE 6.3 — PROMOCIÓN DE ALUMNOS (H73)
  // ============================================================
  const ANIO_PROMO_NORMAL = ANIO + 9; // 2035
  const ANIO_PROMO_EGRESADO = ANIO + 10; // 2036
  const ANIO_PROMO_REPITENTE = ANIO + 11; // 2037
  const ANIO_PROMO_RETIRADO = ANIO + 12; // 2038
  const ANIO_PROMO_BLOQUEO = ANIO + 13; // 2039
  const ANIO_PROMO_ASISTENCIA = ANIO + 14; // 2040
  const ANIO_PROMO_ANULAR = ANIO + 15; // 2041
  const ANIO_PROMO_ACTIVIDAD = ANIO + 16; // 2042
  const ANIO_PROMO_ROLLBACK = ANIO + 17; // 2043

  const crearOfertaPromocion = async (anio) => {
    await sql(
      `INSERT INTO anios_lectivos (anio, estado)
       VALUES ($1, 'PLANIFICADO')
       ON CONFLICT (anio) DO NOTHING`,
      [anio],
    );

    const nombres = [
      "1ro de Secundaria",
      "2do de Secundaria",
      "3ro de Secundaria",
      "4to de Secundaria",
      "5to de Secundaria",
    ];
    for (let i = 0; i < nombres.length; i += 1) {
      await sql(
        `INSERT INTO grados (nombre_grado, nivel, seccion, anio_lectivo, orden)
         VALUES ($1, 'SECUNDARIA', 'Única', $2, $3)
         ON CONFLICT (nombre_grado, seccion, anio_lectivo) DO NOTHING`,
        [nombres[i], anio, i + 1],
      );
    }

    await sql(
      `INSERT INTO conceptos_pago (nombre, monto_base, tipo, mes, anio_lectivo)
       SELECT $1, 250.00, 'MATRICULA', NULL, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM conceptos_pago
         WHERE anio_lectivo = $2 AND tipo = 'MATRICULA'
       )`,
      [`Matrícula Escolar ${anio}`, anio],
    );

    return await sql(
      `SELECT id_grado, nombre_grado, seccion, orden
       FROM grados
       WHERE anio_lectivo = $1
       ORDER BY orden`,
      [anio],
    );
  };

  const crearPoliticaE2E = async (anioDestino, overrides = {}, anioOrigen = ANIO) => {
    const body = {
      anio_origen: anioOrigen,
      anio_destino: anioDestino,
      nombre: `E2E ${anioOrigen} ${anioDestino}`,
      activo: true,
      requiere_actas_cerradas: false,
      requiere_notas_finales: false,
      umbral_asistencia: null,
      permite_override: false,
      criterio_academico: {
        modo: "manual",
        modo_repitencia: "DESACTIVADA",
        notas_bimestres: [1],
        bimestres_requeridos: [1, 2, 3, 4],
        transiciones: [],
        observacion: "Política E2E",
      },
      ...overrides,
    };

    const respuesta = await api("/promociones/politicas", {
      method: "POST",
      token: ctx.adminToken,
      body,
    });
    const { datos } = await leerJson(respuesta);
    assert.equal(
      respuesta.status,
      201,
      `No se pudo crear la política ${anioDestino} (${detalleHttp(
        respuesta,
        datos,
      )})`,
    );
    return datos.data;
  };

  const crearAlumnoPromocionAux = async ({
    dni,
    nombres,
    apellidos,
    idGrado,
    anio,
    estado = "Matriculado",
    condicion = "Regular",
  }) => {
    const usuario = await sql(
      `INSERT INTO usuarios (
         dni, nombres, apellidos, correo_institucional, password_hash,
         id_rol, estado, requiere_cambio_password
       )
       VALUES ($1::text, $2, $3, $4, crypt($1::text, gen_salt('bf', 10)),
               4, 'ACTIVO', FALSE)
       RETURNING id_usuario`,
      [dni, nombres, apellidos, `aux.${dni}@e2e.local`],
    );
    const alumno = await sql(
      `INSERT INTO alumnos (
         id_usuario, dni, nombres, apellidos, fecha_nacimiento,
         id_apoderado, id_grado, condicion, estado_matricula,
         codigo_estudiante, anio_lectivo
       )
       VALUES ($1, $2, $3, $4, '2012-05-10', NULL, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        usuario[0].id_usuario,
        dni,
        nombres,
        apellidos,
        idGrado,
        condicion,
        estado,
        `AUX-${dni.slice(-4)}`,
        anio,
      ],
    );
    return {
      ...alumno[0],
      id_usuario: Number(usuario[0].id_usuario),
    };
  };

  const previsualizarPromocion = async (body) => {
    const respuesta = await api("/promociones/preview", {
      method: "POST",
      token: ctx.adminToken,
      body,
    });
    const { datos } = await leerJson(respuesta);
    return { respuesta, datos, preview: datos?.data };
  };

  const confirmarPromocion = async (preview, extra = {}) => {
    const respuesta = await api("/promociones/confirmar", {
      method: "POST",
      token: ctx.adminToken,
      body: {
        anio_origen: preview.anio_origen,
        anio_destino: preview.anio_destino,
        id_politica: preview.id_politica,
        id_grado: preview.id_grado,
        incluir_retirados: preview.incluir_retirados,
        decisiones: extra.decisiones || [],
        copiar_becas: Boolean(extra.copiar_becas),
        preview_hash: extra.preview_hash || preview.preview_hash,
        confirmar: true,
      },
    });
    const { datos } = await leerJson(respuesta);
    return { respuesta, datos, resultado: datos?.data };
  };

  const contarDestinoPromocion = async (anio) => {
    const filas = await sql(
      `SELECT
         (SELECT COUNT(*)::int FROM alumnos WHERE anio_lectivo = $1) AS alumnos,
         (SELECT COUNT(*)::int FROM promociones WHERE anio_destino = $1) AS promociones,
         (SELECT COUNT(*)::int FROM promociones
           WHERE anio_destino = $1 AND estado = 'CONFIRMADA') AS confirmadas,
         (SELECT COUNT(*)::int FROM pre_tickets pt
           INNER JOIN alumnos a ON a.id_alumno = pt.id_alumno
           WHERE a.anio_lectivo = $1) AS pretickets`,
      [anio],
    );
    return filas[0];
  };

  const gradoOrden = async (anio, orden) => {
    const filas = await sql(
      `SELECT id_grado, nombre_grado, seccion, orden
       FROM grados
       WHERE anio_lectivo = $1 AND orden = $2
       LIMIT 1`,
      [anio, orden],
    );
    return filas[0] || null;
  };

  // 39. Política: permite_override por defecto y validación.
  await prueba(
    39,
    "Promoción: política permite_override=false por defecto y valida años",
    async () => {
      await crearOfertaPromocion(ANIO_PROMO_NORMAL);
      const politica = await crearPoliticaE2E(ANIO_PROMO_NORMAL);

      assert.equal(
        politica.permite_override,
        false,
        "permite_override debía ser false por defecto",
      );
      assert.equal(Number(politica.anio_origen), ANIO);
      assert.equal(Number(politica.anio_destino), ANIO_PROMO_NORMAL);

      const invalida = await api("/promociones/politicas", {
        method: "POST",
        token: ctx.adminToken,
        body: {
          anio_origen: ANIO,
          anio_destino: ANIO,
          nombre: "E2E inválida",
          criterio_academico: {},
        },
      });
      const datosInvalida = await leerJson(invalida);
      assert.equal(
        invalida.status,
        400,
        `La política con destino igual al origen debía fallar (${detalleHttp(
          invalida,
          datosInvalida,
        )})`,
      );

      ctx.politicaPromoNormal = politica;

      registrar(
        39,
        "Promoción: política permite_override=false por defecto y valida años",
        "PASS",
        `política=${politica.id_politica}, override=false, 400`,
      );
    },
  );

  // 40. Preview normal sin escrituras.
  await prueba(
    40,
    "Promoción: preview normal no escribe y devuelve hash",
    async () => {
      const antes = await contarDestinoPromocion(ANIO_PROMO_NORMAL);
      const { respuesta, datos, preview } = await previsualizarPromocion({
        anio_origen: ANIO,
        anio_destino: ANIO_PROMO_NORMAL,
        id_politica: ctx.politicaPromoNormal.id_politica,
        id_grado: 1,
        incluir_retirados: false,
      });
      const despues = await contarDestinoPromocion(ANIO_PROMO_NORMAL);

      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
      assert.ok(preview, "El preview no devolvió data");
      assert.match(preview.preview_hash, /^[a-f0-9]{64}$/);
      assert.ok(preview.resumen.total > 0, "El preview no incluyó alumnos");
      assert.equal(preview.resumen.bloqueados, 0, "El preview no debía bloquear");
      assert.equal(preview.resumen.ya_confirmadas, 0);
      assert.deepEqual(despues, antes, "El preview escribió en el destino");

      ctx.previewPromoNormal = preview;

      registrar(
        40,
        "Promoción: preview normal no escribe y devuelve hash",
        "PASS",
        `alumnos=${preview.resumen.total}, hash=${preview.preview_hash.slice(0, 10)}…`,
      );
    },
  );

  // 41. Confirmación normal.
  await prueba(
    41,
    "Promoción: confirm crea matrícula, expediente y pre-ticket sin copiar actividad",
    async () => {
      const preview = ctx.previewPromoNormal;
      const { respuesta, datos, resultado } = await confirmarPromocion(preview);

      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
      assert.ok(resultado.creados > 0, "El confirm no creó promociones");
      assert.equal(resultado.ya_confirmada, false);

      const gradoDestino = await gradoOrden(ANIO_PROMO_NORMAL, 2);
      assert.ok(gradoDestino, "No existe 2do grado en el destino");

      const destino = await sql(
        `SELECT a.id_alumno, a.id_usuario, a.dni, a.codigo_estudiante,
                a.estado_matricula, a.id_grado, g.orden,
                a2.codigo_estudiante AS codigo_origen
         FROM alumnos a
         INNER JOIN grados g ON g.id_grado = a.id_grado
         INNER JOIN alumnos a2
           ON a2.id_usuario = a.id_usuario AND a2.anio_lectivo = $2
         WHERE a.anio_lectivo = $1 AND g.orden = 2`,
        [ANIO_PROMO_NORMAL, ANIO],
      );

      assert.equal(
        destino.length,
        preview.resumen.total,
        "El número de matrículas destino no coincide con el preview",
      );
      for (const alumno of destino) {
        assert.equal(alumno.estado_matricula, "PendientePago");
        assert.equal(Number(alumno.id_grado), Number(gradoDestino.id_grado));
        assert.equal(
          alumno.codigo_estudiante,
          alumno.codigo_origen,
          "El código de estudiante no se conservó",
        );
      }

      const actividad = await sql(
        `SELECT
           (SELECT COUNT(*)::int FROM expediente_alumno e
             INNER JOIN alumnos a ON a.id_alumno = e.id_alumno
             WHERE a.anio_lectivo = $1) AS expedientes,
           (SELECT COUNT(*)::int FROM pre_tickets pt
             INNER JOIN alumnos a ON a.id_alumno = pt.id_alumno
             WHERE a.anio_lectivo = $1 AND pt.estado = 'PENDIENTE') AS pretickets,
           (SELECT COUNT(*)::int FROM pensiones pe
             INNER JOIN alumnos a ON a.id_alumno = pe.id_alumno
             WHERE a.anio_lectivo = $1) AS pensiones,
           (SELECT COUNT(*)::int FROM pagos p
             INNER JOIN alumnos a ON a.id_alumno = p.id_alumno
             WHERE a.anio_lectivo = $1) AS pagos,
           (SELECT COUNT(*)::int FROM notas_finales_area nf
             INNER JOIN alumnos a ON a.id_alumno = nf.id_alumno
             WHERE a.anio_lectivo = $1) AS notas,
           (SELECT COUNT(*)::int FROM calificaciones c
             INNER JOIN alumnos a ON a.id_alumno = c.id_alumno
             WHERE a.anio_lectivo = $1) AS calificaciones`,
        [ANIO_PROMO_NORMAL],
      );

      assert.equal(actividad[0].expedientes, destino.length);
      assert.equal(actividad[0].pretickets, destino.length);
      assert.equal(actividad[0].pensiones, 0, "Se copiaron pensiones");
      assert.equal(actividad[0].pagos, 0, "Se copiaron pagos");
      assert.equal(actividad[0].notas, 0, "Se copiaron notas");
      assert.equal(actividad[0].calificaciones, 0, "Se copiaron calificaciones");

      ctx.promociones2035 = resultado.promociones;
      ctx.destino2035 = destino;

      registrar(
        41,
        "Promoción: confirm crea matrícula, expediente y pre-ticket sin copiar actividad",
        "PASS",
        `creados=${resultado.creados}, PendientePago, 0 actividad copiada`,
      );
    },
  );

  // 42. Egresado de 5to.
  await prueba(
    42,
    "Promoción: 5to de secundaria queda EGRESADO sin matrícula destino",
    async () => {
      await crearOfertaPromocion(ANIO_PROMO_EGRESADO);
      const politica = await crearPoliticaE2E(ANIO_PROMO_EGRESADO);
      const { respuesta, datos, preview } = await previsualizarPromocion({
        anio_origen: ANIO,
        anio_destino: ANIO_PROMO_EGRESADO,
        id_politica: politica.id_politica,
        id_grado: 5,
        incluir_retirados: false,
      });
      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
      assert.ok(preview.resumen.total > 0, "No hay alumnos de 5to");
      assert.ok(
        preview.alumnos.every(
          (alumno) => alumno.resultado_sugerido === "EGRESADO",
        ),
        "El preview no marcó a todos como EGRESADO",
      );

      const { respuesta: rConfirm, datos: dConfirm, resultado } =
        await confirmarPromocion(preview);
      assert.equal(rConfirm.status, 200, detalleHttp(rConfirm, dConfirm));
      assert.ok(resultado.creados > 0);

      const filas = await sql(
        `SELECT p.resultado, p.id_alumno_destino
         FROM promociones p
         WHERE p.anio_destino = $1 AND p.estado = 'CONFIRMADA'`,
        [ANIO_PROMO_EGRESADO],
      );
      assert.ok(filas.length > 0);
      assert.ok(
        filas.every(
          (fila) =>
            fila.resultado === "EGRESADO" && fila.id_alumno_destino === null,
        ),
        "Hay egresados con matrícula destino",
      );

      const conteos = await contarDestinoPromocion(ANIO_PROMO_EGRESADO);
      assert.equal(conteos.alumnos, 0, "Se creó matrícula para egresados");

      registrar(
        42,
        "Promoción: 5to de secundaria queda EGRESADO sin matrícula destino",
        "PASS",
        `egresados=${filas.length}, 0 matrículas`,
      );
    },
  );

  // 43. Repitente por política de umbral.
  await prueba(
    43,
    "Promoción: repitente por política queda en el mismo grado",
    async () => {
      await crearOfertaPromocion(ANIO_PROMO_REPITENTE);
      const gradoOrigen = await gradoOrden(ANIO, 2);
      assert.ok(gradoOrigen, "No existe 2do grado en el origen");

      const candidato = await sql(
        `SELECT a.id_alumno, cc.id_curso
         FROM alumnos a
         CROSS JOIN (
           SELECT cc.id_curso
           FROM carga_curricular cc
           WHERE cc.anio_lectivo = $1 AND cc.id_grado = $2
           ORDER BY cc.id_curso
           LIMIT 1
         ) cc
         WHERE a.anio_lectivo = $1
           AND a.id_grado = $2
           AND a.estado_matricula = 'Matriculado'
         ORDER BY a.id_alumno
         LIMIT 1`,
        [ANIO, gradoOrigen.id_grado],
      );
      assert.ok(candidato[0], "No hay alumno de 2do para la prueba");

      await sql(
        `INSERT INTO notas_finales_area
           (id_alumno, id_curso, bimestre, anio_lectivo, nota_final, calculo_automatico)
         VALUES ($1, $2, 1, $3, 'C', false)
         ON CONFLICT (id_alumno, id_curso, bimestre, anio_lectivo)
         DO UPDATE SET nota_final = 'C'`,
        [candidato[0].id_alumno, candidato[0].id_curso, ANIO],
      );

      const politica = await crearPoliticaE2E(ANIO_PROMO_REPITENTE, {
        permite_override: true,
        criterio_academico: {
          modo: "manual",
          modo_repitencia: "UMBRAL",
          notas_bimestres: [1],
          bimestres_requeridos: [1, 2, 3, 4],
          min_cursos_desaprobados: 1,
          notas_desaprobadas: ["C"],
          transiciones: [],
          observacion: "Repitencia E2E",
        },
      });

      const { respuesta, datos, preview } = await previsualizarPromocion({
        anio_origen: ANIO,
        anio_destino: ANIO_PROMO_REPITENTE,
        id_politica: politica.id_politica,
        id_grado: gradoOrigen.id_grado,
        incluir_retirados: false,
      });
      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));

      const fila = preview.alumnos.find(
        (alumno) =>
          Number(alumno.id_alumno_origen) === Number(candidato[0].id_alumno),
      );
      assert.ok(fila, "El alumno con nota C no apareció en el preview");
      assert.equal(fila.resultado_sugerido, "REPITENTE");

      const gradoRepitente = await gradoOrden(ANIO_PROMO_REPITENTE, 2);
      assert.equal(
        Number(fila.id_grado_destino),
        Number(gradoRepitente.id_grado),
      );

      const { respuesta: rConfirm, datos: dConfirm } =
        await confirmarPromocion(preview);
      assert.equal(rConfirm.status, 200, detalleHttp(rConfirm, dConfirm));

      const promocion = await sql(
        `SELECT resultado, id_grado_destino
         FROM promociones
         WHERE anio_destino = $1
           AND id_alumno_origen = $2
           AND estado = 'CONFIRMADA'
         LIMIT 1`,
        [ANIO_PROMO_REPITENTE, candidato[0].id_alumno],
      );
      assert.equal(promocion[0]?.resultado, "REPITENTE");
      assert.equal(
        Number(promocion[0]?.id_grado_destino),
        Number(gradoRepitente.id_grado),
      );

      registrar(
        43,
        "Promoción: repitente por política queda en el mismo grado",
        "PASS",
        `alumno=${candidato[0].id_alumno}, grado=${gradoRepitente.orden}`,
      );
    },
  );

  // 44. Retirado / traslado (origen auxiliar 2025 → 2026).
  await prueba(
    44,
    "Promoción: retirado/traslado queda RETIRADO sin matrícula destino",
    async () => {
      const anioAux = ANIO - 1; // 2025
      await crearOfertaPromocion(anioAux);
      const gradoAux = await gradoOrden(anioAux, 1);
      assert.ok(gradoAux, "No existe 1ro en el año auxiliar");

      const alumnoAux = await crearAlumnoPromocionAux({
        dni: "99999101",
        nombres: "Retirado",
        apellidos: "Traslado E2E",
        idGrado: gradoAux.id_grado,
        anio: anioAux,
        estado: "Retirado",
        condicion: "Traslado",
      });

      const politica = await crearPoliticaE2E(
        ANIO,
        { nombre: "E2E 2025 retiro" },
        anioAux,
      );

      const { respuesta, datos, preview } = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: true,
      });
      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));

      const fila = preview.alumnos.find(
        (alumno) => String(alumno.dni) === "99999101",
      );
      assert.ok(fila, "El alumno trasladado no apareció en el preview");
      assert.equal(fila.resultado_sugerido, "RETIRADO");
      assert.equal(fila.id_grado_destino, null);
      assert.equal(fila.bloqueado, false);

      const { respuesta: rConfirm, datos: dConfirm } =
        await confirmarPromocion(preview);
      assert.equal(rConfirm.status, 200, detalleHttp(rConfirm, dConfirm));

      const promocion = await sql(
        `SELECT resultado, id_alumno_destino, metadata
         FROM promociones
         WHERE anio_destino = $1
           AND id_alumno_origen = $2
           AND estado = 'CONFIRMADA'
         LIMIT 1`,
        [ANIO, alumnoAux.id_alumno],
      );
      assert.equal(promocion[0]?.resultado, "RETIRADO");
      assert.equal(promocion[0]?.id_alumno_destino, null);
      assert.equal(
        promocion[0]?.metadata?.retiro?.motivo,
        "TRASLADO",
        "La metadata no registró el traslado",
      );

      const destino = await sql(
        `SELECT COUNT(*)::int AS total
         FROM alumnos
         WHERE anio_lectivo = $1 AND dni = '99999101'`,
        [ANIO],
      );
      assert.equal(destino[0].total, 0);

      registrar(
        44,
        "Promoción: retirado/traslado queda RETIRADO sin matrícula destino",
        "PASS",
        `origen=${alumnoAux.id_alumno}, metadata=TRASLADO`,
      );
    },
  );

  // 45. Bloqueo por actas/notas y override auditado.
  await prueba(
    45,
    "Promoción: bloqueo por actas/notas y override con motivo",
    async () => {
      await crearOfertaPromocion(ANIO_PROMO_BLOQUEO);
      const gradoOrigen = await gradoOrden(ANIO, 3);
      assert.ok(gradoOrigen, "No existe 3ro en el origen");

      await sql(
        `DELETE FROM notas_finales_area
         WHERE anio_lectivo = $1
           AND id_alumno IN (
             SELECT id_alumno FROM alumnos
             WHERE anio_lectivo = $1 AND id_grado = $2
           )`,
        [ANIO, gradoOrigen.id_grado],
      );
      await sql(
        `DELETE FROM actas_bimestrales
         WHERE anio_lectivo = $1 AND id_grado = $2`,
        [ANIO, gradoOrigen.id_grado],
      );

      const politica = await crearPoliticaE2E(ANIO_PROMO_BLOQUEO, {
        requiere_actas_cerradas: true,
        requiere_notas_finales: true,
        permite_override: true,
        criterio_academico: {
          modo: "manual",
          modo_repitencia: "DESACTIVADA",
          notas_bimestres: [4],
          bimestres_requeridos: [1],
          transiciones: [],
          observacion: "Bloqueo E2E",
        },
      });

      const { respuesta, datos, preview } = await previsualizarPromocion({
        anio_origen: ANIO,
        anio_destino: ANIO_PROMO_BLOQUEO,
        id_politica: politica.id_politica,
        id_grado: gradoOrigen.id_grado,
        incluir_retirados: false,
      });
      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
      assert.ok(preview.resumen.bloqueados > 0, "No se bloquearon alumnos");
      assert.ok(
        preview.alumnos.some((alumno) =>
          alumno.bloqueos.some(
            (bloqueo) =>
              bloqueo.codigo === "ACTAS_PENDIENTES" ||
              bloqueo.codigo === "NOTAS_PENDIENTES",
          ),
        ),
        "No apareció el bloqueo de actas/notas",
      );

      const sinOverride = await confirmarPromocion(preview);
      assert.equal(
        sinOverride.respuesta.status,
        422,
        detalleHttp(sinOverride.respuesta, sinOverride.datos),
      );
      assert.equal(
        sinOverride.datos?.errors?.codigo,
        "PROMOCION_PENDIENTE",
      );

      const decisiones = preview.alumnos.map((alumno) => ({
        id_alumno_origen: alumno.id_alumno_origen,
        resultado: "PROMOVIDO",
        motivo: "Override autorizado E2E por dirección",
        es_override: true,
      }));

      const segundo = await previsualizarPromocion({
        anio_origen: ANIO,
        anio_destino: ANIO_PROMO_BLOQUEO,
        id_politica: politica.id_politica,
        id_grado: gradoOrigen.id_grado,
        incluir_retirados: false,
        decisiones,
      });
      assert.equal(segundo.respuesta.status, 200, detalleHttp(segundo.respuesta, segundo.datos));
      assert.equal(segundo.preview.resumen.bloqueados, 0);
      assert.ok(segundo.preview.resumen.overrides > 0);

      const conOverride = await confirmarPromocion(segundo.preview, {
        decisiones,
      });
      assert.equal(
        conOverride.respuesta.status,
        200,
        detalleHttp(conOverride.respuesta, conOverride.datos),
      );

      const promociones = await sql(
        `SELECT es_override, motivo, metadata
         FROM promociones
         WHERE anio_destino = $1 AND estado = 'CONFIRMADA'`,
        [ANIO_PROMO_BLOQUEO],
      );
      assert.ok(promociones.some((fila) => fila.es_override === true));
      assert.ok(
        promociones
          .filter((fila) => fila.es_override)
          .every((fila) => String(fila.motivo || "").length >= 5),
      );
      assert.ok(
        promociones.some(
          (fila) =>
            fila.metadata?.actas && fila.metadata?.notas,
        ),
        "La metadata no guardó la evidencia de actas/notas",
      );

      registrar(
        45,
        "Promoción: bloqueo por actas/notas y override con motivo",
        "PASS",
        `bloqueados=${preview.resumen.bloqueados}, overrides=${segundo.preview.resumen.overrides}`,
      );
    },
  );

  // 46. Asistencia bajo umbral: advertencia, no exclusión.
  await prueba(
    46,
    "Promoción: asistencia bajo umbral advierte y no excluye",
    async () => {
      await crearOfertaPromocion(ANIO_PROMO_ASISTENCIA);
      const gradoOrigen = await gradoOrden(ANIO, 4);
      assert.ok(gradoOrigen, "No existe 4to en el origen");

      const candidato = await sql(
        `SELECT a.id_alumno, cc.id_curso
         FROM alumnos a
         CROSS JOIN (
           SELECT cc.id_curso
           FROM carga_curricular cc
           WHERE cc.anio_lectivo = $1 AND cc.id_grado = $2
           ORDER BY cc.id_curso
           LIMIT 1
         ) cc
         WHERE a.anio_lectivo = $1
           AND a.id_grado = $2
           AND a.estado_matricula = 'Matriculado'
         ORDER BY a.id_alumno
         LIMIT 1`,
        [ANIO, gradoOrigen.id_grado],
      );
      assert.ok(candidato[0], "No hay alumno de 4to para la prueba");

      await sql(
        `INSERT INTO asistencia_alumnos
           (id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana,
            estado, observacion, justificada)
         VALUES ($1, $2, NULL, $3, '2026-10-01', 'Jueves', 'F', 'E2E', false)`,
        [candidato[0].id_alumno, candidato[0].id_curso, gradoOrigen.id_grado],
      );

      const politica = await crearPoliticaE2E(ANIO_PROMO_ASISTENCIA, {
        umbral_asistencia: 100,
      });
      const { respuesta, datos, preview } = await previsualizarPromocion({
        anio_origen: ANIO,
        anio_destino: ANIO_PROMO_ASISTENCIA,
        id_politica: politica.id_politica,
        id_grado: gradoOrigen.id_grado,
        incluir_retirados: false,
      });
      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));

      const fila = preview.alumnos.find(
        (alumno) =>
          Number(alumno.id_alumno_origen) === Number(candidato[0].id_alumno),
      );
      assert.ok(fila, "El alumno de asistencia no apareció");
      assert.ok(
        fila.advertencias.some(
          (advertencia) => advertencia.codigo === "ASISTENCIA_BAJA",
        ),
        "No se emitió la advertencia de asistencia",
      );
      assert.equal(fila.bloqueado, false);
      assert.equal(fila.resultado_sugerido, "PROMOVIDO");

      const { respuesta: rConfirm, datos: dConfirm } =
        await confirmarPromocion(preview);
      assert.equal(rConfirm.status, 200, detalleHttp(rConfirm, dConfirm));

      registrar(
        46,
        "Promoción: asistencia bajo umbral advierte y no excluye",
        "PASS",
        `asistencia=${fila.asistencia.porcentaje}%, PROMOVIDO`,
      );
    },
  );

  // 47. Doble promoción: idempotencia.
  await prueba(
    47,
    "Promoción: doble confirmación es idempotente y no duplica",
    async () => {
      const antes = await contarDestinoPromocion(ANIO_PROMO_NORMAL);
      const { respuesta, datos, preview } = await previsualizarPromocion({
        anio_origen: ANIO,
        anio_destino: ANIO_PROMO_NORMAL,
        id_politica: ctx.politicaPromoNormal.id_politica,
        id_grado: 1,
        incluir_retirados: false,
      });
      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
      assert.equal(
        preview.preview_hash,
        ctx.previewPromoNormal.preview_hash,
        "El hash cambió después de confirmar",
      );
      assert.equal(preview.resumen.ya_confirmadas, preview.resumen.total);

      const segundo = await confirmarPromocion(preview, {
        preview_hash: ctx.previewPromoNormal.preview_hash,
      });
      assert.equal(
        segundo.respuesta.status,
        200,
        detalleHttp(segundo.respuesta, segundo.datos),
      );
      assert.equal(segundo.resultado.ya_confirmada, true);
      assert.equal(segundo.resultado.creados, 0);

      const despues = await contarDestinoPromocion(ANIO_PROMO_NORMAL);
      assert.deepEqual(despues, antes, "La doble confirmación duplicó filas");

      registrar(
        47,
        "Promoción: doble confirmación es idempotente y no duplica",
        "PASS",
        `ya_confirmada=true, creados=0, existentes=${antes.alumnos}`,
      );
    },
  );

  // 48. Anulación sin actividad y reintento con reversa (origen 2025 → 2026).
  await prueba(
    48,
    "Promoción: anular sin actividad borra destino y permite reintento",
    async () => {
      const anioAux = ANIO - 1;
      await crearOfertaPromocion(anioAux);
      const gradoAux = await gradoOrden(anioAux, 2);
      assert.ok(gradoAux, "No existe 2do en el año auxiliar");

      const alumnosAux = [];
      for (let i = 0; i < 2; i += 1) {
        alumnosAux.push(
          await crearAlumnoPromocionAux({
            dni: `9999910${2 + i}`,
            nombres: `Anulable ${i + 1}`,
            apellidos: "E2E",
            idGrado: gradoAux.id_grado,
            anio: anioAux,
          }),
        );
      }

      const politica = await crearPoliticaE2E(
        ANIO,
        { nombre: "E2E 2025 anular" },
        anioAux,
      );
      const primera = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
      });
      assert.equal(primera.respuesta.status, 200, detalleHttp(primera.respuesta, primera.datos));

      const confirmada = await confirmarPromocion(primera.preview);
      assert.equal(confirmada.respuesta.status, 200, detalleHttp(confirmada.respuesta, confirmada.datos));
      assert.equal(confirmada.resultado.creados, alumnosAux.length);

      const idsAnulados = [];
      for (const promocion of confirmada.resultado.promociones) {
        const anulada = await api(`/promociones/${promocion.id_promocion}/anular`, {
          method: "PUT",
          token: ctx.adminToken,
          body: { motivo: "Anulación E2E sin actividad" },
        });
        const datosAnulada = await leerJson(anulada);
        assert.equal(
          anulada.status,
          200,
          detalleHttp(anulada, datosAnulada),
        );
        assert.equal(
          Number(datosAnulada.datos?.data?.eliminados?.alumnos || 0),
          1,
          "No se eliminó la matrícula destino",
        );
        idsAnulados.push(Number(promocion.id_promocion));
      }
      assert.equal(idsAnulados.length, alumnosAux.length);

      const estado = await sql(
        `SELECT
           (SELECT COUNT(*)::int FROM alumnos
             WHERE anio_lectivo = $1 AND dni::text = ANY($2::text[])) AS alumnos,
           (SELECT COUNT(*)::int FROM promociones
             WHERE anio_destino = $1
               AND id_alumno_origen = ANY($3::int[])
               AND estado = 'ANULADA') AS anuladas`,
        [ANIO, alumnosAux.map((alumno) => String(alumno.dni)), alumnosAux.map((alumno) => Number(alumno.id_alumno))],
      );
      assert.equal(estado[0].alumnos, 0, "No se borró la matrícula destino");
      assert.equal(estado[0].anuladas, alumnosAux.length);

      const segunda = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
      });
      assert.equal(segunda.respuesta.status, 200, detalleHttp(segunda.respuesta, segunda.datos));
      assert.equal(segunda.preview.resumen.ya_confirmadas, 0);

      const reintento = await confirmarPromocion(segunda.preview);
      assert.equal(reintento.respuesta.status, 200, detalleHttp(reintento.respuesta, reintento.datos));
      assert.equal(reintento.resultado.creados, alumnosAux.length);

      const reversas = await sql(
        `SELECT id_promocion, id_promocion_reversa
         FROM promociones
         WHERE anio_destino = $1
           AND id_alumno_origen = ANY($2::int[])
           AND estado = 'CONFIRMADA'`,
        [ANIO, alumnosAux.map((alumno) => Number(alumno.id_alumno))],
      );
      assert.ok(
        reversas.some(
          (fila) =>
            fila.id_promocion_reversa !== null &&
            idsAnulados.includes(Number(fila.id_promocion_reversa)),
        ),
        "El reintento no enlazó la promoción anulada",
      );

      registrar(
        48,
        "Promoción: anular sin actividad borra destino y permite reintento",
        "PASS",
        `anuladas=${idsAnulados.length}, reintento=${reintento.resultado.creados}`,
      );
    },
  );

  // 49. Anulación con actividad: 409 (origen 2025 → 2026).
  await prueba(
    49,
    "Promoción: anular con actividad responde 409 y no borra",
    async () => {
      const anioAux = ANIO - 1;
      await crearOfertaPromocion(anioAux);
      const gradoAux = await gradoOrden(anioAux, 3);
      assert.ok(gradoAux, "No existe 3ro en el año auxiliar");

      const alumnoAux = await crearAlumnoPromocionAux({
        dni: "99999104",
        nombres: "Actividad",
        apellidos: "E2E",
        idGrado: gradoAux.id_grado,
        anio: anioAux,
      });

      const politica = await crearPoliticaE2E(
        ANIO,
        { nombre: "E2E 2025 actividad" },
        anioAux,
      );
      const preview = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
      });
      assert.equal(preview.respuesta.status, 200, detalleHttp(preview.respuesta, preview.datos));

      const confirmada = await confirmarPromocion(preview.preview);
      assert.equal(confirmada.respuesta.status, 200, detalleHttp(confirmada.respuesta, confirmada.datos));

      const promocion = confirmada.resultado.promociones.find(
        (item) =>
          (item.resultado === "PROMOVIDO" || item.resultado === "REPITENTE") &&
          item.id_alumno_destino,
      );
      assert.ok(promocion, "No hay promoción con matrícula destino");

      const curso = await sql(
        `SELECT id_curso FROM cursos ORDER BY id_curso LIMIT 1`,
      );
      assert.ok(curso[0], "No hay cursos en el catálogo");

      await sql(
        `INSERT INTO notas_finales_area
           (id_alumno, id_curso, bimestre, anio_lectivo, nota_final, calculo_automatico)
         VALUES ($1, $2, 1, $3, 'A', false)
         ON CONFLICT (id_alumno, id_curso, bimestre, anio_lectivo)
         DO UPDATE SET nota_final = 'A'`,
        [promocion.id_alumno_destino, curso[0].id_curso, ANIO],
      );

      const anulada = await api(`/promociones/${promocion.id_promocion}/anular`, {
        method: "PUT",
        token: ctx.adminToken,
        body: { motivo: "Anulación E2E con actividad" },
      });
      const datosAnulada = await leerJson(anulada);
      assert.equal(
        anulada.status,
        409,
        detalleHttp(anulada, datosAnulada),
      );
      assert.equal(
        datosAnulada.datos?.errors?.codigo,
        "PROMOCION_CON_ACTIVIDAD",
      );

      const estado = await sql(
        `SELECT estado FROM promociones WHERE id_promocion = $1`,
        [promocion.id_promocion],
      );
      assert.equal(estado[0].estado, "CONFIRMADA");

      registrar(
        49,
        "Promoción: anular con actividad responde 409 y no borra",
        "PASS",
        `promoción=${promocion.id_promocion}, 409`,
      );
    },
  );

  // 50. Fallo forzado: rollback total (origen 2025 → 2026).
  await prueba(
    50,
    "Promoción: fallo forzado no deja matrículas ni promociones parciales",
    async () => {
      const anioAux = ANIO - 1;
      await crearOfertaPromocion(anioAux);
      const gradoAux = await gradoOrden(anioAux, 4);
      assert.ok(gradoAux, "No existe 4to en el año auxiliar");

      await crearAlumnoPromocionAux({
        dni: "99999105",
        nombres: "Rollback",
        apellidos: "E2E",
        idGrado: gradoAux.id_grado,
        anio: anioAux,
      });

      const politica = await crearPoliticaE2E(
        ANIO,
        { nombre: "E2E 2025 rollback" },
        anioAux,
      );
      const preview = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
      });
      assert.equal(preview.respuesta.status, 200, detalleHttp(preview.respuesta, preview.datos));

      await sql(`
        CREATE OR REPLACE FUNCTION e2e_fallo_promocion()
        RETURNS trigger AS $$
        BEGIN
          IF NEW.anio_destino = ${Number(ANIO)} THEN
            RAISE EXCEPTION 'Fallo forzado E2E en promociones';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await sql(`DROP TRIGGER IF EXISTS e2e_fallo_promocion ON promociones`);
      await sql(`
        CREATE TRIGGER e2e_fallo_promocion
        BEFORE INSERT ON promociones
        FOR EACH ROW EXECUTE FUNCTION e2e_fallo_promocion()
      `);

      try {
        const confirmada = await confirmarPromocion(preview.preview);
        assert.ok(
          confirmada.respuesta.status >= 500,
          `El fallo forzado debía responder 5xx (HTTP ${confirmada.respuesta.status})`,
        );

        const conteos = await sql(
          `SELECT
             (SELECT COUNT(*)::int FROM alumnos
               WHERE anio_lectivo = $1 AND dni = '99999105') AS alumnos,
             (SELECT COUNT(*)::int FROM promociones p
               INNER JOIN alumnos a ON a.id_alumno = p.id_alumno_origen
               WHERE a.anio_lectivo = $2 AND a.dni = '99999105'
                 AND p.anio_destino = $1) AS promociones,
             (SELECT COUNT(*)::int FROM pre_tickets pt
               INNER JOIN alumnos a ON a.id_alumno = pt.id_alumno
               WHERE a.anio_lectivo = $1 AND a.dni = '99999105') AS pretickets`,
          [ANIO, anioAux],
        );
        assert.equal(conteos[0].alumnos, 0, "Quedaron matrículas parciales");
        assert.equal(conteos[0].promociones, 0, "Quedaron promociones parciales");
        assert.equal(conteos[0].pretickets, 0, "Quedaron pre-tickets parciales");
      } finally {
        await sql(`DROP TRIGGER IF EXISTS e2e_fallo_promocion ON promociones`);
        await sql(`DROP FUNCTION IF EXISTS e2e_fallo_promocion()`);
      }

      registrar(
        50,
        "Promoción: fallo forzado no deja matrículas ni promociones parciales",
        "PASS",
        "5xx y 0 filas parciales",
      );
    },
  );

  // 51. QR, código, pre-ticket y pensiones.
  await prueba(
    51,
    "Promoción: conserva QR/código, crea pre-ticket y no hereda pensiones",
    async () => {
      const destino = ctx.destino2035?.[0];
      assert.ok(destino, "No hay matrícula destino de la prueba normal");

      const datos = await sql(
        `SELECT
           ad.id_usuario,
           ad.codigo_estudiante,
           ad.estado_matricula,
           (SELECT COUNT(*)::int FROM credenciales_qr qr
             WHERE qr.id_usuario = ad.id_usuario) AS qr,
           (SELECT codigo_qr FROM credenciales_qr qr
             WHERE qr.id_usuario = ad.id_usuario LIMIT 1) AS codigo_qr,
           (SELECT codigo_qr FROM credenciales_qr qr
             WHERE qr.id_usuario = ad.id_usuario LIMIT 1) AS codigo_qr_actual,
           (SELECT COUNT(*)::int FROM pre_tickets pt
             WHERE pt.id_alumno = ad.id_alumno AND pt.estado = 'PENDIENTE') AS pretickets,
           (SELECT COUNT(*)::int FROM pensiones pe
             WHERE pe.id_alumno = ad.id_alumno) AS pensiones,
           (SELECT COUNT(*)::int FROM expediente_alumno e
             WHERE e.id_alumno = ad.id_alumno) AS expedientes
         FROM alumnos ad
         WHERE ad.id_alumno = $1`,
        [destino.id_alumno],
      );
      const fila = datos[0];
      assert.equal(fila.qr, 1, "Se duplicó o perdió el QR");
      assert.equal(fila.pretickets, 1, "No se creó el pre-ticket de matrícula");
      assert.equal(fila.pensiones, 0, "Se heredaron pensiones");
      assert.equal(fila.expedientes, 1, "No se creó el expediente");
      assert.equal(fila.estado_matricula, "PendientePago");

      const origen = await sql(
        `SELECT codigo_estudiante FROM alumnos
         WHERE anio_lectivo = $1 AND id_usuario = $2 LIMIT 1`,
        [ANIO, fila.id_usuario],
      );
      assert.equal(
        fila.codigo_estudiante,
        origen[0].codigo_estudiante,
        "El código de estudiante cambió",
      );

      registrar(
        51,
        "Promoción: conserva QR/código, crea pre-ticket y no hereda pensiones",
        "PASS",
        `qr=1, preticket=1, pensiones=0, código estable`,
      );
    },
  );

  // 52. RBAC.
  await prueba(
    52,
    "Promoción: RBAC ADMIN/SECRETARIA lectura, DOCENTE/ESTUDIANTE 403",
    async () => {
      const admin = await api("/promociones", { token: ctx.adminToken });
      assert.equal(admin.status, 200);

      const docente = await iniciarSesion(
        "DOCENTE",
        credenciales.DOCENTE[0],
        credenciales.DOCENTE[1],
      );
      const respuestaDocente = await api("/promociones", {
        token: docente.token,
      });
      assert.equal(respuestaDocente.status, 403);

      const estudiante = await iniciarSesion(
        "ESTUDIANTE",
        credenciales.ESTUDIANTE[0],
        credenciales.ESTUDIANTE[1],
      );
      const respuestaEstudiante = await api("/promociones", {
        token: estudiante.token,
      });
      assert.equal(respuestaEstudiante.status, 403);

      const secre = await sql(
        `INSERT INTO usuarios (
           dni, nombres, apellidos, correo_institucional, password_hash,
           id_rol, estado, requiere_cambio_password
         )
         VALUES (
           '99999096', 'Secretaria', 'Promociones E2E',
           'secretaria.promociones@example.com',
           crypt('99999096', gen_salt('bf', 10)), 3, 'ACTIVO', FALSE
         )
         RETURNING id_usuario`,
      );

      try {
        const sesion = await iniciarSesion(
          "SECRETARIA",
          "99999096",
          "99999096",
        );
        const lectura = await api("/promociones", { token: sesion.token });
        assert.equal(lectura.status, 200);

        const politicas = await api("/promociones/politicas", {
          token: sesion.token,
        });
        assert.equal(politicas.status, 200);

        const preview = await api("/promociones/preview", {
          method: "POST",
          token: sesion.token,
          body: {
            anio_origen: ANIO,
            anio_destino: ANIO_PROMO_NORMAL,
            id_politica: ctx.politicaPromoNormal.id_politica,
            id_grado: 1,
          },
        });
        assert.equal(preview.status, 200);

        const confirmar = await api("/promociones/confirmar", {
          method: "POST",
          token: sesion.token,
          body: {},
        });
        assert.equal(confirmar.status, 403);
      } finally {
        await sql(`DELETE FROM usuarios WHERE id_usuario = $1`, [
          secre[0].id_usuario,
        ]);
      }

      registrar(
        52,
        "Promoción: RBAC ADMIN/SECRETARIA lectura, DOCENTE/ESTUDIANTE 403",
        "PASS",
        "ADMIN 200, SECRETARIA 200/403, DOCENTE/ESTUDIANTE 403",
      );
    },
  );

  // 53. Auditoría.
  await prueba(
    53,
    "Promoción: auditoría PREVISUALIZAR/CONFIRMAR/ANULAR",
    async () => {
      const acciones = await sql(
        `SELECT accion, COUNT(*)::int AS total
         FROM bitacora_auditoria
         WHERE modulo_afectado = 'Promociones'
           AND accion IN ('PREVISUALIZAR', 'CONFIRMAR', 'ANULAR')
         GROUP BY accion`,
      );
      const porAccion = Object.fromEntries(
        acciones.map((fila) => [fila.accion, fila.total]),
      );
      assert.ok(porAccion.PREVISUALIZAR > 0, "No se auditó PREVISUALIZAR");
      assert.ok(porAccion.CONFIRMAR > 0, "No se auditó CONFIRMAR");
      assert.ok(porAccion.ANULAR > 0, "No se auditó ANULAR");

      registrar(
        53,
        "Promoción: auditoría PREVISUALIZAR/CONFIRMAR/ANULAR",
        "PASS",
        `PREVISUALIZAR=${porAccion.PREVISUALIZAR}, CONFIRMAR=${porAccion.CONFIRMAR}, ANULAR=${porAccion.ANULAR}`,
      );
    },
  );

  // 54. Histórico consultable.
  await prueba(
    54,
    "Promoción: histórico 2026 sigue consultable y el año activo no cambia",
    async () => {
      const destino = ctx.destino2035?.[0];
      assert.ok(destino, "No hay matrícula destino de la prueba normal");

      const origen = await api(
        `/alumnos?anio=${ANIO}&search=${encodeURIComponent(destino.dni)}`,
        { token: ctx.adminToken },
      );
      const datosOrigen = await leerJson(origen);
      assert.equal(origen.status, 200, detalleHttp(origen, datosOrigen));
      assert.ok(
        (datosOrigen.datos?.data || []).some(
          (alumno) =>
            Number(alumno.anio_lectivo) === Number(ANIO) &&
            String(alumno.dni) === String(destino.dni),
        ),
        "La matrícula 2026 no siguió consultable",
      );

      const nuevo = await api(
        `/alumnos?anio=${ANIO_PROMO_NORMAL}&search=${encodeURIComponent(destino.dni)}`,
        { token: ctx.adminToken },
      );
      const datosNuevo = await leerJson(nuevo);
      assert.equal(nuevo.status, 200, detalleHttp(nuevo, datosNuevo));
      assert.ok(
        (datosNuevo.datos?.data || []).some(
          (alumno) =>
            Number(alumno.anio_lectivo) === Number(ANIO_PROMO_NORMAL) &&
            String(alumno.dni) === String(destino.dni),
        ),
        "La matrícula destino no se consulta",
      );

      const config = await api("/configuracion");
      const datosConfig = await leerJson(config);
      assert.equal(config.status, 200, detalleHttp(config, datosConfig));
      assert.equal(
        Number(datosConfig.datos?.data?.anio_lectivo),
        ANIO + 2,
        "La promoción no debe activar el año destino",
      );

      registrar(
        54,
        "Promoción: histórico 2026 sigue consultable y el año activo no cambia",
        "PASS",
        `2026 y ${ANIO_PROMO_NORMAL} consultables, activo=${ANIO + 2}`,
      );
    },
  );

  // 55. EGRESADO exige actas/notas y override con evidencia.
  await prueba(
    55,
    "Promoción: egresado exige actas/notas y override con evidencia",
    async () => {
      const anioAux = ANIO - 1; // 2025
      await crearOfertaPromocion(anioAux);
      const gradoAux = await gradoOrden(anioAux, 5);
      assert.ok(gradoAux, "No existe 5to en el año auxiliar");

      const alumnoAux = await crearAlumnoPromocionAux({
        dni: "99999106",
        nombres: "Egreso",
        apellidos: "Estricto E2E",
        idGrado: gradoAux.id_grado,
        anio: anioAux,
      });

      const curso = await sql(
        `SELECT id_curso FROM cursos ORDER BY id_curso LIMIT 1`,
      );
      const personal = await sql(
        `SELECT id_personal FROM personal ORDER BY id_personal LIMIT 1`,
      );
      assert.ok(curso[0] && personal[0], "Faltan curso o personal para la carga");
      await sql(
        `INSERT INTO carga_curricular
           (id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas)
         VALUES ($1, $2, $3, $4, 2)`,
        [
          gradoAux.id_grado,
          curso[0].id_curso,
          personal[0].id_personal,
          anioAux,
        ],
      );
      await sql(
        `INSERT INTO notas_finales_area
           (id_alumno, id_curso, bimestre, anio_lectivo, nota_final, calculo_automatico)
         VALUES ($1, $2, 1, $3, 'A', false)
         ON CONFLICT (id_alumno, id_curso, bimestre, anio_lectivo)
         DO UPDATE SET nota_final = 'A'`,
        [alumnoAux.id_alumno, curso[0].id_curso, anioAux],
      );

      const politica = await crearPoliticaE2E(
        ANIO,
        {
          nombre: "E2E 2025 egreso estricto",
          requiere_actas_cerradas: true,
          requiere_notas_finales: true,
          permite_override: true,
          criterio_academico: {
            modo: "manual",
            modo_repitencia: "DESACTIVADA",
            notas_bimestres: [1, 2],
            bimestres_requeridos: [1],
            transiciones: [],
            observacion: "Egreso estricto E2E",
          },
        },
        anioAux,
      );

      const previewSinActa = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
      });
      assert.equal(
        previewSinActa.respuesta.status,
        200,
        detalleHttp(previewSinActa.respuesta, previewSinActa.datos),
      );
      const filaSinActa = previewSinActa.preview.alumnos.find(
        (alumno) => Number(alumno.id_alumno_origen) === Number(alumnoAux.id_alumno),
      );
      assert.ok(filaSinActa, "El alumno de 5to no apareció");
      assert.equal(filaSinActa.resultado_sugerido, "PENDIENTE");
      assert.deepEqual(filaSinActa.notas.bimestres, [1, 2]);
      assert.equal(filaSinActa.notas.combinaciones_requeridas, 2);
      assert.equal(filaSinActa.notas.combinaciones_registradas, 1);
      assert.equal(filaSinActa.notas.registradas, 0);
      assert.ok(
        filaSinActa.bloqueos.some(
          (bloqueo) => bloqueo.codigo === "ACTAS_PENDIENTES",
        ),
        "No apareció el bloqueo de actas para EGRESADO",
      );

      await sql(
        `INSERT INTO actas_bimestrales
           (periodo, anio_lectivo, bimestre, id_grado, estado, fecha_cierre, cerrado_por)
         VALUES ('1er Bimestre', $1, 1, $2, 'CERRADO', now(), $3)`,
        [anioAux, gradoAux.id_grado, ctx.adminId],
      );

      const preview = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
      });
      assert.equal(preview.respuesta.status, 200, detalleHttp(preview.respuesta, preview.datos));
      const fila = preview.preview.alumnos.find(
        (alumno) => Number(alumno.id_alumno_origen) === Number(alumnoAux.id_alumno),
      );
      assert.ok(fila, "El alumno de 5to no apareció");
      assert.equal(fila.resultado_sugerido, "PENDIENTE");
      assert.ok(
        fila.bloqueos.some((bloqueo) => bloqueo.codigo === "NOTAS_PENDIENTES"),
        "No apareció el bloqueo de notas para EGRESADO",
      );

      const sinOverride = await confirmarPromocion(preview.preview);
      assert.equal(
        sinOverride.respuesta.status,
        422,
        detalleHttp(sinOverride.respuesta, sinOverride.datos),
      );
      assert.equal(
        sinOverride.datos?.errors?.codigo,
        "PROMOCION_PENDIENTE",
      );

      const decisiones = [
        {
          id_alumno_origen: fila.id_alumno_origen,
          resultado: "EGRESADO",
          motivo: "Egreso autorizado E2E por dirección",
          es_override: true,
        },
      ];
      const conOverride = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
        decisiones,
      });
      assert.equal(
        conOverride.respuesta.status,
        200,
        detalleHttp(conOverride.respuesta, conOverride.datos),
      );
      assert.equal(conOverride.preview.resumen.bloqueados, 0);
      const filaOverride = conOverride.preview.alumnos.find(
        (alumno) => Number(alumno.id_alumno_origen) === Number(alumnoAux.id_alumno),
      );
      assert.equal(filaOverride.resultado_final, "EGRESADO");

      const confirmada = await confirmarPromocion(conOverride.preview, {
        decisiones,
      });
      assert.equal(
        confirmada.respuesta.status,
        200,
        detalleHttp(confirmada.respuesta, confirmada.datos),
      );

      const promocion = await sql(
        `SELECT resultado, es_override, metadata, id_alumno_destino
         FROM promociones
         WHERE anio_destino = $1 AND id_alumno_origen = $2
           AND estado = 'CONFIRMADA'
         LIMIT 1`,
        [ANIO, alumnoAux.id_alumno],
      );
      assert.equal(promocion[0]?.resultado, "EGRESADO");
      assert.equal(promocion[0]?.es_override, true);
      assert.equal(promocion[0]?.id_alumno_destino, null);
      assert.ok(promocion[0]?.metadata?.actas);
      assert.ok(promocion[0]?.metadata?.notas);

      registrar(
        55,
        "Promoción: egresado exige actas/notas y override con evidencia",
        "PASS",
        `egresado=${alumnoAux.id_alumno}, override con metadata`,
      );
    },
  );

  // 56. REPITENTE exige actas y override con evidencia.
  await prueba(
    56,
    "Promoción: repitente exige actas y override con evidencia",
    async () => {
      const anioAux = ANIO - 3; // 2023
      await crearOfertaPromocion(anioAux);
      const gradoAux = await gradoOrden(anioAux, 2);
      assert.ok(gradoAux, "No existe 2do en el año auxiliar");

      const alumnoAux = await crearAlumnoPromocionAux({
        dni: "99999107",
        nombres: "Repitente",
        apellidos: "Estricto E2E",
        idGrado: gradoAux.id_grado,
        anio: anioAux,
      });

      const curso = await sql(
        `SELECT id_curso FROM cursos ORDER BY id_curso LIMIT 1`,
      );
      const personal = await sql(
        `SELECT id_personal FROM personal ORDER BY id_personal LIMIT 1`,
      );
      assert.ok(curso[0] && personal[0], "Faltan curso o personal para la carga");
      await sql(
        `INSERT INTO carga_curricular
           (id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas)
         VALUES ($1, $2, $3, $4, 2)`,
        [
          gradoAux.id_grado,
          curso[0].id_curso,
          personal[0].id_personal,
          anioAux,
        ],
      );
      await sql(
        `INSERT INTO notas_finales_area
           (id_alumno, id_curso, bimestre, anio_lectivo, nota_final, calculo_automatico)
         VALUES ($1, $2, 1, $3, 'C', false)
         ON CONFLICT (id_alumno, id_curso, bimestre, anio_lectivo)
         DO UPDATE SET nota_final = 'C'`,
        [alumnoAux.id_alumno, curso[0].id_curso, anioAux],
      );

      const politica = await crearPoliticaE2E(
        ANIO,
        {
          nombre: "E2E 2023 repitente estricto",
          requiere_actas_cerradas: true,
          requiere_notas_finales: true,
          permite_override: true,
          criterio_academico: {
            modo: "manual",
            modo_repitencia: "UMBRAL",
            notas_bimestres: [1],
            bimestres_requeridos: [1],
            min_cursos_desaprobados: 1,
            notas_desaprobadas: ["C"],
            transiciones: [],
            observacion: "Repitente estricto E2E",
          },
        },
        anioAux,
      );

      const preview = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
      });
      assert.equal(preview.respuesta.status, 200, detalleHttp(preview.respuesta, preview.datos));
      const fila = preview.preview.alumnos.find(
        (alumno) => Number(alumno.id_alumno_origen) === Number(alumnoAux.id_alumno),
      );
      assert.ok(fila, "El alumno repitente no apareció");
      assert.equal(fila.resultado_sugerido, "PENDIENTE");
      assert.ok(
        fila.bloqueos.some((bloqueo) => bloqueo.codigo === "ACTAS_PENDIENTES"),
        "No apareció el bloqueo de actas para REPITENTE",
      );

      const sinOverride = await confirmarPromocion(preview.preview);
      assert.equal(sinOverride.respuesta.status, 422);
      assert.equal(sinOverride.datos?.errors?.codigo, "PROMOCION_PENDIENTE");

      const decisiones = [
        {
          id_alumno_origen: fila.id_alumno_origen,
          resultado: "REPITENTE",
          motivo: "Repitencia autorizada E2E por dirección",
          es_override: true,
        },
      ];
      const conOverride = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
        decisiones,
      });
      assert.equal(conOverride.respuesta.status, 200, detalleHttp(conOverride.respuesta, conOverride.datos));
      assert.equal(conOverride.preview.resumen.bloqueados, 0);
      const filaOverride = conOverride.preview.alumnos.find(
        (alumno) => Number(alumno.id_alumno_origen) === Number(alumnoAux.id_alumno),
      );
      assert.equal(filaOverride.resultado_final, "REPITENTE");

      const confirmada = await confirmarPromocion(conOverride.preview, {
        decisiones,
      });
      assert.equal(confirmada.respuesta.status, 200, detalleHttp(confirmada.respuesta, confirmada.datos));

      const gradoDestino = await gradoOrden(ANIO, 2);
      const promocion = await sql(
        `SELECT resultado, id_grado_destino, metadata
         FROM promociones
         WHERE anio_destino = $1 AND id_alumno_origen = $2
           AND estado = 'CONFIRMADA'
         LIMIT 1`,
        [ANIO, alumnoAux.id_alumno],
      );
      assert.equal(promocion[0]?.resultado, "REPITENTE");
      assert.equal(
        Number(promocion[0]?.id_grado_destino),
        Number(gradoDestino.id_grado),
      );
      assert.ok(promocion[0]?.metadata?.actas);

      registrar(
        56,
        "Promoción: repitente exige actas y override con evidencia",
        "PASS",
        `repitente=${alumnoAux.id_alumno}, grado=${gradoDestino.orden}`,
      );
    },
  );

  // 57. copiar_becas forma parte del hash.
  await prueba(
    57,
    "Promoción: copiar_becas invalida el hash y copia solo si se confirma",
    async () => {
      const anioAux = ANIO - 1; // 2025
      await crearOfertaPromocion(anioAux);
      const gradoAux = await gradoOrden(anioAux, 1);
      assert.ok(gradoAux, "No existe 1ro en el año auxiliar");

      const alumnoAux = await crearAlumnoPromocionAux({
        dni: "99999108",
        nombres: "Beca",
        apellidos: "E2E",
        idGrado: gradoAux.id_grado,
        anio: anioAux,
      });
      await sql(
        `INSERT INTO becas (
           id_alumno, tipo, porcentaje_descuento, monto_descuento,
           fecha_inicio, fecha_fin, activo
         ) VALUES ($1, 'SOCIOECONOMICA', 50, NULL, '2025-01-01', NULL, true)`,
        [alumnoAux.id_alumno],
      );

      const politica = await crearPoliticaE2E(
        ANIO,
        { nombre: "E2E 2025 becas" },
        anioAux,
      );

      const previewFalse = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
        copiar_becas: false,
      });
      assert.equal(previewFalse.respuesta.status, 200, detalleHttp(previewFalse.respuesta, previewFalse.datos));
      assert.equal(previewFalse.preview.copiar_becas, false);

      const conHashViejo = await confirmarPromocion(previewFalse.preview, {
        copiar_becas: true,
      });
      assert.equal(
        conHashViejo.respuesta.status,
        409,
        detalleHttp(conHashViejo.respuesta, conHashViejo.datos),
      );
      assert.equal(
        conHashViejo.datos?.errors?.codigo,
        "PREVIEW_DESACTUALIZADA",
      );

      const sinBeca = await confirmarPromocion(previewFalse.preview, {
        copiar_becas: false,
      });
      assert.equal(sinBeca.respuesta.status, 200, detalleHttp(sinBeca.respuesta, sinBeca.datos));
      const idPromocion = sinBeca.resultado.promociones[0].id_promocion;

      const destSinBeca = await sql(
        `SELECT COUNT(*)::int AS total
         FROM becas b
         INNER JOIN alumnos a ON a.id_alumno = b.id_alumno
         WHERE a.anio_lectivo = $1 AND a.dni = '99999108'`,
        [ANIO],
      );
      assert.equal(destSinBeca[0].total, 0, "Se copió la beca sin confirmarlo");

      const anulada = await api(`/promociones/${idPromocion}/anular`, {
        method: "PUT",
        token: ctx.adminToken,
        body: { motivo: "Anulación E2E para reintentar beca" },
      });
      const datosAnulada = await leerJson(anulada);
      assert.equal(anulada.status, 200, detalleHttp(anulada, datosAnulada));

      const previewTrue = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
        copiar_becas: true,
      });
      assert.equal(previewTrue.respuesta.status, 200, detalleHttp(previewTrue.respuesta, previewTrue.datos));
      assert.equal(previewTrue.preview.copiar_becas, true);

      const conBeca = await confirmarPromocion(previewTrue.preview, {
        copiar_becas: true,
      });
      assert.equal(conBeca.respuesta.status, 200, detalleHttp(conBeca.respuesta, conBeca.datos));
      assert.ok(conBeca.resultado.conteos.becas_copiadas >= 1);

      const destConBeca = await sql(
        `SELECT b.tipo, b.porcentaje_descuento
         FROM becas b
         INNER JOIN alumnos a ON a.id_alumno = b.id_alumno
         WHERE a.anio_lectivo = $1 AND a.dni = '99999108'
         ORDER BY b.id_beca
         LIMIT 1`,
        [ANIO],
      );
      assert.equal(destConBeca[0]?.tipo, "SOCIOECONOMICA");
      assert.equal(Number(destConBeca[0]?.porcentaje_descuento), 50);

      registrar(
        57,
        "Promoción: copiar_becas invalida el hash y copia solo si se confirma",
        "PASS",
        `hash viejo 409, copiadas=${conBeca.resultado.conteos.becas_copiadas}`,
      );
    },
  );

  // 58. PENDIENTE no se confirma y no crea fila.
  await prueba(
    58,
    "Promoción: PENDIENTE no se confirma ni crea fila CONFIRMADA",
    async () => {
      const anioAux = ANIO - 2; // 2024
      await crearOfertaPromocion(anioAux);
      const gradoAux = await gradoOrden(anioAux, 1);
      assert.ok(gradoAux, "No existe 1ro en el año auxiliar");

      const alumnoAux = await crearAlumnoPromocionAux({
        dni: "99999110",
        nombres: "Pendiente",
        apellidos: "E2E",
        idGrado: gradoAux.id_grado,
        anio: anioAux,
      });

      const politica = await crearPoliticaE2E(
        ANIO,
        {
          nombre: "E2E 2024 pendiente",
          permite_override: true,
        },
        anioAux,
      );

      const decisiones = [
        {
          id_alumno_origen: alumnoAux.id_alumno,
          resultado: "PENDIENTE",
          motivo: "Pendiente E2E para revisión de dirección",
          es_override: true,
        },
      ];
      const preview = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
        decisiones,
      });
      assert.equal(preview.respuesta.status, 200, detalleHttp(preview.respuesta, preview.datos));
      assert.equal(preview.preview.resumen.por_resultado.PENDIENTE, 1);
      assert.equal(preview.preview.resumen.bloqueados, 0);

      const rechazada = await confirmarPromocion(preview.preview, {
        decisiones,
      });
      assert.equal(
        rechazada.respuesta.status,
        422,
        detalleHttp(rechazada.respuesta, rechazada.datos),
      );
      assert.equal(
        rechazada.datos?.errors?.codigo,
        "PROMOCION_PENDIENTE",
      );

      const filas = await sql(
        `SELECT COUNT(*)::int AS total
         FROM promociones
         WHERE anio_destino = $1 AND id_alumno_origen = $2`,
        [ANIO, alumnoAux.id_alumno],
      );
      assert.equal(filas[0].total, 0, "Se creó una fila PENDIENTE confirmada");

      const reintentoPreview = await previsualizarPromocion({
        anio_origen: anioAux,
        anio_destino: ANIO,
        id_politica: politica.id_politica,
        id_grado: gradoAux.id_grado,
        incluir_retirados: false,
      });
      assert.equal(reintentoPreview.respuesta.status, 200, detalleHttp(reintentoPreview.respuesta, reintentoPreview.datos));
      const reintento = await confirmarPromocion(reintentoPreview.preview);
      assert.equal(reintento.respuesta.status, 200, detalleHttp(reintento.respuesta, reintento.datos));

      const confirmada = await sql(
        `SELECT resultado FROM promociones
         WHERE anio_destino = $1 AND id_alumno_origen = $2
           AND estado = 'CONFIRMADA'
         LIMIT 1`,
        [ANIO, alumnoAux.id_alumno],
      );
      assert.equal(confirmada[0]?.resultado, "PROMOVIDO");

      registrar(
        58,
        "Promoción: PENDIENTE no se confirma ni crea fila CONFIRMADA",
        "PASS",
        `PENDIENTE 422, reintento PROMOVIDO`,
      );
    },
  );

  // ============================================================
  // FASE 6.4 — HISTÓRICO POR AÑO Y CONSOLIDADO POR ESTUDIANTE
  // ============================================================
  const ANIO_HIST_1 = ANIO - 1; // 2025
  const ANIO_HIST_2 = ANIO; // 2026
  const ANIO_HIST_3 = ANIO + 1; // 2027
  const DNI_HIST = "99999201";
  const DNI_HIST_OTRO = "99999202";

  let historico = null;

  const insertarMatriculaAnual = async ({
    idUsuario,
    dni,
    nombres,
    apellidos,
    idGrado,
    anio,
    codigo,
    estado = "Matriculado",
  }) => {
    const filas = await sql(
      `INSERT INTO alumnos (
         id_usuario, dni, nombres, apellidos, fecha_nacimiento,
         id_apoderado, id_grado, condicion, estado_matricula,
         codigo_estudiante, anio_lectivo
       )
       VALUES ($1, $2, $3, $4, '2012-05-10', NULL, $5, 'Regular', $6, $7, $8)
       RETURNING *`,
      [
        idUsuario,
        dni,
        nombres,
        apellidos,
        idGrado,
        estado,
        codigo,
        anio,
      ],
    );
    return filas[0];
  };

  const prepararHistorico = async () => {
    if (historico) return historico;

    await crearOfertaPromocion(ANIO_HIST_1);
    await crearOfertaPromocion(ANIO_HIST_3);

    const grado1 = await gradoOrden(ANIO_HIST_1, 1);
    const grado2 = await gradoOrden(ANIO_HIST_2, 2);
    const grado3 = await gradoOrden(ANIO_HIST_3, 2);
    assert.ok(grado1, "No existe 1ro en el año histórico 1");
    assert.ok(grado2, "No existe 2do en el año histórico 2");
    assert.ok(grado3, "No existe 2do en el año histórico 3");

    const fila1 = await crearAlumnoPromocionAux({
      dni: DNI_HIST,
      nombres: "Histórico",
      apellidos: "E2E",
      idGrado: grado1.id_grado,
      anio: ANIO_HIST_1,
    });

    const fila2 = await insertarMatriculaAnual({
      idUsuario: fila1.id_usuario,
      dni: DNI_HIST,
      nombres: "Histórico",
      apellidos: "E2E",
      idGrado: grado2.id_grado,
      anio: ANIO_HIST_2,
      codigo: "HIST-9201-2",
    });

    const fila3 = await insertarMatriculaAnual({
      idUsuario: fila1.id_usuario,
      dni: DNI_HIST,
      nombres: "Histórico",
      apellidos: "E2E",
      idGrado: grado3.id_grado,
      anio: ANIO_HIST_3,
      codigo: "HIST-9201-3",
    });

    const filaOtro = await crearAlumnoPromocionAux({
      dni: DNI_HIST_OTRO,
      nombres: "Otro",
      apellidos: "Año",
      idGrado: grado3.id_grado,
      anio: ANIO_HIST_3,
    });

    const cursos = await sql(
      `SELECT id_curso FROM cursos ORDER BY id_curso LIMIT 5`,
    );
    assert.ok(cursos.length >= 3, "No hay cursos suficientes para el E2E");

    for (const [indice, nota] of ["AD", "AD", "A"].entries()) {
      await sql(
        `INSERT INTO notas_finales_area
           (id_alumno, id_curso, bimestre, anio_lectivo, nota_final, calculo_automatico)
         VALUES ($1, $2, 1, $3, $4, false)
         ON CONFLICT (id_alumno, id_curso, bimestre, anio_lectivo)
         DO UPDATE SET nota_final = EXCLUDED.nota_final`,
        [fila2.id_alumno, cursos[indice].id_curso, ANIO_HIST_2, nota],
      );
    }

    for (const [indice, nota] of ["B", "C"].entries()) {
      await sql(
        `INSERT INTO notas_finales_area
           (id_alumno, id_curso, bimestre, anio_lectivo, nota_final, calculo_automatico)
         VALUES ($1, $2, 1, $3, $4, false)
         ON CONFLICT (id_alumno, id_curso, bimestre, anio_lectivo)
         DO UPDATE SET nota_final = EXCLUDED.nota_final`,
        [fila3.id_alumno, cursos[indice + 1].id_curso, ANIO_HIST_3, nota],
      );
    }

    for (const [fecha, estado] of [
      [`${ANIO_HIST_2}-05-04`, "P"],
      [`${ANIO_HIST_2}-05-05`, "P"],
      [`${ANIO_HIST_2}-05-06`, "F"],
    ]) {
      await sql(
        `INSERT INTO asistencia_alumnos
           (id_alumno, id_curso, id_grado, fecha, dia_semana, estado)
         VALUES ($1, $2, $3, $4, 'Lunes', $5)`,
        [fila2.id_alumno, cursos[0].id_curso, grado2.id_grado, fecha, estado],
      );
    }

    for (const [fecha, estado] of [
      [`${ANIO_HIST_3}-05-04`, "P"],
      [`${ANIO_HIST_3}-05-05`, "T"],
    ]) {
      await sql(
        `INSERT INTO asistencia_alumnos
           (id_alumno, id_curso, id_grado, fecha, dia_semana, estado)
         VALUES ($1, $2, $3, $4, 'Martes', $5)`,
        [fila3.id_alumno, cursos[1].id_curso, grado3.id_grado, fecha, estado],
      );
    }

    await sql(
      `INSERT INTO pensiones
         (id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado)
       VALUES
         ($1, $2, 3, 100.00, 0, 100.00, 'PAGADO'),
         ($1, $2, 4, 150.00, 0, 150.00, 'PENDIENTE')`,
      [fila2.id_alumno, ANIO_HIST_2],
    );

    await sql(
      `INSERT INTO pensiones
         (id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado)
       VALUES ($1, $2, 3, 200.00, 0, 200.00, 'PENDIENTE')`,
      [fila3.id_alumno, ANIO_HIST_3],
    );

    const concepto = await sql(
      `SELECT id_concepto FROM conceptos_pago
       WHERE anio_lectivo = $1 AND tipo = 'MATRICULA'
       ORDER BY id_concepto
       LIMIT 1`,
      [ANIO_HIST_2],
    );
    assert.ok(concepto[0], "No hay concepto MATRICULA para el año histórico");

    await sql(
      `INSERT INTO pagos
         (id_alumno, id_concepto, monto, forma_pago, nro_operacion, estado)
       VALUES ($1, $2, 100.00, 'Efectivo', 'HIST-9201', 'PAGADO')`,
      [fila2.id_alumno, concepto[0].id_concepto],
    );

    historico = {
      fila1,
      fila2,
      fila3,
      filaOtro,
      cursos,
      grado2,
      grado3,
    };
    return historico;
  };

  // 59. Listados por año no mezclan matrículas.
  await prueba(
    59,
    "Histórico: /alumnos?anio=2026 y 2027 no mezclan filas",
    async () => {
      const h = await prepararHistorico();

      const respuesta2026 = await api(
        `/alumnos?anio=${ANIO_HIST_2}&search=${DNI_HIST}`,
        { token: ctx.adminToken },
      );
      const datos2026 = await leerJson(respuesta2026);
      assert.equal(respuesta2026.status, 200, detalleHttp(respuesta2026, datos2026));
      const filas2026 = datos2026.datos?.data || [];
      assert.equal(filas2026.length, 1, "2026 debe devolver una sola matrícula");
      assert.equal(Number(filas2026[0].id_alumno), Number(h.fila2.id_alumno));
      assert.ok(
        filas2026.every((fila) => Number(fila.anio_lectivo) === ANIO_HIST_2),
        "El listado 2026 mezcló otro año",
      );

      const respuesta2027 = await api(
        `/alumnos?anio=${ANIO_HIST_3}&search=9999920`,
        { token: ctx.adminToken },
      );
      const datos2027 = await leerJson(respuesta2027);
      assert.equal(respuesta2027.status, 200, detalleHttp(respuesta2027, datos2027));
      const filas2027 = datos2027.datos?.data || [];
      assert.equal(filas2027.length, 2, "2027 debe devolver dos matrículas E2E");
      assert.ok(
        filas2027.every((fila) => Number(fila.anio_lectivo) === ANIO_HIST_3),
        "El listado 2027 mezcló otro año",
      );

      const ids2026 = new Set(filas2026.map((fila) => Number(fila.id_alumno)));
      assert.ok(
        filas2027.every((fila) => !ids2026.has(Number(fila.id_alumno))),
        "Los listados de 2026 y 2027 comparten id_alumno",
      );

      registrar(
        59,
        "Histórico: /alumnos?anio=2026 y 2027 no mezclan filas",
        "PASS",
        `2026=${filas2026.length}, 2027=${filas2027.length}, ids distintos`,
      );
    },
  );

  // 60. /alumnos/dni/:dni?anio devuelve la matrícula correcta.
  await prueba(
    60,
    "Histórico: /alumnos/dni devuelve la matrícula del año pedido",
    async () => {
      const h = await prepararHistorico();

      const casos = [
        [ANIO_HIST_1, h.fila1.id_alumno],
        [ANIO_HIST_2, h.fila2.id_alumno],
        [ANIO_HIST_3, h.fila3.id_alumno],
      ];

      for (const [anio, idEsperado] of casos) {
        const respuesta = await api(
          `/alumnos/dni/${DNI_HIST}?anio=${anio}`,
          { token: ctx.adminToken },
        );
        const datos = await leerJson(respuesta);
        assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
        assert.equal(Number(datos.datos?.data?.id_alumno), Number(idEsperado));
        assert.equal(Number(datos.datos?.data?.anio_lectivo), anio);
      }

      const inexistente = await api(
        `/alumnos/dni/${DNI_HIST}?anio=${ANIO_HIST_3 + 1}`,
        { token: ctx.adminToken },
      );
      const datosInexistente = await leerJson(inexistente);
      assert.equal(
        inexistente.status,
        404,
        detalleHttp(inexistente, datosInexistente),
      );
      assert.equal(
        datosInexistente.datos?.errors?.codigo,
        "MATRICULA_NO_ENCONTRADA_EN_ANIO",
      );

      const activo = await sql(
        `SELECT anio FROM anios_lectivos WHERE estado = 'ACTIVO' LIMIT 1`,
      );
      const anioActivo = Number(activo[0]?.anio);
      const porDefecto = await api(`/alumnos/dni/${DNI_HIST}`, {
        token: ctx.adminToken,
      });
      const datosPorDefecto = await leerJson(porDefecto);
      const aniosHistoricos = [ANIO_HIST_1, ANIO_HIST_2, ANIO_HIST_3];
      if (aniosHistoricos.includes(anioActivo)) {
        assert.equal(porDefecto.status, 200, detalleHttp(porDefecto, datosPorDefecto));
        assert.equal(
          Number(datosPorDefecto.datos?.data?.anio_lectivo),
          anioActivo,
        );
      } else {
        assert.equal(
          porDefecto.status,
          404,
          "Sin ?anio debe usar el año activo y no devolver un histórico",
        );
      }

      registrar(
        60,
        "Histórico: /alumnos/dni devuelve la matrícula del año pedido",
        "PASS",
        `2025/2026/2027 OK, ${ANIO_HIST_3 + 1} 404, default=${anioActivo}`,
      );
    },
  );

  // 61. Libreta, asistencia y pensiones de un año no incluyen otro.
  await prueba(
    61,
    "Histórico: libreta, asistencia y pensiones no mezclan años",
    async () => {
      const h = await prepararHistorico();

      const libreta2026 = await api(
        `/reportes/libreta/${h.fila2.id_alumno}?bimestre=1&anio=${ANIO_HIST_2}`,
        { token: ctx.adminToken },
      );
      const datosLibreta2026 = await leerJson(libreta2026);
      assert.equal(
        libreta2026.status,
        200,
        detalleHttp(libreta2026, datosLibreta2026),
      );
      const notas2026 = (datosLibreta2026.datos?.data?.notas || []).filter(
        (nota) => !!nota.nota_final,
      );
      assert.equal(notas2026.length, 3, "La libreta 2026 no tiene 3 notas");
      assert.equal(Number(datosLibreta2026.datos?.data?.anio_lectivo), ANIO_HIST_2);

      const libreta2025 = await api(
        `/reportes/libreta/${h.fila1.id_alumno}?bimestre=1&anio=${ANIO_HIST_1}`,
        { token: ctx.adminToken },
      );
      const datosLibreta2025 = await leerJson(libreta2025);
      assert.equal(libreta2025.status, 200, detalleHttp(libreta2025, datosLibreta2025));
      const notas2025 = (datosLibreta2025.datos?.data?.notas || []).filter(
        (nota) => !!nota.nota_final,
      );
      assert.equal(
        notas2025.length,
        0,
        "La libreta 2025 incluyó notas de otro año",
      );

      const asistencia2026 = await api(
        `/asistencias/alumno/${h.fila2.id_alumno}?anio=${ANIO_HIST_2}`,
        { token: ctx.adminToken },
      );
      const datosAsistencia2026 = await leerJson(asistencia2026);
      assert.equal(
        asistencia2026.status,
        200,
        detalleHttp(asistencia2026, datosAsistencia2026),
      );
      const filasAsistencia2026 = datosAsistencia2026.datos?.data || [];
      assert.equal(filasAsistencia2026.length, 3);
      assert.ok(
        filasAsistencia2026.every(
          (fila) => Number(String(fila.fecha).slice(0, 4)) === ANIO_HIST_2,
        ),
        "La asistencia 2026 incluyó fechas de otro año",
      );

      const asistencia2027 = await api(
        `/asistencias/alumno/${h.fila3.id_alumno}?anio=${ANIO_HIST_3}`,
        { token: ctx.adminToken },
      );
      const datosAsistencia2027 = await leerJson(asistencia2027);
      assert.equal(asistencia2027.status, 200, detalleHttp(asistencia2027, datosAsistencia2027));
      const filasAsistencia2027 = datosAsistencia2027.datos?.data || [];
      assert.equal(filasAsistencia2027.length, 2);
      assert.ok(
        filasAsistencia2027.every(
          (fila) => Number(String(fila.fecha).slice(0, 4)) === ANIO_HIST_3,
        ),
        "La asistencia 2027 incluyó fechas de otro año",
      );

      const pensiones2026 = await api(
        `/tesoreria/pensiones/alumno/${h.fila2.id_alumno}?anio=${ANIO_HIST_2}`,
        { token: ctx.adminToken },
      );
      const datosPensiones2026 = await leerJson(pensiones2026);
      assert.equal(
        pensiones2026.status,
        200,
        detalleHttp(pensiones2026, datosPensiones2026),
      );
      const filasPensiones2026 = datosPensiones2026.datos?.data || [];
      assert.equal(filasPensiones2026.length, 2);
      assert.equal(Number(filasPensiones2026[0].monto_final), 100);

      const pensionesCruzadas = await api(
        `/tesoreria/pensiones/alumno/${h.fila2.id_alumno}?anio=${ANIO_HIST_3}`,
        { token: ctx.adminToken },
      );
      const datosPensionesCruzadas = await leerJson(pensionesCruzadas);
      assert.equal(
        pensionesCruzadas.status,
        404,
        detalleHttp(pensionesCruzadas, datosPensionesCruzadas),
      );
      assert.equal(
        datosPensionesCruzadas.datos?.errors?.codigo,
        "MATRICULA_NO_ENCONTRADA_EN_ANIO",
      );

      registrar(
        61,
        "Histórico: libreta, asistencia y pensiones no mezclan años",
        "PASS",
        "2025 sin notas, 2026=3 asistencias, 2027=2, pensiones cruzadas 404",
      );
    },
  );

  // 62. id_alumno de otro año en asistencia/calificaciones → 404.
  await prueba(
    62,
    "Histórico: id_alumno de otro año responde 404 en asistencia y notas",
    async () => {
      const h = await prepararHistorico();

      const rutas = [
        `/asistencias/alumno/${h.fila3.id_alumno}?anio=${ANIO_HIST_2}`,
        `/asistencias/alumno/${h.fila3.id_alumno}/resumen?anio=${ANIO_HIST_2}`,
        `/calificaciones/notas-finales/alumno/${h.fila3.id_alumno}?anio=${ANIO_HIST_2}`,
        `/calificaciones/alumno/${h.fila3.id_alumno}/curso/${h.cursos[0].id_curso}?anio=${ANIO_HIST_2}`,
        `/reportes/libreta/${h.fila3.id_alumno}?bimestre=1&anio=${ANIO_HIST_2}`,
      ];

      for (const ruta of rutas) {
        const respuesta = await api(ruta, { token: ctx.adminToken });
        const datos = await leerJson(respuesta);
        assert.equal(respuesta.status, 404, `${ruta} ${detalleHttp(respuesta, datos)}`);
        assert.equal(
          datos.datos?.errors?.codigo,
          "MATRICULA_NO_ENCONTRADA_EN_ANIO",
          `${ruta} no devolvió MATRICULA_NO_ENCONTRADA_EN_ANIO`,
        );
      }

      registrar(
        62,
        "Histórico: id_alumno de otro año responde 404 en asistencia y notas",
        "PASS",
        `${rutas.length} endpoints con 404 MATRICULA_NO_ENCONTRADA_EN_ANIO`,
      );
    },
  );

  // 63. Consolidado por DNI: una fila por año agrupada por usuario.
  await prueba(
    63,
    "Histórico: consolidado por DNI agrupa por usuario y separa años",
    async () => {
      const h = await prepararHistorico();

      const respuesta = await api(`/reportes/consolidado/${DNI_HIST}`, {
        token: ctx.adminToken,
      });
      const datos = await leerJson(respuesta);
      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));

      const consolidado = datos.datos?.data;
      assert.ok(consolidado?.usuario, "El consolidado no devolvió usuario");
      assert.equal(consolidado.usuario.dni, DNI_HIST);
      assert.equal(
        Number(consolidado.usuario.id_usuario),
        Number(h.fila1.id_usuario),
      );
      assert.equal(consolidado.anios.length, 3, "Debe devolver 3 años");

      const porAnio = new Map(
        consolidado.anios.map((fila) => [Number(fila.anio), fila]),
      );
      assert.deepEqual(
        [...porAnio.keys()].sort(),
        [ANIO_HIST_1, ANIO_HIST_2, ANIO_HIST_3].sort(),
      );
      assert.equal(
        new Set(consolidado.anios.map((fila) => Number(fila.id_usuario))).size,
        1,
        "El consolidado no está agrupado por id_usuario",
      );
      assert.equal(
        new Set(consolidado.anios.map((fila) => Number(fila.id_alumno))).size,
        3,
        "Cada año debe tener su propio id_alumno",
      );

      const fila2026 = porAnio.get(ANIO_HIST_2);
      assert.equal(Number(fila2026.notas_ad), 2);
      assert.equal(Number(fila2026.notas_a), 1);
      assert.equal(Number(fila2026.notas_c), 0);
      assert.equal(Number(fila2026.total_notas), 3);
      assert.equal(Number(fila2026.total_asistencias), 3);
      assert.equal(Number(fila2026.total_faltas), 1);
      assert.ok(
        Math.abs(Number(fila2026.porcentaje_asistencia) - 66.67) < 0.01,
        `Asistencia 2026 inesperada: ${fila2026.porcentaje_asistencia}`,
      );
      assert.equal(Number(fila2026.total_pagado), 100);
      assert.equal(Number(fila2026.deuda_pendiente), 150);
      assert.equal(Number(fila2026.total_pensiones), 2);
      assert.equal(Number(fila2026.pensiones_pagadas), 1);

      const fila2027 = porAnio.get(ANIO_HIST_3);
      assert.equal(Number(fila2027.notas_b), 1);
      assert.equal(Number(fila2027.notas_c), 1);
      assert.equal(Number(fila2027.total_notas), 2);
      assert.equal(Number(fila2027.total_asistencias), 2);
      assert.equal(Number(fila2027.porcentaje_asistencia), 50);
      assert.equal(Number(fila2027.total_pagado), 0);
      assert.equal(Number(fila2027.deuda_pendiente), 200);
      assert.equal(Number(fila2027.total_pensiones), 1);

      const fila2025 = porAnio.get(ANIO_HIST_1);
      assert.equal(Number(fila2025.total_notas), 0);
      assert.equal(Number(fila2025.total_pagado), 0);
      assert.equal(Number(fila2025.deuda_pendiente), 0);

      assert.equal(Number(consolidado.totales.anios), 3);
      assert.equal(Number(consolidado.totales.total_pagado), 100);
      assert.equal(Number(consolidado.totales.deuda_pendiente), 350);
      assert.equal(Number(consolidado.totales.total_notas), 5);

      registrar(
        63,
        "Histórico: consolidado por DNI agrupa por usuario y separa años",
        "PASS",
        `3 años, pagado=100, deuda=350, notas=AD2/A1/B1/C1`,
      );
    },
  );

  // 64. RBAC del consolidado y del catálogo de años.
  await prueba(
    64,
    "Histórico: ADMIN/SECRETARIA leen; DOCENTE/ESTUDIANTE reciben 403",
    async () => {
      await prepararHistorico();

      const docente = await iniciarSesion(
        "DOCENTE",
        credenciales.DOCENTE[0],
        credenciales.DOCENTE[1],
      );
      const estudiante = await iniciarSesion(
        "ESTUDIANTE",
        credenciales.ESTUDIANTE[0],
        credenciales.ESTUDIANTE[1],
      );
      const secretaria = await iniciarSesion(
        "SECRETARIA",
        process.env.SMOKE_SECRETARIA_DNI || "40596837",
        process.env.SMOKE_SECRETARIA_PASSWORD ||
          process.env.SMOKE_ADMIN_PASSWORD,
      );

      const adminConsolidado = await api(`/reportes/consolidado/${DNI_HIST}`, {
        token: ctx.adminToken,
      });
      assert.equal(adminConsolidado.status, 200);

      const secretariaConsolidado = await api(
        `/reportes/consolidado/${DNI_HIST}`,
        { token: secretaria.token },
      );
      assert.equal(
        secretariaConsolidado.status,
        200,
        "SECRETARIA debe leer el consolidado",
      );

      for (const [rol, token] of [
        ["DOCENTE", docente.token],
        ["ESTUDIANTE", estudiante.token],
      ]) {
        const respuesta = await api(`/reportes/consolidado/${DNI_HIST}`, {
          token,
        });
        assert.equal(
          respuesta.status,
          403,
          `${rol} no debe leer el consolidado`,
        );
      }

      const aniosSecretaria = await api("/anios-lectivos", {
        token: secretaria.token,
      });
      assert.equal(
        aniosSecretaria.status,
        200,
        "SECRETARIA debe leer el catálogo de años",
      );

      const aniosDocente = await api("/anios-lectivos", {
        token: docente.token,
      });
      assert.equal(aniosDocente.status, 403);

      const escrituraSecretaria = await api("/anios-lectivos/preview", {
        method: "POST",
        token: secretaria.token,
        body: { anio_origen: ANIO_HIST_2, anio_destino: ANIO_HIST_3 },
      });
      assert.equal(
        escrituraSecretaria.status,
        403,
        "SECRETARIA no debe ejecutar el preview de rollover",
      );

      const activarSecretaria = await api(
        `/anios-lectivos/${ANIO_HIST_3 + 1}/activar`,
        {
          method: "PUT",
          token: secretaria.token,
          body: { confirmar: true },
        },
      );
      assert.equal(
        activarSecretaria.status,
        403,
        "SECRETARIA no debe activar años",
      );

      registrar(
        64,
        "Histórico: ADMIN/SECRETARIA leen; DOCENTE/ESTUDIANTE reciben 403",
        "PASS",
        "consolidado y años OK, escritura de años 403",
      );
    },
  );

  // 65. Contrato de UI: selector de año, modo histórico y enlaces.
  await prueba(
    65,
    "Histórico: UI tiene selector, modo read-only y enlaces con ?anio",
    async () => {
      const leer = (rutaRelativa) =>
        fs.readFileSync(path.join(RAIZ_REPO, rutaRelativa), "utf8");

      const selector = leer(
        "siga-uc-frontend/src/app/shared/components/selector-anio/selector-anio.component.ts",
      );
      assert.ok(selector.includes("Histórico"), "El selector no marca histórico");
      assert.ok(selector.includes("anioChange"), "El selector no emite cambios");

      const alumnosHtml = leer(
        "siga-uc-frontend/src/app/features/admin/alumnos/admin-alumnos.component.html",
      );
      assert.ok(alumnosHtml.includes("app-selector-anio"));
      assert.ok(alumnosHtml.includes("esHistorico()"));
      assert.ok(alumnosHtml.includes("Nueva Matrícula"));

      const alumnosTs = leer(
        "siga-uc-frontend/src/app/features/admin/alumnos/admin-alumnos.component.ts",
      );
      assert.ok(alumnosTs.includes("esHistorico"));
      assert.ok(alumnosTs.includes("solo lectura"));

      const reportesHtml = leer(
        "siga-uc-frontend/src/app/features/admin/reportes/admin-reportes.component.html",
      );
      assert.ok(reportesHtml.includes("app-selector-anio"));

      const tesoreriaHtml = leer(
        "siga-uc-frontend/src/app/features/secretaria/tesoreria/secretaria-tesoreria.component.html",
      );
      assert.ok(tesoreriaHtml.includes("app-selector-anio"));
      assert.ok(tesoreriaHtml.includes("esHistorico()"));

      const historicoHtml = leer(
        "siga-uc-frontend/src/app/features/admin/historico/admin-historico.component.html",
      );
      assert.ok(historicoHtml.includes("queryParams"));
      assert.ok(historicoHtml.includes("anio: fila.anio"));
      assert.ok(historicoHtml.includes("/admin/reportes"));
      assert.ok(historicoHtml.includes("/admin/tesoreria"));

      const rutas = leer("siga-uc-frontend/src/app/app.routes.ts");
      assert.ok(rutas.includes("'historico'"));

      const sidebar = leer(
        "siga-uc-frontend/src/app/shared/components/sidebar/sidebar.component.ts",
      );
      assert.ok(sidebar.includes("/admin/historico"));

      registrar(
        65,
        "Histórico: UI tiene selector, modo read-only y enlaces con ?anio",
        "PASS",
        "selector, badge, acciones ocultas y deep links verificados",
      );
    },
  );

  // ============================================================
  // FASE 7 — SEGURIDAD, DATOS Y TEXTO DE DEMO
  // ============================================================

  // 66. H62: DOCENTE no puede enviar notificaciones individuales.
  await prueba(
    66,
    "H62: DOCENTE no envía notificaciones; ADMIN/SECRETARIA sí",
    async () => {
      const docente = await iniciarSesion(
        "DOCENTE",
        credenciales.DOCENTE[0],
        credenciales.DOCENTE[1],
      );

      const intentoDocente = await api("/notificaciones", {
        method: "POST",
        token: docente.token,
        body: {
          id_usuario_destino: ctx.adminId,
          asunto: "Intento DOCENTE E2E",
          cuerpo: "No debería enviarse.",
        },
      });
      assert.equal(
        intentoDocente.status,
        403,
        "DOCENTE no debe enviar notificaciones individuales",
      );

      const sinToken = await api("/notificaciones", {
        method: "POST",
        body: {
          id_usuario_destino: ctx.adminId,
          asunto: "Sin token E2E",
          cuerpo: "No debería enviarse.",
        },
      });
      assert.equal(sinToken.status, 401);

      const admin = await api("/notificaciones", {
        method: "POST",
        token: ctx.adminToken,
        body: {
          id_usuario_destino: ctx.adminId,
          asunto: "Notificación E2E H62",
          cuerpo: "Mensaje de prueba sin correo real.",
        },
      });
      const datosAdmin = await leerJson(admin);
      assert.equal(admin.status, 201, detalleHttp(admin, datosAdmin));
      assert.ok(datosAdmin.datos?.data?.id_notificacion);

      const secretaria = await iniciarSesion(
        "SECRETARIA",
        process.env.SMOKE_SECRETARIA_DNI || "40596837",
        process.env.SMOKE_SECRETARIA_PASSWORD ||
          process.env.SMOKE_ADMIN_PASSWORD,
      );
      const envioSecretaria = await api("/notificaciones", {
        method: "POST",
        token: secretaria.token,
        body: {
          id_usuario_destino: ctx.adminId,
          asunto: "Notificación E2E SECRETARIA",
          cuerpo: "Mensaje de prueba sin correo real.",
        },
      });
      assert.equal(
        envioSecretaria.status,
        201,
        "SECRETARIA debe conservar el envío individual",
      );

      registrar(
        66,
        "H62: DOCENTE no envía notificaciones; ADMIN/SECRETARIA sí",
        "PASS",
        "DOCENTE 403, ADMIN 201, SECRETARIA 201, sin token 401",
      );
    },
  );

  // 67. H59: la observación de cese se persiste y se lee.
  await prueba(
    67,
    "H59: cese con observación persiste; sin observación no falla",
    async () => {
      const dni = "99999301";
      const creado = await api("/personal", {
        method: "POST",
        token: ctx.adminToken,
        body: {
          dni,
          nombres: "Cese",
          apellidos: "Observación",
          id_rol: 2,
          correo_personal: `cese.${dni}@e2e.local`,
          telefono: "999999999",
          password: dni,
        },
      });
      const datosCreado = await leerJson(creado);
      assert.equal(creado.status, 201, detalleHttp(creado, datosCreado));
      const idPersonal = datosCreado.datos?.data?.id_personal;
      assert.ok(idPersonal, "El alta de personal no devolvió id_personal");

      const observacion =
        "Entrega de cargo completa y sin pendientes documentarios.";
      const cese = await api(`/personal/${idPersonal}/cesar`, {
        method: "PUT",
        token: ctx.adminToken,
        body: {
          motivo_cese: "Renuncia Voluntaria",
          fecha_cese: `${ANIO_HIST_2}-11-20`,
          observaciones: observacion,
        },
      });
      const datosCese = await leerJson(cese);
      assert.equal(cese.status, 200, detalleHttp(cese, datosCese));
      assert.equal(datosCese.datos?.data?.observaciones, observacion);

      const ficha = await api(`/personal/${idPersonal}`, {
        token: ctx.adminToken,
      });
      const datosFicha = await leerJson(ficha);
      assert.equal(ficha.status, 200, detalleHttp(ficha, datosFicha));
      assert.equal(datosFicha.datos?.data?.observaciones, observacion);

      const enBase = await sql(
        `SELECT observaciones, motivo_cese
         FROM personal WHERE id_personal = $1`,
        [idPersonal],
      );
      assert.equal(enBase[0]?.observaciones, observacion);
      assert.equal(enBase[0]?.motivo_cese, "Renuncia Voluntaria");

      const reactivar = await api(`/personal/${idPersonal}/reactivar`, {
        method: "PUT",
        token: ctx.adminToken,
        body: {},
      });
      assert.equal(reactivar.status, 200);

      const ceseSinObservacion = await api(
        `/personal/${idPersonal}/cesar`,
        {
          method: "PUT",
          token: ctx.adminToken,
          body: {
            motivo_cese: "Término de Contrato",
            fecha_cese: `${ANIO_HIST_2}-12-15`,
          },
        },
      );
      const datosSinObservacion = await leerJson(ceseSinObservacion);
      assert.equal(
        ceseSinObservacion.status,
        200,
        detalleHttp(ceseSinObservacion, datosSinObservacion),
      );
      assert.equal(
        datosSinObservacion.datos?.data?.observaciones,
        null,
        "El cese sin observación no debe inventar texto",
      );

      registrar(
        67,
        "H59: cese con observación persiste; sin observación no falla",
        "PASS",
        `personal=${idPersonal}, observación persistida y limpiada al reactivar`,
      );
    },
  );

  // 68. H59: correo de apoderado sin nombres se rechaza.
  await prueba(
    68,
    "H59: apoderado con correo pero sin nombres responde 400",
    async () => {
      const dni = "99999302";
      const respuesta = await api("/alumnos", {
        method: "POST",
        token: ctx.adminToken,
        body: {
          dni,
          nombres: "Apoderado",
          apellidos: "SinNombres",
          fecha_nacimiento: "2012-05-10",
          id_grado: 1,
          apoderado: { correo: "apoderado@e2e.local" },
        },
      });
      const datos = await leerJson(respuesta);
      assert.equal(respuesta.status, 400, detalleHttp(respuesta, datos));
      assert.match(
        String(datos.datos?.message || ""),
        /nombres y apellidos/i,
      );

      const creados = await sql(
        `SELECT COUNT(*)::int AS total FROM alumnos WHERE dni = $1`,
        [dni],
      );
      assert.equal(creados[0].total, 0, "No debe crear al alumno sin apoderado válido");

      registrar(
        68,
        "H59: apoderado con correo pero sin nombres responde 400",
        "PASS",
        "400 y 0 matrículas creadas",
      );
    },
  );

  // 69. H65: el dashboard separa docentes y personal activo.
  await prueba(
    69,
    "H65: dashboard distingue docentes de personal activo",
    async () => {
      const respuesta = await api(`/reportes/dashboard?anio=${ANIO_HIST_2}`, {
        token: ctx.adminToken,
      });
      const datos = await leerJson(respuesta);
      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));

      const esperado = await sql(
        `SELECT
           (SELECT COUNT(*)::int FROM personal WHERE fecha_cese IS NULL)
             AS personal,
           (SELECT COUNT(*)::int
            FROM personal p
            INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
            WHERE p.fecha_cese IS NULL
              AND u.estado = 'ACTIVO'
              AND u.id_rol = 2) AS docentes`,
      );

      const data = datos.datos?.data || {};
      assert.equal(Number(data.total_personal), esperado[0].personal);
      assert.equal(Number(data.total_docentes), esperado[0].docentes);
      assert.ok(
        Number(data.total_docentes) <= Number(data.total_personal),
        "Los docentes no pueden superar al personal activo",
      );

      registrar(
        69,
        "H65: dashboard distingue docentes de personal activo",
        "PASS",
        `docentes=${data.total_docentes}, personal=${data.total_personal}`,
      );
    },
  );

  // 70. H67: grados y cursos vienen del catálogo real.
  await prueba(
    70,
    "H67: filtros y textos usan grados/cursos de la API",
    async () => {
      const leer = (rutaRelativa) =>
        fs.readFileSync(path.join(RAIZ_REPO, rutaRelativa), "utf8");

      const alumnosHtml = leer(
        "siga-uc-frontend/src/app/features/admin/alumnos/admin-alumnos.component.html",
      );
      assert.ok(
        alumnosHtml.includes("@for (g of grados(); track"),
        "El filtro de grados no usa grados() de la API",
      );
      assert.ok(
        !alumnosHtml.includes('<option value="1">1ro de Secundaria</option>'),
        "El filtro de grados sigue hardcodeado",
      );

      const cargaHtml = leer(
        "siga-uc-frontend/src/app/features/admin/carga-curricular/admin-carga-curricular.component.html",
      );
      assert.ok(
        cargaHtml.includes("cursos().length"),
        "El texto de carga curricular no usa cursos().length",
      );
      assert.ok(!cargaHtml.includes("11 cursos"));

      registrar(
        70,
        "H67: filtros y textos usan grados/cursos de la API",
        "PASS",
        "grados() y cursos().length sin 1–5 ni 11 fijos",
      );
    },
  );

  // 71. H68: no se promete firma digital sobre MD5.
  await prueba(
    71,
    "H68: la UI y el PDF hablan de hash de integridad, no de firma digital",
    async () => {
      const leer = (rutaRelativa) =>
        fs.readFileSync(path.join(RAIZ_REPO, rutaRelativa), "utf8");

      const actaPdf = leer(
        "siga-uc-backend/src/services/actaPdfService.js",
      );
      assert.ok(
        actaPdf.includes("HASH DE INTEGRIDAD"),
        "El PDF del acta no rotula el hash de integridad",
      );
      assert.ok(
        !/firmado digitalmente/i.test(actaPdf),
        "El PDF sigue diciendo 'Firmado digitalmente'",
      );

      const cajaHtml = leer(
        "siga-uc-frontend/src/app/features/secretaria/caja/secretaria-caja.component.html",
      );
      assert.ok(cajaHtml.includes("Cerrar caja"));
      assert.ok(!/firmar y cerrar/i.test(cajaHtml));

      const auditoriaHtml = leer(
        "siga-uc-frontend/src/app/features/admin/auditoria/admin-auditoria.component.html",
      );
      assert.ok(/hash de integridad/i.test(auditoriaHtml));
      assert.ok(!/firma digital/i.test(auditoriaHtml));

      registrar(
        71,
        "H68: la UI y el PDF hablan de hash de integridad, no de firma digital",
        "PASS",
        "hash de integridad / cierre; sin firma digital",
      );
    },
  );

  // 72. H69/H70: textos de demo, lang y placeholders eliminados.
  await prueba(
    72,
    "H69: textos de demo, lang y placeholders eliminados",
    async () => {
      const raizFrontend = path.join(RAIZ_REPO, "siga-uc-frontend", "src");
      const recorrer = (directorio) =>
        fs.readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
          const ruta = path.join(directorio, entrada.name);
          return entrada.isDirectory() ? recorrer(ruta) : [ruta];
        });

      const archivos = recorrer(raizFrontend).filter((archivo) =>
        /\.(ts|html|scss|json)$/i.test(archivo),
      );
      assert.ok(archivos.length > 50, "No se pudieron leer los archivos del frontend");

      const prohibidos = [
        "Facturación",
        "(Decorativo)",
        'lang="en"',
        "SigaUcFrontend",
        "en desarrollo",
        "Docente de Área",
        "11 cursos",
        "Firmar y Cerrar",
        "Firmado digitalmente",
      ];

      for (const archivo of archivos) {
        const texto = fs.readFileSync(archivo, "utf8");
        for (const prohibido of prohibidos) {
          assert.ok(
            !texto.includes(prohibido),
            `${path.relative(RAIZ_REPO, archivo)} todavía contiene "${prohibido}"`,
          );
        }
      }

      const indexHtml = fs.readFileSync(
        path.join(raizFrontend, "index.html"),
        "utf8",
      );
      assert.ok(indexHtml.includes('lang="es"'));
      assert.ok(indexHtml.includes("SIGA-UC"));
      assert.ok(indexHtml.includes("I.E.P. Unión Científica"));

      const rutas = fs.readFileSync(
        path.join(raizFrontend, "app", "app.routes.ts"),
        "utf8",
      );
      assert.ok(!rutas.includes("en-construccion"));

      const loginHtml = fs.readFileSync(
        path.join(
          raizFrontend,
          "app",
          "features",
          "auth",
          "login",
          "login.component.html",
        ),
        "utf8",
      );
      assert.ok(/Modo prueba de correo/i.test(loginHtml));

      registrar(
        72,
        "H69: textos de demo, lang y placeholders eliminados",
        "PASS",
        `${archivos.length} archivos sin textos prohibidos; lang=es y modo prueba`,
      );
    },
  );

  // 73. SIAGIE interno: resumen, RBAC y parámetros.
  await prueba(
    73,
    "SIAGIE interno: resumen y permisos ADMIN/DOCENTE",
    async () => {
      const grados = await sql(
        `
          SELECT cc.id_grado, COUNT(DISTINCT cc.id_curso)::int AS cursos
          FROM carga_curricular cc
          INNER JOIN grados g ON g.id_grado = cc.id_grado
          WHERE cc.anio_lectivo = $1
            AND g.anio_lectivo = $1
          GROUP BY cc.id_grado
          ORDER BY cc.id_grado
          LIMIT 1
        `,
        [ANIO],
      );
      assert.ok(grados[0], `No hay grados con carga curricular en ${ANIO}`);
      const idGrado = grados[0].id_grado;
      ctx.siagieGrado = idGrado;

      const cursosEsperados = await sql(
        `
          SELECT COUNT(*)::int AS total
          FROM (
            SELECT cc.id_curso
            FROM carga_curricular cc
            WHERE cc.id_grado = $1 AND cc.anio_lectivo = $2
            UNION
            SELECT nf.id_curso
            FROM notas_finales_area nf
            INNER JOIN alumnos a ON a.id_alumno = nf.id_alumno
            WHERE a.id_grado = $1 AND nf.anio_lectivo = $2
          ) q
        `,
        [idGrado, ANIO],
      );
      const alumnosEsperados = await sql(
        `
          SELECT COUNT(*)::int AS total
          FROM alumnos
          WHERE id_grado = $1
            AND anio_lectivo = $2
            AND estado_matricula IN ('Matriculado', 'PendientePago')
        `,
        [idGrado, ANIO],
      );

      const respuesta = await api(
        `/siagie/resumen?anio=${ANIO}&bimestre=2&id_grado=${idGrado}`,
        { token: ctx.adminToken },
      );
      const { datos } = await leerJson(respuesta);
      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos));
      const resumen = datos?.data || {};
      assert.equal(resumen.total_cursos, cursosEsperados[0].total);
      assert.equal(resumen.total_alumnos, alumnosEsperados[0].total);
      assert.ok(resumen.total_cursos > 4, "H05 sigue limitando los cursos");
      assert.ok(resumen.total_alumnos > 0, "No hay alumnos para exportar");
      assert.equal(resumen.exportable, true);

      const docente = await iniciarSesion(
        "DOCENTE",
        credenciales.DOCENTE[0],
        credenciales.DOCENTE[1],
      );
      const prohibido = await api(
        `/siagie/resumen?anio=${ANIO}&bimestre=2&id_grado=${idGrado}`,
        { token: docente.token },
      );
      assert.equal(prohibido.status, 403, "DOCENTE no debe exportar SIAGIE");

      const sinToken = await api(
        `/siagie/resumen?anio=${ANIO}&bimestre=2&id_grado=${idGrado}`,
      );
      assert.equal(sinToken.status, 401);

      const bimestreInvalido = await api(
        `/siagie/resumen?anio=${ANIO}&bimestre=5&id_grado=${idGrado}`,
        { token: ctx.adminToken },
      );
      assert.equal(bimestreInvalido.status, 400);

      const alumno = await sql(
        `
          SELECT id_alumno, dni
          FROM alumnos
          WHERE id_grado = $1
            AND anio_lectivo = $2
            AND estado_matricula IN ('Matriculado', 'PendientePago')
          ORDER BY id_alumno
          LIMIT 1
        `,
        [idGrado, ANIO],
      );
      assert.ok(alumno[0], "No hay alumno para la prueba de exportación");
      ctx.siagieAlumno = alumno[0];

      const curso = await sql(
        `
          SELECT c.id_curso, c.nombre_curso
          FROM carga_curricular cc
          INNER JOIN cursos c ON c.id_curso = cc.id_curso
          WHERE cc.id_grado = $1 AND cc.anio_lectivo = $2
          ORDER BY c.id_curso
          LIMIT 1
        `,
        [idGrado, ANIO],
      );
      assert.ok(curso[0], "No hay curso para la conclusión descriptiva");
      ctx.siagieCurso = curso[0];

      registrar(
        73,
        "SIAGIE interno: resumen y permisos ADMIN/DOCENTE",
        "PASS",
        `grado ${idGrado}: ${resumen.total_cursos} cursos, ${resumen.total_alumnos} alumnos; DOCENTE 403`,
      );
    },
  );

  // 74. SIAGIE interno: Excel completo con todos los cursos y columnas.
  await prueba(
    74,
    "SIAGIE interno: Excel con todos los cursos, notas y conclusión",
    async () => {
      assert.ok(ctx.siagieGrado, "Falta el grado de la prueba 73");
      assert.ok(ctx.siagieAlumno, "Falta el alumno de la prueba 73");
      assert.ok(ctx.siagieCurso, "Falta el curso de la prueba 73");

      const idGrado = ctx.siagieGrado;
      const alumno = ctx.siagieAlumno;
      const cursoConclusion = ctx.siagieCurso;
      const textoConclusion =
        "Explica con claridad los procesos y justifica sus respuestas.";

      // Notas para todos los cursos de la carga del grado.
      await sql(
        `
          INSERT INTO notas_finales_area
            (id_alumno, id_curso, bimestre, anio_lectivo, nota_final, calculo_automatico)
          SELECT $1, cc.id_curso, 2, $2, 'A', false
          FROM carga_curricular cc
          WHERE cc.id_grado = $3
            AND cc.anio_lectivo = $2
          ON CONFLICT ON CONSTRAINT uq_nota_final
          DO UPDATE SET nota_final = EXCLUDED.nota_final
        `,
        [alumno.id_alumno, ANIO, idGrado],
      );

      await sql(
        `
          INSERT INTO conclusiones_descriptivas
            (id_alumno, id_curso, bimestre, anio_lectivo, descripcion)
          VALUES ($1, $2, 2, $3, $4)
          ON CONFLICT ON CONSTRAINT uq_conclusion
          DO UPDATE SET descripcion = EXCLUDED.descripcion
        `,
        [
          alumno.id_alumno,
          cursoConclusion.id_curso,
          ANIO,
          textoConclusion,
        ],
      );

      const respuesta = await api(
        `/siagie/exportar?anio=${ANIO}&bimestre=2&id_grado=${idGrado}`,
        { token: ctx.adminToken },
      );
      assert.equal(respuesta.status, 200, `Exportación HTTP ${respuesta.status}`);
      assert.match(
        String(respuesta.headers.get("content-type") || ""),
        /spreadsheetml/i,
        "Content-Type inesperado para el Excel",
      );
      const buffer = Buffer.from(await respuesta.arrayBuffer());
      assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK");

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      assert.deepEqual(
        workbook.worksheets.map((hoja) => hoja.name),
        ["Notas", "Aviso"],
      );

      const hoja = workbook.getWorksheet("Notas");
      assert.ok(hoja, "No existe la hoja Notas");
      const encabezados = hoja.getRow(1).values.slice(1);
      assert.deepEqual(encabezados, [
        "DNI",
        "Alumno",
        "Grado",
        "Sección",
        "Año",
        "Bimestre",
        "Curso",
        "Área",
        "Nota final",
        "Conclusión descriptiva",
      ]);

      const cursosEsperados = await sql(
        `
          SELECT DISTINCT c.nombre_curso
          FROM (
            SELECT cc.id_curso
            FROM carga_curricular cc
            WHERE cc.id_grado = $1 AND cc.anio_lectivo = $2
            UNION
            SELECT nf.id_curso
            FROM notas_finales_area nf
            INNER JOIN alumnos a ON a.id_alumno = nf.id_alumno
            WHERE a.id_grado = $1 AND nf.anio_lectivo = $2
          ) q
          INNER JOIN cursos c ON c.id_curso = q.id_curso
          ORDER BY c.nombre_curso
        `,
        [idGrado, ANIO],
      );
      const alumnosEsperados = await sql(
        `
          SELECT COUNT(*)::int AS total
          FROM alumnos
          WHERE id_grado = $1
            AND anio_lectivo = $2
            AND estado_matricula IN ('Matriculado', 'PendientePago')
        `,
        [idGrado, ANIO],
      );
      assert.ok(cursosEsperados.length > 4, "El grado debe tener más de 4 cursos");
      assert.equal(
        hoja.rowCount - 1,
        cursosEsperados.length * alumnosEsperados[0].total,
        "El Excel no tiene una fila por alumno y curso",
      );

      const filas = [];
      hoja.eachRow((row, numero) => {
        if (numero === 1) return;
        filas.push({
          dni: String(row.getCell(1).value ?? ""),
          alumno: String(row.getCell(2).value ?? ""),
          grado: String(row.getCell(3).value ?? ""),
          seccion: String(row.getCell(4).value ?? ""),
          anio: String(row.getCell(5).value ?? ""),
          bimestre: String(row.getCell(6).value ?? ""),
          curso: String(row.getCell(7).value ?? ""),
          area: String(row.getCell(8).value ?? ""),
          nota: String(row.getCell(9).value ?? ""),
          conclusion: String(row.getCell(10).value ?? ""),
        });
      });

      const cursosEnExcel = new Set(filas.map((fila) => fila.curso));
      assert.equal(cursosEnExcel.size, cursosEsperados.length);
      for (const curso of cursosEsperados) {
        assert.ok(
          cursosEnExcel.has(curso.nombre_curso),
          `Falta el curso ${curso.nombre_curso} en el Excel`,
        );
      }

      const filasAlumno = filas.filter((fila) => fila.dni === alumno.dni);
      assert.equal(
        filasAlumno.length,
        cursosEsperados.length,
        "El alumno no tiene una fila por curso",
      );
      assert.ok(
        filasAlumno.every((fila) => fila.nota === "A"),
        "Las notas del alumno no se volcaron al Excel",
      );
      assert.ok(
        filasAlumno.every(
          (fila) =>
            fila.grado &&
            fila.seccion &&
            fila.anio === String(ANIO) &&
            fila.bimestre === "II",
        ),
        "Faltan grado, sección, año o bimestre en el Excel",
      );
      const filaConclusion = filasAlumno.find(
        (fila) => fila.curso === cursoConclusion.nombre_curso,
      );
      assert.equal(filaConclusion?.conclusion, textoConclusion);

      const aviso = workbook.getWorksheet("Aviso");
      assert.match(
        String(aviso.getRow(2).getCell(1).value || ""),
        /No es una exportación oficial a SIAGIE\/MINEDU/,
        "El Excel no contiene el aviso de exportación interna",
      );

      const auditoria = await sql(
        `
          SELECT estado, anio_lectivo, bimestre, id_grado
          FROM exportaciones_siagie
          WHERE nombre_archivo LIKE 'EXPORTACION_INTERNA_%'
          ORDER BY id_exportacion DESC
          LIMIT 1
        `,
      );
      assert.equal(auditoria[0]?.estado, "GENERADO");
      assert.equal(Number(auditoria[0]?.anio_lectivo), ANIO);
      assert.equal(Number(auditoria[0]?.bimestre), 2);
      assert.equal(Number(auditoria[0]?.id_grado), idGrado);

      const endpointViejo = await api("/siagie/generar-excel", {
        method: "POST",
        token: ctx.adminToken,
        body: { id_grado: idGrado, bimestre: 2 },
      });
      assert.equal(
        endpointViejo.status,
        404,
        "El endpoint de carga de plantilla debería estar retirado",
      );

      registrar(
        74,
        "SIAGIE interno: Excel con todos los cursos, notas y conclusión",
        "PASS",
        `${cursosEsperados.length} cursos, ${alumnosEsperados[0].total} alumnos, aviso y auditoría`,
      );
    },
  );

  // 75. SIAGIE interno: la UI no simula portal ni análisis de plantilla.
  await prueba(
    75,
    "SIAGIE interno: UI sin portal, análisis simulado ni carga de plantilla",
    async () => {
      const leer = (rutaRelativa) =>
        fs.readFileSync(path.join(RAIZ_REPO, rutaRelativa), "utf8");

      const html = leer(
        "siga-uc-frontend/src/app/features/admin/siagie/admin-siagie.component.html",
      );
      const ts = leer(
        "siga-uc-frontend/src/app/features/admin/siagie/admin-siagie.component.ts",
      );

      assert.ok(
        html.includes(
          "Exportación interna. No es una exportación oficial a SIAGIE/MINEDU.",
        ),
        "Falta el aviso de exportación interna en la UI",
      );
      assert.ok(html.includes("Exportar Excel interno"));
      assert.ok(ts.includes("/siagie/exportar"));

      for (const prohibido of [
        "Abrir Portal",
        "Análisis Dinámico",
        "mapeado correctamente",
        "Plantilla",
        "plantilla",
      ]) {
        assert.ok(
          !html.includes(prohibido),
          `La UI todavía contiene "${prohibido}"`,
        );
        assert.ok(
          !ts.includes(prohibido),
          `El componente todavía contiene "${prohibido}"`,
        );
      }
      for (const prohibido of [
        "setTimeout",
        "archivoCargado",
        "analisisCompletado",
        "descargarPlantilla",
        "formData",
      ]) {
        assert.ok(
          !ts.includes(prohibido),
          `El componente todavía contiene "${prohibido}"`,
        );
      }

      registrar(
        75,
        "SIAGIE interno: UI sin portal, análisis simulado ni carga de plantilla",
        "PASS",
        "aviso interno; sin portal, análisis ni plantilla",
      );
    },
  );
}

async function main() {
  console.log("SIGA-UC E2E — base desechable");
  console.log(`API: ${BASE_URL}`);
  console.log(`Base: ${DB_NAME}@${DB_HOST}:${DB_PORT}`);
  console.log(
    "Seguridad: solo se permite un nombre con \"_e2e\"; no se usa DATABASE_URL.\n",
  );

  let errorPreparacion = null;

  try {
    prepararBase();
    await iniciarBackend();
    await esperarHealth();

    pool = new Pool({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      max: 5,
    });
    await pool.query("SELECT 1");

    imprimirCabeceraTabla();
    await ejecutarPruebas();
  } catch (error) {
    errorPreparacion = error;
    imprimirCabeceraTabla();
    registrar(0, "Preparación/ejecución E2E", "FAIL", describirError(error));
    imprimirLogsBackend();
  } finally {
    const limpiezaOk = await limpiar();
    const pass = resultados.filter((r) => r.estado === "PASS").length;
    const fail = resultados.filter((r) => r.estado === "FAIL").length;

    if (fail > 0) {
      imprimirLogsBackend();
    }

    console.log("");
    console.log(`${pass} PASS, ${fail} FAIL, 0 SKIP`);

    if (errorPreparacion || fail > 0) {
      console.log("Resultado: FALLO");
      process.exitCode = 1;
    } else if (!limpiezaOk) {
      console.log("Resultado: FALLO DE LIMPIEZA");
      process.exitCode = 1;
    } else {
      console.log("Resultado: OK");
      process.exitCode = 0;
    }

    if (!limpiezaOk) {
      imprimirLimpiezaManual();
    } else if (seCreoBase || seArrancoBackend) {
      console.log(
        `Limpieza verificada: backend detenido y ${DB_NAME} eliminada.`,
      );
    } else {
      console.log("No se creó base ni se arrancó backend; nada que limpiar.");
    }
  }
}

main().catch(async (error) => {
  console.error(`Error inesperado en la suite E2E: ${describirError(error)}`);
  try {
    await limpiar();
  } catch {
    imprimirLimpiezaManual();
  }
  process.exitCode = 1;
});
