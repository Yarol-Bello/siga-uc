#!/usr/bin/env node
/**
 * Prueba de primera configuración (H79) sobre una base vacía.
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Crea una base desechable con esquema + migraciones, sin seed de admin,
 * arranca el backend en el puerto 3102 y verifica el asistente /setup.
 *
 * Uso: npm run test:setup
 */

"use strict";

const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

const rutaEnv = path.join(__dirname, "..", ".env");
if (fs.existsSync(rutaEnv) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rutaEnv);
}

const RAIZ_REPO = path.join(__dirname, "..", "..");
const DB_NAME = process.env.SETUP_DB_NAME || "siga_uc_setup_e2e";
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || "5432";
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASSWORD = process.env.DB_PASSWORD;
const PUERTO = Number(process.env.SETUP_PORT || 3102);
const BASE_URL = `http://127.0.0.1:${PUERTO}/api`;
const TOKEN = "setup-e2e-token-1234567890";
const ADMIN_DNI = "70000001";
const ADMIN_PASSWORD = "Setup2027*";
const ANIO = 2027;

if (!DB_NAME.includes("_setup_e2e")) {
  console.error(`DB_NAME debe contener "_setup_e2e". Recibido: "${DB_NAME}".`);
  process.exit(1);
}
if (!DB_PASSWORD) {
  console.error("Falta DB_PASSWORD en .env.");
  process.exit(1);
}
if (/supabase/i.test(DB_HOST)) {
  console.error("No se permite ejecutar esta prueba contra Supabase.");
  process.exit(1);
}

const MIGRACIONES = [
  "migracion_h32_anulacion_pagos.sql",
  "migracion_h10_h38_concurrencia_pagos.sql",
  "migracion_h07_auditoria.sql",
  "migracion_h45_pensiones_anuladas.sql",
  "migracion_h47_horarios.sql",
  "migracion_h48_actas.sql",
  "migracion_h61_dia_semana.sql",
  "migracion_h49_multianio_base.sql",
  "migracion_h73_promociones.sql",
  "migracion_h59_observaciones_personal.sql",
  "migracion_h71_retirados_historicos.sql",
  "migracion_h74_configuracion_base.sql",
  "migracion_h75_tarifas.sql",
  "migracion_h76_academico.sql",
  "migracion_h77_horario_jornada.sql",
  "migracion_h78_becas.sql",
  "migracion_h79_setup_inicial.sql",
].map((archivo) => path.join(RAIZ_REPO, "database", archivo));

const entornoPg = {
  ...process.env,
  PGPASSWORD: DB_PASSWORD,
  PGCLIENTENCODING: "UTF8",
};
delete entornoPg.DATABASE_URL;

const argumentosConexion = [
  "-h",
  DB_HOST,
  "-p",
  DB_PORT,
  "-U",
  DB_USER,
];

let proceso = null;
let pool = null;
let baseCreada = false;
const resultados = [];
const logs = [];

function registrar(numero, nombre, estado, detalle = "") {
  resultados.push({ numero, nombre, estado, detalle });
  console.log(
    `${String(numero).padEnd(3)} ${nombre.padEnd(72)} ${estado.padEnd(8)} ${detalle}`,
  );
}

function describirError(error) {
  return String(error?.message || error).slice(0, 240);
}

async function prueba(numero, nombre, fn) {
  try {
    await fn();
  } catch (error) {
    registrar(numero, nombre, "FAIL", describirError(error));
  }
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
      `${etiqueta} falló: ${(salida || error.message || "error").slice(-1200)}`,
    );
  }
}

