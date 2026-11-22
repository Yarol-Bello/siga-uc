#!/usr/bin/env node
/**
 * Suite E2E de SIGA-UC sobre una base DESECHABLE.
 *
 * Seguridad:
 *  - Solo opera sobre una base cuyo nombre contenga "_e2e" (por defecto
 *    siga_uc_e2e). Nunca toca siga_uc ni una base de Supabase.
 *  - Crea la base, carga el dump y las migraciones, arranca el backend en el
 *    puerto 3101, ejecuta 19 flujos y al final detiene el backend y elimina la
 *    base con dropdb --force.
 *  - Si la limpieza falla, imprime los comandos manuales.
 *
 * Uso:
 *   npm run test:e2e
 *
 * Requiere las credenciales del seed en SMOKE_* (el .env local ya las tiene).
 * Nunca imprime tokens, contraseñas ni claves temporales de alumnos.
 *
 * Códigos de salida: 0 si las 14 pruebas pasan y la limpieza es correcta;
 * 1 si hay algún FAIL, falla la preparación o falla la limpieza.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { Pool } = require("pg");

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
  path.join(RAIZ_REPO, "database", "migracion_h47_horarios.sql"),
  path.join(RAIZ_REPO, "database", "migracion_h48_actas.sql"),
  path.join(RAIZ_REPO, "database", "migracion_h61_dia_semana.sql"),
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
