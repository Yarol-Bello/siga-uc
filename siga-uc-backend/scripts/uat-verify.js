#!/usr/bin/env node
/**
 * Verificación UAT de SIGA-UC contra `siga_uc_uat`.
 * Uso: node scripts/uat-verify.js
 *
 * Para una base remota (solo demo):
 *  - UAT_BASE_URL=https://.../api
 *  - UAT_DATABASE_URL=postgresql://...
 *  - UAT_DB_NAME=postgres (solo para el log)
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const rutaEnv = path.join(__dirname, "..", ".env");
if (fs.existsSync(rutaEnv) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rutaEnv);
}

const BASE = process.env.UAT_BASE_URL || "http://127.0.0.1:3000/api";
const DB_NAME = process.env.UAT_DB_NAME || "siga_uc_uat";
const ANIO = 2026;
const resultados = [];
const errores = [];

const pool = process.env.UAT_DATABASE_URL
  ? new Pool({
      connectionString: process.env.UAT_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      options: "-c search_path=public,extensions",
      max: 4,
    })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      database: DB_NAME,
      max: 4,
    });

async function api(ruta, { token, method = "GET", body, raw = false } = {}) {
  const headers = { Accept: raw ? "*/*" : "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (raw) return respuesta;
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch {
    datos = { message: texto };
  }
  return { respuesta, datos };
}