function prepararBase() {
  console.log("Limpiando restos de una ejecución anterior...");
  ejecutar(
    "dropdb",
    [...argumentosConexion, "--if-exists", "--force", DB_NAME],
    "dropdb inicial",
  );

  console.log("Creando base vacía y aplicando esquema/migraciones...");
  ejecutar("createdb", [...argumentosConexion, DB_NAME], "createdb");
  baseCreada = true;

  const archivos = [
    path.join(RAIZ_REPO, "database", "siga_uc.sql"),
    ...MIGRACIONES,
  ];
  for (const archivo of archivos) {
    ejecutar(
      "psql",
      [
        ...argumentosConexion,
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

function puertoLibre(puerto) {
  return new Promise((resolve) => {
    const servidor = net.createServer();
    servidor.once("error", () => resolve(false));
    servidor.once("listening", () => servidor.close(() => resolve(true)));
    servidor.listen(puerto, "127.0.0.1");
  });
}

function iniciarBackend() {
  const entorno = {
    ...process.env,
    PORT: String(PUERTO),
    DB_NAME,
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DB_SSL: "false",
    JWT_SECRET: "setup-e2e-secret-2026-solo-para-pruebas-locales",
    JWT_EXPIRES_IN: "8h",
    NODE_ENV: "test",
    ANIO_LECTIVO: "2026",
    SETUP_TOKEN: TOKEN,
    RESEND_API_KEY: "re_test_no_enviar",
    TZ: "America/Lima",
  };
  delete entorno.DATABASE_URL;

  proceso = spawn(process.execPath, ["src/app.js"], {
    cwd: path.join(RAIZ_REPO, "siga-uc-backend"),
    env: entorno,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const guardar = (bloque) => {
    for (const linea of String(bloque).split(/\r?\n/)) {
      if (!linea.trim()) continue;
      logs.push(linea);
      if (logs.length > 200) logs.shift();
    }
  };
  proceso.stdout.on("data", guardar);
  proceso.stderr.on("data", guardar);
}

async function esperarHealth() {
  for (let intento = 0; intento < 40; intento += 1) {
    if (proceso && proceso.exitCode !== null) {
      throw new Error(
        `El backend terminó antes de responder (exit ${proceso.exitCode})`,
      );
    }
    try {
      const respuesta = await fetch(`${BASE_URL}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (respuesta.ok) return;
    } catch {
      // Esperar y reintentar.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("El backend no respondió en 20 segundos");
}

async function api(ruta, opciones = {}) {
  const { method = "GET", token = null, body = undefined } = opciones;
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${BASE_URL}${ruta}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
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
  const mensaje = datos?.message ? `: ${String(datos.message).slice(0, 120)}` : "";
  return `HTTP ${respuesta.status}${mensaje}`;
}

const payloadSetup = {
  token: TOKEN,
  institucion: {
    nombre_institucion: "Colegio Setup E2E",
    nombre_corto: "Setup E2E",
    ruc: "20123456789",
    direccion: "Av. Prueba 123",
    distrito: "Huancayo",
    provincia: "Huancayo",
    departamento: "Junin",
    telefono: "999888777",
    correo_contacto: "contacto@setupe2e.local",
  },
  anio_lectivo: ANIO,
  fecha_inicio: `${ANIO}-03-01`,
  fecha_fin: `${ANIO}-12-31`,
  niveles: ["SECUNDARIA"],
  admin: {
    dni: ADMIN_DNI,
    nombres: "Admin",
    apellidos: "Setup",
    correo: "admin@setupe2e.local",
    password: ADMIN_PASSWORD,
    confirmar_password: ADMIN_PASSWORD,
  },
};

async function main() {
  console.log("SIGA-UC setup E2E — base vacía");
  console.log(`API: ${BASE_URL}`);
  console.log(`Base: ${DB_NAME}@${DB_HOST}:${DB_PORT}`);

  if (!(await puertoLibre(PUERTO))) {
    throw new Error(
      `El puerto ${PUERTO} está ocupado. Libere el puerto antes de ejecutar test:setup.`,
    );
  }

  prepararBase();
  iniciarBackend();
  await esperarHealth();

  pool = new Pool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    max: 4,
  });
  await pool.query("SELECT 1");

  console.log("");
  console.log(
    `${"#".padEnd(3)} ${"Prueba".padEnd(72)} ${"Resultado".padEnd(8)} Detalle`,
  );
  console.log(`${"-".repeat(3)} ${"-".repeat(72)} ${"-".repeat(8)} ${"-".repeat(40)}`);

  await prueba(
    1,
    "Base vacía: el setup está pendiente y disponible",
    async () => {
      const respuesta = await api("/setup/status");
      const datos = await leerJson(respuesta);
      assert.equal(respuesta.status, 200, detalleHttp(respuesta, datos.datos));
      assert.equal(datos.datos?.data?.requiere_setup, true);
      assert.equal(datos.datos?.data?.setup_disponible, true);
      registrar(
        1,
        "Base vacía: el setup está pendiente y disponible",
        "PASS",
        "requiere_setup=true",
      );
    },
  );

  await prueba(
    2,
    "Token inválido responde 401 y no crea usuarios",
    async () => {
      const respuesta = await api("/setup/inicializar", {
        method: "POST",
        body: { ...payloadSetup, token: "token-invalido" },
      });
      const datos = await leerJson(respuesta);
      assert.equal(respuesta.status, 401, detalleHttp(respuesta, datos.datos));
      const filas = await pool.query("SELECT COUNT(*)::int AS total FROM usuarios");
      assert.equal(filas.rows[0].total, 0);
      registrar(
        2,
        "Token inválido responde 401 y no crea usuarios",
        "PASS",
        "401 TOKEN_INVALIDO",
      );
    },
  );

  await prueba(
    3,
    "Setup crea admin, institución, año, grados, caja y auditoría",
    async () => {
      const respuesta = await api("/setup/inicializar", {
        method: "POST",
        body: payloadSetup,
      });
      const datos = await leerJson(respuesta);
      assert.equal(respuesta.status, 201, detalleHttp(respuesta, datos.datos));
      assert.equal(datos.datos?.data?.admin?.dni, ADMIN_DNI);

      const admin = await pool.query(
        `SELECT u.id_usuario, u.dni, u.estado, u.requiere_cambio_password
         FROM usuarios u
         INNER JOIN roles r ON r.id_rol = u.id_rol
         WHERE r.nombre_rol = 'ADMIN'`,
      );
      assert.equal(admin.rowCount, 1);
      assert.equal(admin.rows[0].requiere_cambio_password, false);

      const config = await pool.query(
        `SELECT setup_completado, setup_completado_por,
                setup_completado_en IS NOT NULL AS con_fecha,
                nombre_institucion
         FROM configuracion_institucional`,
      );
      assert.equal(config.rows[0].setup_completado, true);
      assert.equal(config.rows[0].con_fecha, true);
      assert.equal(config.rows[0].nombre_institucion, "Colegio Setup E2E");
      assert.equal(
        Number(config.rows[0].setup_completado_por),
        Number(admin.rows[0].id_usuario),
      );

      const grados = await pool.query(
        `SELECT COUNT(*)::int AS total FROM grados WHERE anio_lectivo = $1`,
        [ANIO],
      );
      assert.equal(grados.rows[0].total, 5);

      const anios = await pool.query(
        `SELECT anio, estado FROM anios_lectivos ORDER BY anio`,
      );
      assert.equal(anios.rows.length, 2);
      assert.equal(anios.rows[0].anio, 2026);
      assert.equal(anios.rows[0].estado, "CERRADO");
      assert.equal(anios.rows[1].anio, ANIO);
      assert.equal(anios.rows[1].estado, "ACTIVO");

      const cajas = await pool.query("SELECT COUNT(*)::int AS total FROM cajas");
      assert.equal(cajas.rows[0].total, 1);

      const personal = await pool.query("SELECT COUNT(*)::int AS total FROM personal");
      assert.equal(personal.rows[0].total, 1);

      const auditoria = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM bitacora_auditoria
         WHERE accion = 'CONFIGURACION_INICIAL'`,
      );
      assert.equal(auditoria.rows[0].total, 1);

      registrar(
        3,
        "Setup crea admin, institución, año, grados, caja y auditoría",
        "PASS",
        `admin=${admin.rows[0].id_usuario}, grados=5, año=${ANIO}`,
      );
    },
  );

  await prueba(
    4,
    "Después del setup, el estado queda completo y el segundo intento es 409",
    async () => {
      const estado = await api("/setup/status");
      const estadoDatos = await leerJson(estado);
      assert.equal(estadoDatos.datos?.data?.requiere_setup, false);
      assert.equal(estadoDatos.datos?.data?.setup_completado, true);

      const segundo = await api("/setup/inicializar", {
        method: "POST",
        body: payloadSetup,
      });
      const segundoDatos = await leerJson(segundo);
      assert.equal(segundo.status, 409, detalleHttp(segundo, segundoDatos.datos));
      registrar(
        4,
        "Después del setup, el estado queda completo y el segundo intento es 409",
        "PASS",
        "409 SETUP_YA_COMPLETADO",
      );
    },
  );

  await prueba(
    5,
    "El admin creado puede iniciar sesión con su contraseña",
    async () => {
      const login = await api("/auth/login", {
        method: "POST",
        body: { dni: ADMIN_DNI, password: ADMIN_PASSWORD },
      });
      const loginDatos = await leerJson(login);
      assert.equal(login.status, 200, detalleHttp(login, loginDatos.datos));
      assert.equal(loginDatos.datos?.data?.usuario?.rol, "ADMIN");
      assert.ok(loginDatos.datos?.data?.token);
      registrar(
        5,
        "El admin creado puede iniciar sesión con su contraseña",
        "PASS",
        "login 200, rol ADMIN",
      );
    },
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
}

async function detenerBackend() {
  if (!proceso) return;
  const pid = proceso.pid;
  if (proceso.exitCode === null) {
    try {
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } else {
        proceso.kill("SIGKILL");
      }
    } catch {
      // El proceso pudo haber terminado entre la comprobación y el kill.
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  proceso = null;
}

async function limpiar() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
  await detenerBackend();
  if (baseCreada) {
    try {
      ejecutar(
        "dropdb",
        [...argumentosConexion, "--if-exists", "--force", DB_NAME],
        "dropdb final",
      );
      console.log("Limpieza verificada: backend detenido y base eliminada.");
    } catch (error) {
      console.error("No se pudo eliminar la base:", describirError(error));
    }
  }
}

main()
  .catch(async (error) => {
    registrar(0, "Preparación/ejecución setup E2E", "FAIL", describirError(error));
    if (logs.length > 0) {
      console.error("\nÚltimas líneas del backend:");
      for (const linea of logs.slice(-40)) console.error(`  ${linea}`);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await limpiar();
  });
