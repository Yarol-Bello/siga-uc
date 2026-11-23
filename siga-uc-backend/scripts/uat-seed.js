#!/usr/bin/env node
/**
 * Dataset UAT realista para SIGA-UC.
 *
 * Requiere:
 *  - base `siga_uc_uat` ya creada con siga_uc.sql + seed_produccion + H32…H80
 *  - backend en http://localhost:3000 usando esa base
 *  - admin 74829102 / UC2026* con requiere_cambio_password=false
 *
 * Uso: node scripts/uat-seed.js
 *
 * Para una base remota (solo demo; nunca producción real):
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
const ADMIN_DNI = "74829102";
const ADMIN_PASSWORD = process.env.UAT_ADMIN_PASSWORD || "UC2026*";

const pool = process.env.UAT_DATABASE_URL
  ? new Pool({
      connectionString: process.env.UAT_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      options: "-c search_path=public,extensions",
      max: 6,
    })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      database: DB_NAME,
      max: 6,
    });

let token = null;
const resumen = {
  personal: 0,
  alumnos: 0,
  matriculas: 0,
  pensiones: 0,
  pagos: 0,
  notas: 0,
  asistencias: 0,
  horarios: 0,
  becas: 0,
};
const errores = [];

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(ruta, opciones = {}) {
  const { method = "GET", body, auth = true, raw = false } = opciones;
  const headers = { Accept: raw ? "*/*" : "application/json" };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
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

async function apiOk(ruta, opciones, etiqueta) {
  const { respuesta, datos } = await api(ruta, opciones);
  if (!respuesta.ok) {
    throw new Error(
      `${etiqueta}: HTTP ${respuesta.status} ${datos?.message || ""}`,
    );
  }
  return datos;
}

async function sql(texto, params = []) {
  const result = await pool.query(texto, params);
  return result.rows;
}

async function login(dni, password, etiqueta) {
  const { respuesta, datos } = await api("/auth/login", {
    method: "POST",
    auth: false,
    body: { dni, password },
  });
  if (!respuesta.ok || !datos?.data?.token) {
    throw new Error(
      `${etiqueta}: login HTTP ${respuesta.status} ${datos?.message || ""}`,
    );
  }
  return datos.data;
}

const nombres = [
  "María Fernanda",
  "Luis Alejandro",
  "Camila",
  "Diego",
  "Valentina",
  "Mateo",
  "Sofía",
  "Sebastián",
  "Valeria",
  "Adrián",
  "Lucía",
  "Joaquín",
  "Ximena",
  "Renato",
  "Ariana",
  "Gabriel",
  "Daniela",
  "Emilio",
  "Antonella",
  "Rodrigo",
  "Flavia",
  "Ian",
  "Micaela",
  "Thiago",
  "Alessia",
];

const apellidos = [
  "Quispe",
  "Huamán",
  "Flores",
  "Rojas",
  "Ccopa",
  "Yupanqui",
  "Mendoza",
  "Salazar",
  "Paredes",
  "Soto",
  "Ramos",
  "Vega",
  "Torres",
  "García",
  "Rodríguez",
  "Chávez",
  "Vargas",
  "Castro",
  "Ortiz",
  "Reyes",
];

