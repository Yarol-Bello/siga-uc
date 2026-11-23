#!/usr/bin/env node
/**
 * Smoke test de solo lectura para SIGA-UC.
 *
 * Comprueba que un entorno (local o Render) tenga la base de datos conectada,
 * la configuración activa, el login y los permisos por rol básicos.
 *
 * No ejecuta POST/PUT/DELETE de negocio: el único POST es /auth/login, necesario
 * para obtener el token; solo actualiza ultimo_login y registra el LOGIN en la
 * bitácora.
 *
 * Variables de entorno:
 *   SMOKE_BASE_URL              (default: http://localhost:3000/api)
 *   SMOKE_ADMIN_DNI             / SMOKE_ADMIN_PASSWORD
 *   SMOKE_DOCENTE_DNI           / SMOKE_DOCENTE_PASSWORD
 *   SMOKE_ESTUDIANTE_DNI        / SMOKE_ESTUDIANTE_PASSWORD
 *   SMOKE_ALLOW_SKIP=1          (opcional; acepta SKIP para diagnósticos parciales)
 *
 * Si faltan credenciales, las pruebas dependientes se marcan SKIP (nunca FAIL).
 * Las credenciales nunca se imprimen.
 *
 * Códigos de salida:
 *   0  Ningún FAIL y ningún SKIP (o SKIP con SMOKE_ALLOW_SKIP=1).
 *   1  Al menos un FAIL.
 *   2  Hay SKIP y SMOKE_ALLOW_SKIP no es 1.
 *
 * Uso: npm run smoke
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

// Cargar siga-uc-backend/.env si existe (Node >= 20.12) sin sobrescribir las
// variables ya definidas en el proceso. En Render no hay .env: se usan las
// variables del panel.
const rutaEnv = path.join(__dirname, "..", ".env");
if (fs.existsSync(rutaEnv) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rutaEnv);
}

const BASE_URL = (
  process.env.SMOKE_BASE_URL || "http://localhost:3000/api"
).replace(/\/+$/, "");
const TIMEOUT_MS = 10_000;
const ANCHO_PRUEBA = 52;
const ANCHO_ESTADO = 9;

const resultados = [];
let sesionAdmin = null;
let sesionDocente = null;
let sesionEstudiante = null;
let primerAlumnoId = null;

function registrar(numero, nombre, estado, detalle = "") {
  resultados.push({ numero, nombre, estado, detalle });
  console.log(
    `${String(numero).padEnd(3)} ${nombre.padEnd(ANCHO_PRUEBA)} ${estado.padEnd(ANCHO_ESTADO)} ${detalle}`,
  );
}

/**
 * Ejecuta una prueba y convierte cualquier excepción no controlada en FAIL.
 * Cada prueba debe registrar su resultado exactamente una vez.
 */
async function prueba(numero, nombre, fn) {
  try {
    await fn();
  } catch (error) {
    registrar(numero, nombre, "FAIL", describirError(error));
  }
}

function describirError(error) {
  if (
    error?.name === "TimeoutError" ||
    error?.name === "AbortError" ||
    error?.cause?.name === "TimeoutError"
  ) {
    return `Tiempo de espera agotado (${TIMEOUT_MS / 1000}s)`;
  }
  if (error?.cause?.code === "ECONNREFUSED") {
    return `No se pudo conectar a ${BASE_URL} (ECONNREFUSED)`;
  }
  if (error?.cause?.code === "ENOTFOUND") {
    return `Host no encontrado (ENOTFOUND): ${BASE_URL}`;
  }
  if (error?.cause?.code) {
    return `Error de red (${error.cause.code})`;
  }
  return String(error?.message || error).slice(0, 160);
}

/**
 * Petición HTTP con timeout. El token se envía solo en el header Authorization.
 */