async function check(nombre, fn) {
  try {
    const detalle = await fn();
    resultados.push({ nombre, estado: "PASS", detalle: detalle || "" });
    console.log(`PASS  ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  } catch (error) {
    const detalle = String(error?.message || error).slice(0, 260);
    resultados.push({ nombre, estado: "FAIL", detalle });
    console.log(`FAIL  ${nombre} — ${detalle}`);
  }
}

async function login(dni, password) {
  const { respuesta, datos } = await api("/auth/login", {
    method: "POST",
    body: { dni, password },
  });
  if (!respuesta.ok || !datos?.data?.token) {
    throw new Error(`Login ${dni}: HTTP ${respuesta.status} ${datos?.message || ""}`);
  }
  return datos.data;
}

async function sql(texto, params = []) {
  const result = await pool.query(texto, params);
  return result.rows;
}

function ok(respuesta, datos, etiqueta) {
  if (!respuesta.ok) {
    throw new Error(
      `${etiqueta}: HTTP ${respuesta.status} ${datos?.message || ""}`,
    );
  }
  return datos;
}

async function main() {
  console.log("UAT SIGA-UC — verificación integral");
  console.log(`Base: ${DB_NAME} · API: ${BASE}\n`);

  const admin = await login("74829102", "UC2026*");
  const secretaria = await login("73000007", "Secretaria2026*");
  const docente = await login("73000001", "Docente2026*");
  const estudiante = await login("72000001", "UC72000001");

  const alumno = await sql(
    `SELECT id_alumno, id_grado, dni, nombres, apellidos
     FROM alumnos WHERE dni = '72000001'`,
  );
  const otroAlumno = await sql(
    `SELECT id_alumno FROM alumnos WHERE dni = '72000002'`,
  );
  const grado = await sql(
    `SELECT id_grado FROM grados WHERE anio_lectivo = $1 AND orden = 1`,
    [ANIO],
  );
  const curso = await sql(
    `SELECT cc.id_curso, c.nombre_curso, cc.id_personal
     FROM carga_curricular cc
     JOIN cursos c ON c.id_curso = cc.id_curso
     WHERE cc.id_grado = $1 AND cc.anio_lectivo = $2
       AND c.nombre_curso = 'Aritmética'
     LIMIT 1`,
    [grado[0].id_grado, ANIO],
  );
  const pago = await sql(`SELECT id_pago FROM pagos ORDER BY id_pago LIMIT 1`);
  const acta = await sql(
    `SELECT id_acta FROM actas_bimestrales
     WHERE anio_lectivo = $1 AND bimestre = 1 AND id_grado = $2
     ORDER BY id_acta DESC LIMIT 1`,
    [ANIO, grado[0].id_grado],
  );

  await check("ADMIN · dashboard", async () => {
    const { respuesta, datos } = await api("/reportes/dashboard", {
      token: admin.token,
    });
    ok(respuesta, datos, "dashboard");
    return `alumnos=${datos.data.total_alumnos}, docentes=${datos.data.total_docentes}`;
  });

  await check("ADMIN · padrón de 75 alumnos", async () => {
    const { respuesta, datos } = await api(
      `/alumnos?anio=${ANIO}&page=1&pageSize=100`,
      { token: admin.token },
    );
    ok(respuesta, datos, "alumnos");
    if (datos.data.length < 75) {
      throw new Error(`Solo ${datos.data.length} alumnos`);
    }
    return `${datos.data.length} alumnos`;
  });

  await check("ADMIN · personal y tutores", async () => {
    const [{ respuesta, datos }, paginado] = await Promise.all([
      api("/personal", { token: admin.token }),
      api("/personal?page=1&pageSize=5", { token: admin.token }),
    ]);
    ok(respuesta, datos, "personal");
    ok(paginado.respuesta, paginado.datos, "personal paginado");
    if (datos.data.length < 7) throw new Error(`Solo ${datos.data.length} personas`);
    if (paginado.datos.data.data.length > 5) {
      throw new Error("La paginación de personal devolvió más de 5 filas");
    }
    if (paginado.datos.data.pagination.total < 7) {
      throw new Error("La paginación de personal no reporta el total");
    }
    const tutores = await sql(
      `SELECT COUNT(*)::int AS total FROM tutores_grado WHERE anio_lectivo = $1`,
      [ANIO],
    );
    return `${datos.data.length} personas, ${tutores[0].total} tutores`;
  });

  await check("ADMIN · carga curricular 55 filas", async () => {
    const { respuesta, datos } = await api(
      `/carga-curricular?anio=${ANIO}`,
      { token: admin.token },
    );
    ok(respuesta, datos, "carga");
    const filas = Array.isArray(datos.data) ? datos.data : datos.data?.cargas || [];
    if (filas.length < 55) throw new Error(`Solo ${filas.length} cargas`);
    return `${filas.length} filas`;
  });

  await check("ADMIN · horarios publicados 145 bloques", async () => {
    const { respuesta, datos } = await api(`/horarios?anio=${ANIO}`, {
      token: admin.token,
    });
    ok(respuesta, datos, "horarios");
    const bloques = datos.data?.bloques || [];
    if (bloques.length !== 145) throw new Error(`Hay ${bloques.length} bloques`);
    if (bloques.some((b) => b.estado !== "PUBLICADO")) {
      throw new Error("Hay bloques no publicados");
    }
    return `${bloques.length} bloques PUBLICADO`;
  });

  await check("ADMIN · notas y asistencias del dataset", async () => {
    const [notas, calificaciones, asistencias] = await Promise.all([
      sql(`SELECT COUNT(*)::int AS total FROM notas_finales_area WHERE anio_lectivo=$1`, [ANIO]),
      sql(`SELECT COUNT(*)::int AS total FROM calificaciones WHERE anio_lectivo=$1`, [ANIO]),
      sql(`SELECT COUNT(*)::int AS total FROM asistencia_alumnos`),
    ]);
    if (notas[0].total !== 3300) throw new Error(`Notas=${notas[0].total}`);
    if (calificaciones[0].total !== 8700) throw new Error(`Calificaciones=${calificaciones[0].total}`);
    if (asistencias[0].total !== 4125) throw new Error(`Asistencias=${asistencias[0].total}`);
    return `${notas[0].total} notas, ${calificaciones[0].total} calificaciones, ${asistencias[0].total} asistencias`;
  });

  await check("ADMIN · configuración, tarifas y becas", async () => {
    const [config, tarifas, becas] = await Promise.all([
      api("/configuracion/admin", { token: admin.token }),
      api(`/configuracion/tarifas?anio=${ANIO}&incluir_inactivos=1`, {
        token: admin.token,
      }),
      api(`/configuracion/becas?anio=${ANIO}`, { token: admin.token }),
    ]);
    ok(config.respuesta, config.datos, "config");
    ok(tarifas.respuesta, tarifas.datos, "tarifas");
    ok(becas.respuesta, becas.datos, "becas");
    return `${tarifas.datos.data.length} tarifas, ${becas.datos.data.length} becas`;
  });

  await check("ADMIN · tesorería y becas aplicadas", async () => {
    const [pagos, stats, padron] = await Promise.all([
      api("/tesoreria/pagos", { token: admin.token }),
      api(`/tesoreria/estadisticas?anio=${ANIO}`, { token: admin.token }),
      api(`/tesoreria/pensiones/padron?anio=${ANIO}&page=1&pageSize=25`, {
        token: admin.token,
      }),
    ]);
    ok(pagos.respuesta, pagos.datos, "pagos");
    ok(stats.respuesta, stats.datos, "estadísticas");
    ok(padron.respuesta, padron.datos, "padrón de pensiones");
    if (padron.datos.data.alumnos.length > 25) {
      throw new Error("El padrón de pensiones no respeta pageSize");
    }
    if (padron.datos.data.paginacion.total < 75) {
      throw new Error("El padrón de pensiones no reporta los 75 alumnos");
    }
    if (
      padron.datos.data.alumnos.some(
        (alumno) => !Array.isArray(alumno.pensiones),
      )
    ) {
      throw new Error("El padrón no incluye las pensiones por alumno");
    }
    const [pensiones, exoneradas] = await Promise.all([
      sql(`SELECT COUNT(*)::int AS total FROM pensiones WHERE anio_lectivo=$1`, [ANIO]),
      sql(`SELECT COUNT(*)::int AS total FROM pensiones WHERE anio_lectivo=$1 AND estado='EXONERADO'`, [ANIO]),
    ]);
    if (exoneradas[0].total < 5) throw new Error("No hay pensiones EXONERADO");
    const pendiente = stats.datos.data.pendiente || {};
    const suma =
      Number(pendiente.monto_pretickets || 0) +
      Number(pendiente.monto_pensiones || 0);
    if (Math.abs(Number(pendiente.monto_pendiente || 0) - suma) > 0.01) {
      throw new Error("El pendiente total no suma pre-tickets + pensiones");
    }
    if (Number(pendiente.monto_pensiones || 0) <= 0) {
      throw new Error("El KPI no incluye la deuda de pensiones");
    }
    return `${pagos.datos.data.length} pagos, ${pensiones[0].total} pensiones, ${exoneradas[0].total} exoneradas`;
  });

  await check("ADMIN · libreta, mérito, riesgo y asistencia", async () => {
    const [libreta, pdf, merito, riesgo, resumen] = await Promise.all([
      api(`/reportes/libreta/${alumno[0].id_alumno}?bimestre=1&anio=${ANIO}`, {
        token: admin.token,
      }),
      api(`/reportes/libreta/${alumno[0].id_alumno}/pdf?bimestre=1&anio=${ANIO}`, {
        token: admin.token,
        raw: true,
      }),
      api(`/reportes/cuadro-merito/${grado[0].id_grado}?bimestre=1&anio=${ANIO}`, {
        token: admin.token,
      }),
      api(`/reportes/alumnos-riesgo/${grado[0].id_grado}?bimestre=1&anio=${ANIO}`, {
        token: admin.token,
      }),
      api(`/reportes/resumen-asistencia/${grado[0].id_grado}?anio=${ANIO}`, {
        token: admin.token,
      }),
    ]);
    ok(libreta.respuesta, libreta.datos, "libreta");
    if (pdf.status !== 200) throw new Error(`PDF libreta HTTP ${pdf.status}`);
    ok(merito.respuesta, merito.datos, "mérito");
    ok(riesgo.respuesta, riesgo.datos, "riesgo");
    ok(resumen.respuesta, resumen.datos, "asistencia");
    return "libreta + PDF + mérito + riesgo + asistencia";
  });

  await check("ADMIN · SIAGIE resumen y Excel", async () => {
    const resumen = await api(
      `/siagie/resumen?anio=${ANIO}&bimestre=1&id_grado=${grado[0].id_grado}`,
      { token: admin.token },
    );
    ok(resumen.respuesta, resumen.datos, "SIAGIE resumen");
    const excel = await api(
      `/siagie/exportar?anio=${ANIO}&bimestre=1&id_grado=${grado[0].id_grado}`,
      { token: admin.token, raw: true },
    );
    if (excel.status !== 200) throw new Error(`Excel HTTP ${excel.status}`);
    if (!(excel.headers.get("content-type") || "").includes("spreadsheet")) {
      throw new Error("El Excel no tiene content-type de hoja de cálculo");
    }
    const codigo = excel.headers.get("x-codigo-control");
    const hash = excel.headers.get("x-hash-integridad");
    if (!codigo) throw new Error("Falta el código de control interno");
    if (!/^[a-f0-9]{64}$/.test(String(hash || ""))) {
      throw new Error("El hash de integridad no es SHA-256");
    }
    const verificacion = await api(
      `/siagie/exportaciones/${encodeURIComponent(codigo)}/verificar`,
      { token: admin.token },
    );
    ok(verificacion.respuesta, verificacion.datos, "verificación SIAGIE");
    if (!verificacion.datos.data?.coincide) {
      throw new Error("El código de control no coincide con los datos");
    }
    return `${resumen.datos.data.total_cursos} cursos, ${resumen.datos.data.total_alumnos} alumnos, código ${codigo}`;
  });

  await check("ADMIN · acta: cierre, PDF y reapertura", async () => {
    const cierre = await api("/auditoria/actas/cerrar", {
      method: "POST",
      token: admin.token,
      body: { anio_lectivo: ANIO, bimestre: 1, id_grado: grado[0].id_grado },
    });
    ok(cierre.respuesta, cierre.datos, "cerrar acta");
    const idActa = cierre.datos.data.id_acta;
    const pdf = await api(`/auditoria/actas/${idActa}/pdf`, {
      token: admin.token,
      raw: true,
    });
    if (pdf.status !== 200) throw new Error(`PDF acta HTTP ${pdf.status}`);
    const reapertura = await api(`/auditoria/actas/${idActa}/reabrir`, {
      method: "POST",
      token: admin.token,
      body: { motivo: "Reapertura de prueba UAT con datos simulados" },
    });
    ok(reapertura.respuesta, reapertura.datos, "reabrir acta");
    return `acta=${idActa} cerrada, PDF y reabierta`;
  });

  await check("ADMIN · boleta PDF y auditoría", async () => {
    if (!pago[0]) throw new Error("No hay pagos");
    const boleta = await api(`/tesoreria/boletas/${pago[0].id_pago}/pdf`, {
      token: admin.token,
      raw: true,
    });
    if (boleta.status !== 200) throw new Error(`Boleta HTTP ${boleta.status}`);
    const auditoria = await api("/auditoria?page=1&pageSize=10", {
      token: admin.token,
    });
    ok(auditoria.respuesta, auditoria.datos, "auditoría");
    return `boleta PDF, ${auditoria.datos.pagination?.total ?? "?"} eventos`;
  });

  await check("ADMIN · caja: apertura, egreso y cierre", async () => {
    const abierta = await sql(
      `SELECT ap.id_apertura,
              ap.monto_inicial + COALESCE(SUM(
                CASE WHEN m.tipo = 'INGRESO' THEN m.monto
                     WHEN m.tipo = 'EGRESO' THEN -m.monto ELSE 0 END
              ), 0) AS saldo
       FROM aperturas_caja ap
       LEFT JOIN movimientos_caja m ON m.id_apertura = ap.id_apertura
       WHERE NOT EXISTS (
         SELECT 1 FROM cierres_caja cc WHERE cc.id_apertura = ap.id_apertura
       )
       GROUP BY ap.id_apertura, ap.monto_inicial
       ORDER BY ap.id_apertura DESC
       LIMIT 1`,
    );
    if (abierta[0]) {
      const cierrePrevio = await api("/caja/cerrar", {
        method: "POST",
        token: admin.token,
        body: {
          efectivo_fisico: Number(abierta[0].saldo),
          observaciones: "Limpieza de caja antes de verificación UAT",
        },
      });
      ok(cierrePrevio.respuesta, cierrePrevio.datos, "cerrar caja previa");
    }

    const apertura = await api("/caja/aperturar", {
      method: "POST",
      token: admin.token,
      body: {
        id_caja: 1,
        monto_inicial: 300,
        observaciones: "Apertura de verificación UAT",
      },
    });
    ok(apertura.respuesta, apertura.datos, "aperturar caja");
    const egreso = await api("/caja/egresos", {
      method: "POST",
      token: admin.token,
      body: {
        concepto: "Compra de materiales UAT",
        monto: 50,
        nro_comprobante: "UAT-001",
      },
    });
    ok(egreso.respuesta, egreso.datos, "egreso caja");
    const cierre = await api("/caja/cerrar", {
      method: "POST",
      token: admin.token,
      body: { efectivo_fisico: 250, observaciones: "Cierre de verificación UAT" },
    });
    ok(cierre.respuesta, cierre.datos, "cerrar caja");
    return "300 apertura, egreso 50, cierre 250";
  });

  await check("SECRETARIA · dashboard, padrón y tesorería", async () => {
    const [dashboard, alumnos, pagos, caja] = await Promise.all([
      api("/reportes/dashboard", { token: secretaria.token }),
      api(`/alumnos?anio=${ANIO}&page=1&pageSize=10`, { token: secretaria.token }),
      api("/tesoreria/pagos", { token: secretaria.token }),
      api("/caja/actual", { token: secretaria.token }),
    ]);
    ok(dashboard.respuesta, dashboard.datos, "dashboard secretaría");
    ok(alumnos.respuesta, alumnos.datos, "alumnos secretaría");
    ok(pagos.respuesta, pagos.datos, "pagos secretaría");
    ok(caja.respuesta, caja.datos, "caja secretaría");
    return "dashboard, padrón, pagos y caja";
  });

  await check("SECRETARIA · lectura de configuración y 403 en escritura", async () => {
    const [tarifas, becas] = await Promise.all([
      api(`/configuracion/tarifas?anio=${ANIO}`, { token: secretaria.token }),
      api(`/configuracion/becas?anio=${ANIO}`, { token: secretaria.token }),
    ]);
    ok(tarifas.respuesta, tarifas.datos, "tarifas secretaría");
    ok(becas.respuesta, becas.datos, "becas secretaría");
    const escritura = await api("/configuracion/tarifas", {
      method: "POST",
      token: secretaria.token,
      body: {
        nombre: "No permitida",
        monto_base: 10,
        tipo: "OTROS",
        anio_lectivo: ANIO,
        motivo: "Intento de escritura de secretaría",
      },
    });
    if (escritura.respuesta.status !== 403) {
      throw new Error(`Escritura de secretaría HTTP ${escritura.respuesta.status}`);
    }
    return "lee tarifas/becas; escritura 403";
  });

  await check("SECRETARIA · sin acceso a personal", async () => {
    const { respuesta } = await api("/personal", { token: secretaria.token });
    if (respuesta.status !== 403) {
      throw new Error(`Personal HTTP ${respuesta.status}`);
    }
    return "403";
  });

  await check("DOCENTE · carga, horario, notas y asistencia", async () => {
    const [carga, horario, notas, asistencia] = await Promise.all([
      api(`/carga-curricular/docente/${curso[0].id_personal}`, {
        token: docente.token,
      }),
      api("/horarios/mi-horario", { token: docente.token }),
      api(
        `/calificaciones/curso/${curso[0].id_curso}/grado/${grado[0].id_grado}?bimestre=1&anio=${ANIO}`,
        { token: docente.token },
      ),
      api(
        `/asistencias/curso/${curso[0].id_curso}/fecha/2026-11-16?id_grado=${grado[0].id_grado}`,
        { token: docente.token },
      ),
    ]);
    ok(carga.respuesta, carga.datos, "carga docente");
    ok(horario.respuesta, horario.datos, "horario docente");
    ok(notas.respuesta, notas.datos, "notas docente");
    ok(asistencia.respuesta, asistencia.datos, "asistencia docente");
    return `${curso[0].nombre_curso}, notas y asistencia`;
  });

  await check("DOCENTE · conclusiones descriptivas", async () => {
    const { respuesta, datos } = await api(
      `/calificaciones/curso/${curso[0].id_curso}/grado/${grado[0].id_grado}/conclusiones?bimestre=1&anio=${ANIO}`,
      { token: docente.token },
    );
    ok(respuesta, datos, "conclusiones docente");
    const filas = datos.data?.alumnos || [];
    if (filas.length < 15) {
      throw new Error(`Solo ${filas.length} alumnos en conclusiones`);
    }
    const conConclusion = filas.filter(
      (fila) => fila.descripcion && fila.nivel_logro,
    ).length;
    if (conConclusion < 15) {
      throw new Error(`Solo ${conConclusion} conclusiones completas`);
    }
    if (datos.data?.acta_cerrada) {
      throw new Error("El acta del bimestre 1 está cerrada");
    }
    return `${filas.length} alumnos, ${conConclusion} conclusiones`;
  });

  await check("DOCENTE · libreta y ficha de alumno", async () => {
    const [libreta, pdf] = await Promise.all([
      api(`/reportes/libreta/${alumno[0].id_alumno}?bimestre=1&anio=${ANIO}`, {
        token: docente.token,
      }),
      api(`/reportes/libreta/${alumno[0].id_alumno}/pdf?bimestre=1&anio=${ANIO}`, {
        token: docente.token,
        raw: true,
      }),
    ]);
    ok(libreta.respuesta, libreta.datos, "libreta docente");
    if (pdf.status !== 200) throw new Error(`PDF docente HTTP ${pdf.status}`);
    return "libreta y PDF";
  });

  await check("DOCENTE · sin permisos de ADMIN/SECRETARIA", async () => {
    const [personal, dashboard, notificacion] = await Promise.all([
      api("/personal", { token: docente.token }),
      api("/reportes/dashboard", { token: docente.token }),
      api("/notificaciones", {
        method: "POST",
        token: docente.token,
        body: {
          id_usuario_destino: 1,
          asunto: "No permitido",
          cuerpo: "No permitido",
        },
      }),
    ]);
    if (personal.respuesta.status !== 403) throw new Error("Personal no es 403");
    if (dashboard.respuesta.status !== 403) throw new Error("Dashboard no es 403");
    if (notificacion.respuesta.status !== 403) throw new Error("Notificación no es 403");
    return "personal/dashboard/notificación 403";
  });

  await check("ESTUDIANTE · notas, asistencia, horario y libreta", async () => {
    const [notas, asistencia, horario, pdf] = await Promise.all([
      api(`/calificaciones/notas-finales/alumno/${alumno[0].id_alumno}?anio=${ANIO}`, {
        token: estudiante.token,
      }),
      api(`/asistencias/alumno/${alumno[0].id_alumno}?anio=${ANIO}`, {
        token: estudiante.token,
      }),
      api("/horarios/mi-horario", { token: estudiante.token }),
      api(`/reportes/libreta/${alumno[0].id_alumno}/pdf?bimestre=1&anio=${ANIO}`, {
        token: estudiante.token,
        raw: true,
      }),
    ]);
    ok(notas.respuesta, notas.datos, "notas estudiante");
    ok(asistencia.respuesta, asistencia.datos, "asistencia estudiante");
    ok(horario.respuesta, horario.datos, "horario estudiante");
    if (pdf.status !== 200) throw new Error(`PDF estudiante HTTP ${pdf.status}`);
    return "notas, asistencia, horario y libreta";
  });

  await check("ESTUDIANTE · sin acceso a otros módulos", async () => {
    const [alumnos, otro] = await Promise.all([
      api("/alumnos", { token: estudiante.token }),
      api(`/calificaciones/notas-finales/alumno/${otroAlumno[0].id_alumno}?anio=${ANIO}`, {
        token: estudiante.token,
      }),
    ]);
    if (alumnos.respuesta.status !== 403) throw new Error("Alumnos no es 403");
    if (![403, 404].includes(otro.respuesta.status)) {
      throw new Error(`Otro alumno HTTP ${otro.respuesta.status}`);
    }
    return "padrón y otro alumno bloqueados";
  });

  console.log("");
  const pass = resultados.filter((r) => r.estado === "PASS").length;
  const fail = resultados.filter((r) => r.estado === "FAIL").length;
  console.log(`${pass} PASS, ${fail} FAIL, 0 SKIP`);
  if (fail > 0) {
    console.log("Resultado: FALLO");
    process.exitCode = 1;
  } else {
    console.log("Resultado: OK");
  }
}

main()
  .catch((error) => {
    console.error("UAT verify falló:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