const docentes = [
  {
    dni: "73000001",
    nombres: "Ana María",
    apellidos: "Quispe Rojas",
    especialidad: "Matemática",
    cargo: "Docente de Matemática",
    correo: "ana.quispe@colegio-uat.edu.pe",
    password: "Docente2026*",
    areas: ["Aritmética", "Álgebra"],
  },
  {
    dni: "73000002",
    nombres: "Marco Antonio",
    apellidos: "Huamán Torres",
    especialidad: "Matemática",
    cargo: "Docente de Matemática",
    correo: "marco.huaman@colegio-uat.edu.pe",
    password: "Docente2026*",
    areas: ["Geometría", "Razonamiento Matemático", "Trigonometría"],
  },
  {
    dni: "73000003",
    nombres: "Luis Alberto",
    apellidos: "Flores Mendoza",
    especialidad: "Comunicación",
    cargo: "Docente de Comunicación",
    correo: "luis.flores@colegio-uat.edu.pe",
    password: "Docente2026*",
    areas: ["Comunicación"],
  },
  {
    dni: "73000004",
    nombres: "Carmen Rosa",
    apellidos: "Yupanqui Salazar",
    especialidad: "Lenguaje",
    cargo: "Docente de Lenguaje",
    correo: "carmen.yupanqui@colegio-uat.edu.pe",
    password: "Docente2026*",
    areas: ["Razonamiento Verbal"],
  },
  {
    dni: "73000005",
    nombres: "Rosa Elena",
    apellidos: "Ccopa Paredes",
    especialidad: "Ciencias Naturales",
    cargo: "Docente de Ciencias",
    correo: "rosa.ccopa@colegio-uat.edu.pe",
    password: "Docente2026*",
    areas: ["Física", "Química"],
  },
  {
    dni: "73000006",
    nombres: "Jorge Luis",
    apellidos: "Mendoza Soto",
    especialidad: "Ciencias Sociales",
    cargo: "Docente de Sociales",
    correo: "jorge.mendoza@colegio-uat.edu.pe",
    password: "Docente2026*",
    areas: ["Historia", "Geografía"],
  },
  {
    dni: "73000007",
    nombres: "Lucía Fernanda",
    apellidos: "Ramos Vega",
    especialidad: "Secretaría Académica",
    cargo: "Secretaria Académica",
    correo: "lucia.ramos@colegio-uat.edu.pe",
    password: "Secretaria2026*",
    id_rol: 3,
    areas: [],
  },
];

const cursosPorProfesor = new Map();

async function crearPersonal() {
  const existentes = await sql(
    `SELECT u.dni, u.id_usuario, p.id_personal, r.nombre_rol
     FROM usuarios u
     LEFT JOIN personal p ON p.id_usuario = u.id_usuario
     JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.dni = ANY($1::text[])`,
    [docentes.map((d) => d.dni)],
  );
  const porDni = new Map(existentes.map((f) => [f.dni, f]));

  for (const docente of docentes) {
    const existente = porDni.get(docente.dni);
    if (existente) {
      resumen.personal += 1;
      if (docente.id_rol !== 3) cursosPorProfesor.set(docente.dni, []);
      continue;
    }
    const data = await apiOk(
      "/personal",
      {
        method: "POST",
        body: {
          dni: docente.dni,
          nombres: docente.nombres,
          apellidos: docente.apellidos,
          correo_institucional: docente.correo,
          correo_personal: docente.correo,
          telefono: `9${docente.dni.slice(-8)}`,
          id_rol: docente.id_rol || 2,
          password: docente.password,
          especialidad: docente.especialidad,
          cargo: docente.cargo,
          fecha_ingreso: "2024-03-01",
        },
      },
      `Crear personal ${docente.nombres}`,
    );
    docente.id_personal = Number(data.data.id_personal);
    docente.id_usuario = Number(data.data.id_usuario);
    resumen.personal += 1;
  }

  await sql(
    `UPDATE usuarios SET requiere_cambio_password = FALSE
     WHERE dni = ANY($1::text[])`,
    [docentes.map((d) => d.dni)],
  );
}

async function cargarPersonal() {
  const filas = await sql(
    `SELECT u.dni, u.id_usuario, p.id_personal, r.nombre_rol
     FROM usuarios u
     JOIN personal p ON p.id_usuario = u.id_usuario
     JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.dni = ANY($1::text[])`,
    [docentes.map((d) => d.dni)],
  );
  const porDni = new Map(filas.map((f) => [f.dni, f]));
  for (const docente of docentes) {
    const fila = porDni.get(docente.dni);
    if (fila) {
      docente.id_personal = Number(fila.id_personal);
      docente.id_usuario = Number(fila.id_usuario);
    }
  }
}

async function asignarTutores() {
  const grados = await sql(
    `SELECT id_grado, nombre_grado FROM grados WHERE anio_lectivo = $1 ORDER BY orden`,
    [ANIO],
  );
  const docentesTutores = docentes.filter((d) => d.id_rol !== 3).slice(0, 5);
  for (let i = 0; i < grados.length && i < docentesTutores.length; i += 1) {
    await apiOk(
      "/carga-curricular/tutor",
      {
        method: "POST",
        body: {
          id_grado: grados[i].id_grado,
          id_personal: docentesTutores[i].id_personal,
          anio_lectivo: ANIO,
        },
      },
      `Tutor ${grados[i].nombre_grado}`,
    );
  }
}