async function solicitar(ruta, opciones = {}) {
  const {
    token = null,
    method = "GET",
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
    signal: AbortSignal.timeout(TIMEOUT_MS),
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

function detalleHttp(respuesta, datos = null) {
  const mensaje = datos?.message ? `: ${String(datos.message).slice(0, 140)}` : "";
  return `HTTP ${respuesta.status}${mensaje}`;
}

function credenciales(rol) {
  const dni = (process.env[`SMOKE_${rol}_DNI`] || "").trim();
  const password = (process.env[`SMOKE_${rol}_PASSWORD`] || "").trim();

  if (!dni || !password) {
    return {
      ok: false,
      motivo: `Faltan SMOKE_${rol}_DNI/SMOKE_${rol}_PASSWORD`,
    };
  }
  return { ok: true, dni, password };
}

/**
 * Inicia sesión y devuelve { estado: "OK"|"FAIL"|"SKIP", token, usuario }.
 * Nunca incluye el token ni la contraseña en los mensajes.
 */
async function iniciarSesion(rol) {
  const cred = credenciales(rol);
  if (!cred.ok) {
    return { estado: "SKIP", motivo: cred.motivo };
  }

  const respuesta = await solicitar("/auth/login", {
    method: "POST",
    body: { dni: cred.dni, password: cred.password },
  });
  const { datos } = await leerJson(respuesta);
  const token = datos?.data?.token;

  if (respuesta.status !== 200 || !datos?.success || !token) {
    return {
      estado: "FAIL",
      motivo: `Login ${rol} falló (${detalleHttp(respuesta, datos)})`,
    };
  }

  return {
    estado: "OK",
    token,
    usuario: datos.data.usuario || null,
  };
}

/**
 * Descarga un PDF y valida status, Content-Type y firma %PDF.
 */
async function probarPdf(ruta, token) {
  const respuesta = await solicitar(ruta, {
    token,
    accept: "application/pdf",
  });
  const tipo = respuesta.headers.get("content-type") || "";
  const buffer = Buffer.from(await respuesta.arrayBuffer());
  const firma = buffer.subarray(0, 4).toString("ascii");

  if (respuesta.status !== 200) {
    let mensaje = "";
    try {
      mensaje = JSON.parse(buffer.toString("utf8"))?.message || "";
    } catch {
      // El cuerpo no es JSON; no se muestra para no volcar datos binarios.
    }
    return {
      ok: false,
      detalle: `HTTP ${respuesta.status}${mensaje ? `: ${String(mensaje).slice(0, 140)}` : ""}`,
    };
  }

  if (!tipo.includes("application/pdf")) {
    return {
      ok: false,
      detalle: `Content-Type inesperado: ${tipo || "ausente"}`,
    };
  }

  if (firma !== "%PDF") {
    return {
      ok: false,
      detalle: `El cuerpo no es PDF (firma: ${JSON.stringify(firma)})`,
    };
  }

  return {
    ok: true,
    detalle: `200, application/pdf, ${buffer.length} bytes, firma ${firma}`,
  };
}

async function main() {
  console.log(`SIGA-UC smoke test — ${BASE_URL}`);
  console.log(`Timeout por petición: ${TIMEOUT_MS / 1000}s\n`);
  console.log(
    `${"#".padEnd(3)} ${"Prueba".padEnd(ANCHO_PRUEBA)} ${"Resultado".padEnd(ANCHO_ESTADO)} Detalle`,
  );
  console.log(
    `${"-".repeat(3)} ${"-".repeat(ANCHO_PRUEBA)} ${"-".repeat(ANCHO_ESTADO)} ${"-".repeat(40)}`,
  );

  // 1. Salud de la API y conexión a la base de datos.
  await prueba(1, "Salud de la API (GET /health)", async () => {
    const respuesta = await solicitar("/health");
    const { datos } = await leerJson(respuesta);
    const base = datos?.data?.database;

    if (respuesta.status === 200 && datos?.success && base === "ok") {
      registrar(1, "Salud de la API (GET /health)", "PASS", "200, database=ok");
      return;
    }
    registrar(
      1,
      "Salud de la API (GET /health)",
      "FAIL",
      `HTTP ${respuesta.status}, database=${base ?? "sin dato"}`,
    );
  });

  // 2. Configuración pública con año lectivo numérico.
  await prueba(2, "Configuración (GET /configuracion)", async () => {
    const respuesta = await solicitar("/configuracion");
    const { datos } = await leerJson(respuesta);
    const anio = datos?.data?.anio_lectivo;

    if (
      respuesta.status === 200 &&
      datos?.success &&
      typeof anio === "number" &&
      Number.isFinite(anio)
    ) {
      registrar(
        2,
        "Configuración (GET /configuracion)",
        "PASS",
        `200, anio_lectivo=${anio}`,
      );
      return;
    }
    registrar(
      2,
      "Configuración (GET /configuracion)",
      "FAIL",
      `${detalleHttp(respuesta, datos)}, anio_lectivo=${JSON.stringify(anio)}`,
    );
  });

  // 3. Sin token, la API debe rechazar el acceso.
  await prueba(3, "Sin token (GET /alumnos)", async () => {
    const respuesta = await solicitar("/alumnos");
    await leerJson(respuesta);

    if (respuesta.status === 401) {
      registrar(3, "Sin token (GET /alumnos)", "PASS", "401");
      return;
    }
    registrar(
      3,
      "Sin token (GET /alumnos)",
      "FAIL",
      `Se esperaba 401 y llegó HTTP ${respuesta.status}`,
    );
  });

  // 4. Login ADMIN + perfil.
  await prueba(4, "Login ADMIN + GET /auth/perfil", async () => {
    const login = await iniciarSesion("ADMIN");
    if (login.estado === "SKIP") {
      registrar(4, "Login ADMIN + GET /auth/perfil", "SKIP", login.motivo);
      return;
    }
    if (login.estado === "FAIL") {
      registrar(4, "Login ADMIN + GET /auth/perfil", "FAIL", login.motivo);
      return;
    }

    sesionAdmin = login;
    const respuesta = await solicitar("/auth/perfil", {
      token: sesionAdmin.token,
    });
    const { datos } = await leerJson(respuesta);

    if (respuesta.status === 200 && datos?.success) {
      registrar(4, "Login ADMIN + GET /auth/perfil", "PASS", "200, perfil obtenido");
      return;
    }
    registrar(
      4,
      "Login ADMIN + GET /auth/perfil",
      "FAIL",
      detalleHttp(respuesta, datos),
    );
  });

  // 5. Lectura de alumnos como ADMIN.
  await prueba(5, "ADMIN: listar alumnos (GET /alumnos)", async () => {
    if (!sesionAdmin) {
      registrar(5, "ADMIN: listar alumnos (GET /alumnos)", "SKIP", "Sin sesión ADMIN");
      return;
    }

    const respuesta = await solicitar("/alumnos?limit=1", {
      token: sesionAdmin.token,
    });
    const { datos } = await leerJson(respuesta);

    if (respuesta.status === 200 && datos?.success && Array.isArray(datos.data)) {
      if (datos.data.length > 0 && datos.data[0]?.id_alumno) {
        primerAlumnoId = datos.data[0].id_alumno;
      }
      registrar(
        5,
        "ADMIN: listar alumnos (GET /alumnos)",
        "PASS",
        `200, ${datos.data.length} alumno(s)`,
      );
      return;
    }
    registrar(
      5,
      "ADMIN: listar alumnos (GET /alumnos)",
      "FAIL",
      detalleHttp(respuesta, datos),
    );
  });

  // 6. Bitácora con paginación.
  await prueba(6, "ADMIN: bitácora paginada (GET /auditoria)", async () => {
    if (!sesionAdmin) {
      registrar(
        6,
        "ADMIN: bitácora paginada (GET /auditoria)",
        "SKIP",
        "Sin sesión ADMIN",
      );
      return;
    }

    const respuesta = await solicitar("/auditoria?page=1&pageSize=5", {
      token: sesionAdmin.token,
    });
    const { datos } = await leerJson(respuesta);
    const paginacion = datos?.pagination;
    const paginacionValida =
      paginacion &&
      Number.isFinite(Number(paginacion.total)) &&
      Number.isFinite(Number(paginacion.page)) &&
      Number.isFinite(Number(paginacion.pageSize)) &&
      Number.isFinite(Number(paginacion.totalPages));

    if (respuesta.status === 200 && datos?.success && paginacionValida) {
      registrar(
        6,
        "ADMIN: bitácora paginada (GET /auditoria)",
        "PASS",
        `200, total=${paginacion.total}, pageSize=${paginacion.pageSize}`,
      );
      return;
    }
    registrar(
      6,
      "ADMIN: bitácora paginada (GET /auditoria)",
      "FAIL",
      paginacionValida
        ? detalleHttp(respuesta, datos)
        : `${detalleHttp(respuesta, datos)}, pagination inválida`,
    );
  });

  // 7. Tesorería (solo lectura).
  await prueba(7, "ADMIN: listar pagos (GET /tesoreria/pagos)", async () => {
    if (!sesionAdmin) {
      registrar(
        7,
        "ADMIN: listar pagos (GET /tesoreria/pagos)",
        "SKIP",
        "Sin sesión ADMIN",
      );
      return;
    }

    const respuesta = await solicitar("/tesoreria/pagos", {
      token: sesionAdmin.token,
    });
    const { datos } = await leerJson(respuesta);

    if (respuesta.status === 200 && datos?.success && Array.isArray(datos.data)) {
      registrar(
        7,
        "ADMIN: listar pagos (GET /tesoreria/pagos)",
        "PASS",
        `200, ${datos.data.length} pago(s)`,
      );
      return;
    }
    registrar(
      7,
      "ADMIN: listar pagos (GET /tesoreria/pagos)",
      "FAIL",
      detalleHttp(respuesta, datos),
    );
  });

  // 8. Libreta en PDF del primer alumno.
  await prueba(8, "ADMIN: libreta PDF del primer alumno", async () => {
    if (!sesionAdmin) {
      registrar(8, "ADMIN: libreta PDF del primer alumno", "SKIP", "Sin sesión ADMIN");
      return;
    }
    if (!primerAlumnoId) {
      registrar(
        8,
        "ADMIN: libreta PDF del primer alumno",
        "SKIP",
        "No se obtuvo id_alumno",
      );
      return;
    }

    const resultado = await probarPdf(
      `/reportes/libreta/${encodeURIComponent(primerAlumnoId)}/pdf?bimestre=1`,
      sesionAdmin.token,
    );
    registrar(
      8,
      "ADMIN: libreta PDF del primer alumno",
      resultado.ok ? "PASS" : "FAIL",
      resultado.detalle,
    );
  });

  // 9. RBAC: el estudiante no puede listar alumnos.
  await prueba(9, "ESTUDIANTE: GET /alumnos debe dar 403", async () => {
    const login = await iniciarSesion("ESTUDIANTE");
    if (login.estado === "SKIP") {
      registrar(9, "ESTUDIANTE: GET /alumnos debe dar 403", "SKIP", login.motivo);
      return;
    }
    if (login.estado === "FAIL") {
      registrar(9, "ESTUDIANTE: GET /alumnos debe dar 403", "FAIL", login.motivo);
      return;
    }

    sesionEstudiante = login;
    const respuesta = await solicitar("/alumnos", {
      token: sesionEstudiante.token,
    });
    const { datos } = await leerJson(respuesta);

    if (respuesta.status === 403) {
      registrar(9, "ESTUDIANTE: GET /alumnos debe dar 403", "PASS", "403 (RBAC)");
      return;
    }
    registrar(
      9,
      "ESTUDIANTE: GET /alumnos debe dar 403",
      "FAIL",
      `Se esperaba 403 y llegó ${detalleHttp(respuesta, datos)}`,
    );
  });

  // 10. Login DOCENTE + perfil.
  await prueba(10, "Login DOCENTE + GET /auth/perfil", async () => {
    const login = await iniciarSesion("DOCENTE");
    if (login.estado === "SKIP") {
      registrar(10, "Login DOCENTE + GET /auth/perfil", "SKIP", login.motivo);
      return;
    }
    if (login.estado === "FAIL") {
      registrar(10, "Login DOCENTE + GET /auth/perfil", "FAIL", login.motivo);
      return;
    }

    sesionDocente = login;
    const respuesta = await solicitar("/auth/perfil", {
      token: sesionDocente.token,
    });
    const { datos } = await leerJson(respuesta);

    if (respuesta.status === 200 && datos?.success) {
      registrar(10, "Login DOCENTE + GET /auth/perfil", "PASS", "200, perfil obtenido");
      return;
    }
    registrar(
      10,
      "Login DOCENTE + GET /auth/perfil",
      "FAIL",
      detalleHttp(respuesta, datos),
    );
  });

  // 11. El estudiante solo puede descargar su propia libreta.
  await prueba(11, "ESTUDIANTE: descargar su propia libreta", async () => {
    if (!sesionEstudiante) {
      registrar(
        11,
        "ESTUDIANTE: descargar su propia libreta",
        "SKIP",
        "Sin sesión ESTUDIANTE",
      );
      return;
    }

    const idAlumno = sesionEstudiante.usuario?.info_adicional?.id_alumno;
    if (!idAlumno) {
      registrar(
        11,
        "ESTUDIANTE: descargar su propia libreta",
        "SKIP",
        "El usuario no tiene id_alumno asociado",
      );
      return;
    }

    const resultado = await probarPdf(
      `/reportes/libreta/${encodeURIComponent(idAlumno)}/pdf?bimestre=1`,
      sesionEstudiante.token,
    );
    registrar(
      11,
      "ESTUDIANTE: descargar su propia libreta",
      resultado.ok ? "PASS" : "FAIL",
      resultado.detalle,
    );
  });

  // 12. Configuración administrativa (H74). Tolera una base sin la migración.
  await prueba(
    12,
    "ADMIN: configuración administrativa (GET /configuracion/admin)",
    async () => {
      if (!sesionAdmin) {
        registrar(
          12,
          "ADMIN: configuración administrativa (GET /configuracion/admin)",
          "SKIP",
          "Sin sesión ADMIN",
        );
        return;
      }

      const respuesta = await solicitar("/configuracion/admin", {
        token: sesionAdmin.token,
      });
      const { datos } = await leerJson(respuesta);

      if (respuesta.status === 503 && datos?.errors?.codigo === "CONFIG_NO_APLICADA") {
        registrar(
          12,
          "ADMIN: configuración administrativa (GET /configuracion/admin)",
          "SKIP",
          "H74 no aplicada",
        );
        return;
      }

      if (
        respuesta.status === 200 &&
        datos?.success &&
        datos?.data?.institucion?.id_configuracion === 1 &&
        Array.isArray(datos?.data?.anios)
      ) {
        registrar(
          12,
          "ADMIN: configuración administrativa (GET /configuracion/admin)",
          "PASS",
          `200, institución y ${datos.data.anios.length} año(s)`,
        );
        return;
      }

      registrar(
        12,
        "ADMIN: configuración administrativa (GET /configuracion/admin)",
        "FAIL",
        detalleHttp(respuesta, datos),
      );
    },
  );

  const pass = resultados.filter((r) => r.estado === "PASS").length;
  const fail = resultados.filter((r) => r.estado === "FAIL").length;
  const skip = resultados.filter((r) => r.estado === "SKIP").length;

  const allowSkip = process.env.SMOKE_ALLOW_SKIP === "1";

  console.log("");
  console.log(`${pass} PASS, ${fail} FAIL, ${skip} SKIP`);

  if (skip > 0) {
    console.log("");
    console.log(
      `*** RESULTADO PARCIAL: ${skip} prueba(s) omitidas. No usar como verificación de entorno. ***`,
    );
    if (allowSkip) {
      console.log("SKIP aceptado por SMOKE_ALLOW_SKIP=1.");
    }
  }

  if (fail > 0) {
    console.log("Resultado: FALLO");
    process.exitCode = 1;
  } else if (skip > 0 && !allowSkip) {
    console.log("Resultado: PARCIAL");
    process.exitCode = 2;
  } else {
    console.log("Resultado: OK");
    process.exitCode = 0;
  }
}

main().catch((error) => {
  // Red de seguridad: nunca dejar una promesa rechazada sin manejar.
  console.error(`Error inesperado en el smoke test: ${describirError(error)}`);
  process.exitCode = 1;
});