async function distribuirCarga() {
  const filas = await sql(
    `SELECT cc.id_carga, cc.id_grado, g.nombre_grado,
            c.nombre_curso, c.area_academica
     FROM carga_curricular cc
     JOIN cursos c ON c.id_curso = cc.id_curso
     JOIN grados g ON g.id_grado = cc.id_grado
     WHERE cc.anio_lectivo = $1
     ORDER BY cc.id_carga`,
    [ANIO],
  );
  const porArea = new Map();
  for (const docente of docentes) {
    if (docente.id_rol === 3) continue;
    for (const area of docente.areas) porArea.set(area, docente);
  }

  for (const fila of filas) {
    const docente =
      porArea.get(fila.nombre_curso) ||
      porArea.get(fila.area_academica) ||
      docentes.find((d) => d.id_rol !== 3);
    if (!docente) continue;
    await sql(
      `UPDATE carga_curricular SET id_personal = $1 WHERE id_carga = $2`,
      [docente.id_personal, fila.id_carga],
    );
    if (!cursosPorProfesor.has(docente.dni)) {
      cursosPorProfesor.set(docente.dni, []);
    }
    cursosPorProfesor.get(docente.dni).push(fila.nombre_curso);
  }
  return filas.length;
}

async function crearAlumnos() {
  const grados = await sql(
    `SELECT id_grado, orden, nombre_grado
     FROM grados WHERE anio_lectivo = $1 ORDER BY orden`,
    [ANIO],
  );
  if (grados.length !== 5) {
    throw new Error(`Se esperaban 5 grados, hay ${grados.length}`);
  }

  const alumnos = [];
  let indice = 0;
  for (const grado of grados) {
    for (let i = 0; i < 15; i += 1) {
      indice += 1;
      const dni = String(72000000 + indice);
      const apoderadoDni = String(74000000 + indice);
      const nombresAlumno = nombres[(indice * 7) % nombres.length];
      const apellidosAlumno = `${apellidos[(indice * 3) % apellidos.length]} ${
        apellidos[(indice * 5 + 2) % apellidos.length]
      }`;
      const anioNacimiento = 2014 - Number(grado.orden);
      const fechaNacimiento = `${anioNacimiento}-${String(
        (indice % 12) + 1,
      ).padStart(2, "0")}-${String((indice % 27) + 1).padStart(2, "0")}`;

      const data = await apiOk(
        "/alumnos",
        {
          method: "POST",
          body: {
            dni,
            nombres: nombresAlumno,
            apellidos: apellidosAlumno,
            fecha_nacimiento: fechaNacimiento,
            id_grado: grado.id_grado,
            colegio_procedencia:
              grado.orden === 1
                ? "I.E. Nuestra Señora del Rosario"
                : "Continuidad en la misma institución",
            direccion: `Jr. Los Andes ${100 + indice}, Huancayo`,
            telefono: `9${String(80000000 + indice).slice(-8)}`,
            correo_personal: `familia.${dni}@correo-uat.pe`,
            apoderado: {
              dni: apoderadoDni,
              nombres: ["Patricia", "Roberto", "Elena", "Carlos", "Mónica"][
                indice % 5
              ],
              apellidos: apellidosAlumno,
              telefono: `9${String(70000000 + indice).slice(-8)}`,
              correo: `apoderado.${dni}@correo-uat.pe`,
            },
          },
        },
        `Crear alumno ${dni}`,
      );
      alumnos.push({
        id_alumno: Number(data.data.id_alumno),
        dni,
        nombres: nombresAlumno,
        apellidos: apellidosAlumno,
        id_grado: Number(grado.id_grado),
        grado: grado.nombre_grado,
      });
      resumen.alumnos += 1;
    }
  }
  return alumnos;
}

async function habilitarAccesoAlumnos() {
  await sql(
    `UPDATE usuarios u
     SET password_hash = crypt('UC' || u.dni, gen_salt('bf', 10)),
         requiere_cambio_password = FALSE
     FROM roles r
     WHERE r.id_rol = u.id_rol AND r.nombre_rol = 'ESTUDIANTE'`,
  );
}

async function abrirCaja() {
  const actual = await apiOk("/caja/actual", {}, "Consultar caja");
  if (actual.data?.id_apertura) return actual.data;
  const apertura = await apiOk(
    "/caja/aperturar",
    {
      method: "POST",
      body: {
        id_caja: 1,
        monto_inicial: 1000,
        observaciones: "Apertura de caja para la demo",
      },
    },
    "Aperturar caja",
  );
  return apertura.data;
}

async function pagarMatriculas(alumnos) {
  for (const alumno of alumnos) {
    const pretickets = await sql(
      `SELECT pt.id_preticket, pt.id_concepto, pt.monto
       FROM pre_tickets pt
       JOIN conceptos_pago cp ON cp.id_concepto = pt.id_concepto
       WHERE pt.id_alumno = $1 AND pt.estado = 'PENDIENTE'
         AND cp.tipo = 'MATRICULA'
       ORDER BY pt.id_preticket DESC LIMIT 1`,
      [alumno.id_alumno],
    );
    if (!pretickets[0]) {
      errores.push(`Sin pre-ticket de matrícula para ${alumno.dni}`);
      continue;
    }
    const pt = pretickets[0];
    await apiOk(
      "/tesoreria/pagos",
      {
        method: "POST",
        body: {
          id_alumno: alumno.id_alumno,
          id_concepto: pt.id_concepto,
          id_preticket: pt.id_preticket,
          monto: Number(pt.monto),
          forma_pago: "Efectivo",
        },
      },
      `Pago matrícula ${alumno.dni}`,
    );
    resumen.pagos += 1;
    resumen.matriculas += 1;
  }
}

async function generarPensiones(alumnos) {
  await sql(
    `UPDATE alumnos SET fecha_creacion = '2026-02-15'
     WHERE anio_lectivo = $1 AND estado_matricula = 'Matriculado'`,
    [ANIO],
  );
  for (const alumno of alumnos) {
    const data = await apiOk(
      `/tesoreria/pensiones/alumno/${alumno.id_alumno}/generar`,
      { method: "POST" },
      `Generar pensiones ${alumno.dni}`,
    );
    resumen.pensiones += Number(data.data?.generadas || 0);
  }
}

const MES_TOPE_PAGOS =
  new Date().getFullYear() === ANIO
    ? Math.min(11, new Date().getMonth() + 1)
    : 11;

/**
 * Perfil de pago por estudiante. Usa el mismo módulo que las notas para que
 * los alumnos con mejores resultados también sean los más puntuales.
 */
const mesesPagadosPorPerfil = (idAlumno) => {
  const perfil = idAlumno % 10;
  if (perfil === 0) return 9; // marzo a noviembre
  if (perfil === 1) return 8; // marzo a octubre
  if (perfil <= 5) return 5; // marzo a julio
  if (perfil <= 8) return 3; // marzo a mayo
  return 1; // marzo
};

async function pagarPensiones(alumnos) {
  let pagadas = 0;
  for (const alumno of alumnos) {
    const limite = mesesPagadosPorPerfil(alumno.id_alumno);
    const pensiones = await sql(
      `SELECT id_pension, id_concepto, monto_final, mes
       FROM pensiones
       WHERE id_alumno = $1 AND anio_lectivo = $2
         AND estado = 'PENDIENTE' AND mes <= $3
       ORDER BY mes LIMIT $4`,
      [alumno.id_alumno, ANIO, MES_TOPE_PAGOS, limite],
    );

    for (const pension of pensiones) {
      const formaPago =
        pagadas % 17 === 0
          ? "BCP"
          : pagadas % 9 === 0
            ? "Yape"
            : "Efectivo";
      const referencia =
        formaPago === "BCP"
          ? `TRF-UAT-${String(pagadas + 1).padStart(4, "0")}`
          : formaPago === "Yape"
            ? `YAPE-UAT-${String(pagadas + 1).padStart(4, "0")}`
            : undefined;

      await apiOk(
        "/tesoreria/pagos",
        {
          method: "POST",
          body: {
            id_alumno: alumno.id_alumno,
            id_concepto: pension.id_concepto,
            id_pension: pension.id_pension,
            monto: Number(pension.monto_final),
            forma_pago: formaPago,
            nro_operacion: referencia,
          },
        },
        `Pago pensión ${alumno.dni} mes ${pension.mes}`,
      );
      resumen.pagos += 1;
      pagadas += 1;
    }
  }
}

/**
 * Distribuye las fechas de pago en el año escolar. El seed crea los pagos con
 * NOW(); para la demo se reescriben a la fecha del concepto (matrícula en
 * marzo, pensión en su mes) y se sincronizan boleta, pre-ticket y movimiento
 * de caja. Es solo para datos de demostración.
 */
async function ajustarFechasPago() {
  await sql(
    `UPDATE pagos p
     SET fecha_pago = make_date($1, m.mes, 5 + (p.id_alumno % 10))
     FROM pensiones m
     WHERE m.id_pension = p.id_pension`,
    [ANIO],
  );

  await sql(
    `UPDATE pagos p
     SET fecha_pago = make_date($1, 3, 1 + (p.id_alumno % 15))
     WHERE p.id_pension IS NULL AND p.id_preticket IS NOT NULL`,
    [ANIO],
  );

  await sql(
    `UPDATE boletas_electronicas b
     SET fecha_emision = p.fecha_pago
     FROM pagos p
     WHERE p.id_pago = b.id_pago`,
  );

  await sql(
    `UPDATE movimientos_caja mc
     SET fecha_hora = p.fecha_pago
     FROM pagos p
     WHERE p.id_pago = mc.id_pago`,
  );

  await sql(
    `UPDATE pre_tickets pt
     SET fecha_pago = p.fecha_pago
     FROM pagos p
     WHERE p.id_preticket = pt.id_preticket`,
  );
}

async function crearNotasYAsistencia() {
  await sql(
    `INSERT INTO calificaciones (
       id_alumno, id_curso, id_competencia, id_personal, id_grado,
       bimestre, anio_lectivo, calificacion
     )
     SELECT a.id_alumno, cc.id_curso, comp.id_competencia, cc.id_personal,
            a.id_grado, b.bimestre, $1,
            CASE
              WHEN (a.id_alumno % 10) IN (0, 1) THEN
                (ARRAY['AD','A'])[1 + ((comp.id_competencia + b.bimestre) % 2)]
              WHEN (a.id_alumno % 10) IN (2, 3, 4, 5) THEN
                (ARRAY['A','B'])[1 + ((comp.id_competencia + b.bimestre) % 2)]
              WHEN (a.id_alumno % 10) IN (6, 7, 8) THEN
                (ARRAY['B','C'])[1 + ((comp.id_competencia + b.bimestre) % 2)]
              ELSE 'C'
            END
     FROM alumnos a
     JOIN carga_curricular cc
       ON cc.id_grado = a.id_grado AND cc.anio_lectivo = a.anio_lectivo
     JOIN competencias comp ON comp.id_curso = cc.id_curso
     CROSS JOIN generate_series(1, 4) AS b(bimestre)
     WHERE a.anio_lectivo = $1 AND a.estado_matricula = 'Matriculado'
     ON CONFLICT (id_alumno, id_curso, id_competencia, bimestre, anio_lectivo)
     DO NOTHING`,
    [ANIO],
  );
  resumen.notas = Number(
    (await sql(`SELECT COUNT(*)::int AS total FROM calificaciones WHERE anio_lectivo = $1`, [ANIO]))[0].total,
  );

  await sql(
    `INSERT INTO notas_finales_area (
       id_alumno, id_curso, bimestre, anio_lectivo, nota_final, calculo_automatico
     )
     SELECT a.id_alumno, cc.id_curso, b.bimestre, $1,
            CASE
              WHEN (a.id_alumno % 10) IN (0, 1) THEN
                (ARRAY['AD','A'])[1 + ((cc.id_curso + b.bimestre) % 2)]
              WHEN (a.id_alumno % 10) IN (2, 3, 4, 5) THEN
                (ARRAY['A','B'])[1 + ((cc.id_curso + b.bimestre) % 2)]
              WHEN (a.id_alumno % 10) IN (6, 7, 8) THEN
                (ARRAY['B','C'])[1 + ((cc.id_curso + b.bimestre) % 2)]
              ELSE 'C'
            END,
            FALSE
     FROM alumnos a
     JOIN carga_curricular cc
       ON cc.id_grado = a.id_grado AND cc.anio_lectivo = a.anio_lectivo
     CROSS JOIN generate_series(1, 4) AS b(bimestre)
     WHERE a.anio_lectivo = $1 AND a.estado_matricula = 'Matriculado'
     ON CONFLICT (id_alumno, id_curso, bimestre, anio_lectivo)
     DO UPDATE SET nota_final = EXCLUDED.nota_final`,
    [ANIO],
  );

  await sql(
    `WITH base AS (
       SELECT a.id_alumno, cc.id_curso, cc.id_personal, b.bimestre,
              CASE
                WHEN (a.id_alumno % 10) IN (0, 1) THEN
                  (ARRAY['AD','A'])[1 + ((cc.id_curso + b.bimestre) % 2)]
                WHEN (a.id_alumno % 10) IN (2, 3, 4, 5) THEN
                  (ARRAY['A','B'])[1 + ((cc.id_curso + b.bimestre) % 2)]
                WHEN (a.id_alumno % 10) IN (6, 7, 8) THEN
                  (ARRAY['B','C'])[1 + ((cc.id_curso + b.bimestre) % 2)]
                ELSE 'C'
              END AS nivel
       FROM alumnos a
       JOIN carga_curricular cc
         ON cc.id_grado = a.id_grado AND cc.anio_lectivo = a.anio_lectivo
       CROSS JOIN generate_series(1, 4) AS b(bimestre)
       WHERE a.anio_lectivo = $1 AND a.estado_matricula = 'Matriculado'
     ),
     datos AS (
       SELECT id_alumno, id_curso, id_personal, bimestre, nivel,
              CASE nivel
                WHEN 'AD' THEN 'Demuestra un dominio destacado de los aprendizajes del área y participa con iniciativa.'
                WHEN 'A' THEN 'Logra los aprendizajes esperados del área y cumple con las actividades propuestas.'
                WHEN 'B' THEN 'Está en proceso de lograr los aprendizajes del área y participa en las actividades.'
                ELSE 'Requiere apoyo para alcanzar los aprendizajes esperados del área.'
              END AS avance,
              CASE nivel
                WHEN 'AD' THEN 'No se identifican dificultades relevantes; puede asumir retos de mayor complejidad.'
                WHEN 'A' THEN 'Requiere consolidar la transferencia de lo aprendido a situaciones nuevas.'
                WHEN 'B' THEN 'Requiere acompañamiento y práctica adicional para consolidar sus aprendizajes.'
                ELSE 'Presenta dificultades en los aprendizajes del área y necesita refuerzo.'
              END AS dificultad,
              CASE nivel
                WHEN 'AD' THEN 'Se recomienda continuar con situaciones desafiantes y compartir sus estrategias.'
                WHEN 'A' THEN 'Se recomienda practicar con casos contextualizados y explicar sus procedimientos.'
                WHEN 'B' THEN 'Se recomienda práctica guiada y retroalimentación constante.'
                ELSE 'Se recomienda seguimiento cercano, actividades breves y acompañamiento de la familia.'
              END AS sugerencia
       FROM base
     )
     INSERT INTO conclusiones_descriptivas (
       id_alumno, id_curso, bimestre, anio_lectivo, descripcion,
       nivel_logro, avance, dificultad, sugerencia, estado, id_personal
     )
     SELECT id_alumno, id_curso, bimestre, $1,
            avance || ' ' || dificultad || ' ' || sugerencia,
            nivel, avance, dificultad, sugerencia, 'PUBLICADO', id_personal
     FROM datos
     ON CONFLICT (id_alumno, id_curso, bimestre, anio_lectivo)
     DO UPDATE SET
       descripcion = EXCLUDED.descripcion,
       nivel_logro = EXCLUDED.nivel_logro,
       avance = EXCLUDED.avance,
       dificultad = EXCLUDED.dificultad,
       sugerencia = EXCLUDED.sugerencia,
       estado = EXCLUDED.estado,
       id_personal = EXCLUDED.id_personal`,
    [ANIO],
  );

  await sql(
    `INSERT INTO asistencia_alumnos (
       id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana,
       estado, observacion, justificada
     )
     SELECT a.id_alumno, cc.id_curso, cc.id_personal, a.id_grado,
            d.fecha,
            (ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes'])[EXTRACT(ISODOW FROM d.fecha)::int],
            CASE
              WHEN (a.id_alumno + cc.id_curso + EXTRACT(DAY FROM d.fecha)::int) % 19 = 0 THEN 'F'::bpchar
              WHEN (a.id_alumno + cc.id_curso + EXTRACT(DAY FROM d.fecha)::int) % 13 = 0 THEN 'T'::bpchar
              ELSE 'P'::bpchar
            END,
            CASE
              WHEN (a.id_alumno + cc.id_curso + EXTRACT(DAY FROM d.fecha)::int) % 19 = 0
                THEN 'Falta registrada en UAT'
              ELSE NULL
            END,
            FALSE
     FROM alumnos a
     JOIN carga_curricular cc
       ON cc.id_grado = a.id_grado AND cc.anio_lectivo = a.anio_lectivo
     CROSS JOIN (
       VALUES ('2026-11-16'::date), ('2026-11-17'::date), ('2026-11-18'::date),
              ('2026-11-19'::date), ('2026-11-20'::date)
     ) AS d(fecha)
     WHERE a.anio_lectivo = $1 AND a.estado_matricula = 'Matriculado'
     ON CONFLICT (id_alumno, id_curso, fecha) DO NOTHING`,
    [ANIO],
  );
  resumen.asistencias = Number(
    (await sql(`SELECT COUNT(*)::int AS total FROM asistencia_alumnos`))[0].total,
  );
}

async function generarHorarios() {
  const grados = await sql(
    `SELECT id_grado, nombre_grado FROM grados WHERE anio_lectivo = $1 ORDER BY orden`,
    [ANIO],
  );
  for (const grado of grados) {
    const data = await apiOk(
      "/horarios/generar",
      {
        method: "POST",
        body: { anio: ANIO, id_grado: grado.id_grado, seed: 2026 + grado.id_grado },
      },
      `Generar horario ${grado.nombre_grado}`,
    );
    const generados = Number(data.data?.generados || 0);
    const sinUbicar = data.data?.sin_ubicar?.length || 0;
    await apiOk(
      "/horarios/publicar",
      {
        method: "POST",
        body: {
          anio: ANIO,
          id_grado: grado.id_grado,
          permitir_parcial: true,
        },
      },
      `Publicar horario ${grado.nombre_grado}`,
    );
    resumen.horarios += generados;
    if (sinUbicar > 0) {
      errores.push(
        `Horario ${grado.nombre_grado}: ${sinUbicar} bloque(s) sin ubicar`,
      );
    }
  }
}

async function crearBecas(alumnos) {
  const sufijo = "UAT";
  const tipo50 = await apiOk(
    "/configuracion/becas/tipos",
    {
      method: "POST",
      body: {
        codigo: `UAT50_${sufijo}`,
        nombre: "Beca UAT 50%",
        alcance: "PENSION",
        modalidad: "PORCENTAJE",
        valor_default: 50,
        permite_combinacion: false,
        requiere_evidencia: false,
        requiere_aprobacion: true,
        activo: true,
        orden: 80,
        motivo: "Tipo de beca para datos UAT",
      },
    },
    "Crear tipo beca 50%",
  );
  const tipo100 = await apiOk(
    "/configuracion/becas/tipos",
    {
      method: "POST",
      body: {
        codigo: `UAT100_${sufijo}`,
        nombre: "Beca UAT 100%",
        alcance: "PENSION",
        modalidad: "PORCENTAJE",
        valor_default: 100,
        permite_combinacion: false,
        requiere_evidencia: false,
        requiere_aprobacion: true,
        activo: true,
        orden: 81,
        motivo: "Tipo de beca para datos UAT",
      },
    },
    "Crear tipo beca 100%",
  );

  const asignaciones = [
    { alumno: alumnos[0], tipo: tipo50, valor: 50 },
    { alumno: alumnos[1], tipo: tipo50, valor: 50 },
    { alumno: alumnos[5], tipo: tipo100, valor: 100 },
  ];
  for (const item of asignaciones) {
    await apiOk(
      "/configuracion/becas",
      {
        method: "POST",
        body: {
          id_alumno: item.alumno.id_alumno,
          id_tipo_beca: item.tipo.data.id_tipo_beca,
          alcance: "PENSION",
          modalidad: "PORCENTAJE",
          valor: item.valor,
          fecha_inicio: "2026-03-01",
          fecha_fin: null,
          prioridad: 50,
          evidencia: { detalle: "Resolución de beca UAT" },
          aprobar: true,
          motivo: "Asignación de beca para datos UAT",
        },
      },
      `Asignar beca ${item.alumno.dni}`,
    );
    resumen.becas += 1;
  }
}

async function crearNotificaciones(alumnos) {
  const alumno = alumnos[0];
  const usuario = await sql(
    `SELECT id_usuario FROM usuarios WHERE dni = $1`,
    [alumno.dni],
  );
  if (!usuario[0]) return;
  await apiOk(
    "/notificaciones",
    {
      method: "POST",
      body: {
        id_usuario_destino: usuario[0].id_usuario,
        asunto: "Bienvenida al año escolar 2026",
        cuerpo:
          "Estimada familia, le damos la bienvenida al año lectivo 2026. Revise el cronograma y los canales de atención.",
      },
    },
    "Notificación de bienvenida",
  );
}

async function cerrarCaja() {
  const actual = await apiOk("/caja/actual", {}, "Consultar caja para cierre");
  if (!actual.data?.id_apertura) return;
  const saldo = Number(
    actual.data.saldo_actual ??
      actual.data.saldo ??
      actual.data.total_efectivo ??
      0,
  );
  await apiOk(
    "/caja/cerrar",
    {
      method: "POST",
      body: {
        efectivo_fisico: saldo,
        observaciones: "Cierre de caja para la demo",
      },
    },
    "Cerrar caja UAT",
  );
}

async function main() {
  console.log("UAT SIGA-UC — generando datos realistas");
  console.log(`Base: ${DB_NAME} · API: ${BASE}`);

  const admin = await login(ADMIN_DNI, ADMIN_PASSWORD, "ADMIN");
  token = admin.token;
  console.log(`Admin: ${admin.usuario.nombre_completo}`);

  const grados = await sql(
    `SELECT COUNT(*)::int AS total FROM grados WHERE anio_lectivo = $1`,
    [ANIO],
  );
  if (grados[0].total !== 5) {
    throw new Error("La base UAT no tiene los 5 grados del seed.");
  }

  await abrirCaja();
  await crearPersonal();
  await cargarPersonal();
  await asignarTutores();
  const cargas = await distribuirCarga();
  console.log(`Carga distribuida: ${cargas} filas`);

  const alumnos = await crearAlumnos();
  await habilitarAccesoAlumnos();
  console.log(`Alumnos creados: ${alumnos.length}`);

  await pagarMatriculas(alumnos);
  console.log(`Matrículas pagadas: ${resumen.matriculas}`);

  await generarPensiones(alumnos);
  console.log(`Pensiones generadas: ${resumen.pensiones}`);

  await pagarPensiones(alumnos);
  await ajustarFechasPago();
  console.log(`Pagos totales: ${resumen.pagos}`);

  await crearNotasYAsistencia();
  console.log(
    `Notas: ${resumen.notas}, asistencias: ${resumen.asistencias}`,
  );

  await generarHorarios();
  console.log(`Horarios generados: ${resumen.horarios}`);

  await crearBecas(alumnos);
  console.log(`Becas: ${resumen.becas}`);

  await crearNotificaciones(alumnos);
  await cerrarCaja();

  console.log("\nResumen UAT:");
  console.log(JSON.stringify(resumen, null, 2));
  if (errores.length > 0) {
    console.log("\nAdvertencias:");
    for (const error of errores) console.log(` - ${error}`);
  }
  console.log("\nCredenciales UAT:");
  console.log(` ADMIN      ${ADMIN_DNI} / ${ADMIN_PASSWORD}`);
  console.log(` SECRETARIA 73000007 / Secretaria2026*`);
  console.log(` DOCENTE    73000001 / Docente2026*`);
  console.log(` ESTUDIANTE ${alumnos[0].dni} / UC${alumnos[0].dni}`);
  console.log(` ESTUDIANTE ${alumnos[1].dni} / UC${alumnos[1].dni}`);
}

main()
  .catch((error) => {
    console.error("\n❌ UAT seed falló:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
