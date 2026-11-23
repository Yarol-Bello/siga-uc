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
 * Códigos de salida: 0 si las 30 invariantes pasan; 1 si hay algún FAIL.
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
  "anios_lectivos",
  "alumnos_riesgo",
  "aperturas_caja",
  "apoderados",
  "aplicaciones_beca",
  "areas_academicas",
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
  "configuracion_anio",
  "configuracion_institucional",
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
  "periodos_clase",
  "personal",
  "politicas_promocion",
  "pre_tickets",
  "promociones",
  "recuperacion_password",
  "resumen_asistencia_curso",
  "roles",
  "tipos_beca",
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

  // 1. Las 48 tablas base del esquema existen.
  await verificarInvariante(
    1,
    "Las 48 tablas esperadas existen",
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
    "Índices críticos de pagos, boletas, multi-año y promociones",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT t.nombre AS indice_faltante
        FROM (VALUES
          ('ux_pago_pension_activo'),
          ('boletas_serie_numero_key'),
          ('uq_alumno_dni_anio'),
          ('uq_alumno_usuario_anio'),
          ('uq_alumno_codigo_anio'),
          ('uq_grado_anio_nivel_seccion_orden'),
          ('uq_anio_activo'),
          ('uq_promocion_origen_confirmada'),
          ('uq_promocion_destino_confirmada'),
          ('uq_politica_con_destino'),
          ('uq_politica_sin_destino')
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

  // 7. Estudiantes y docentes activos deben tener su ficha asociada.
  // ADMIN (1) y SECRETARIA (3) están exentos: no tienen ficha de alumno/personal.
  await verificarInvariante(
    7,
    "Estudiante/Docente activo sin ficha asociada",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT u.id_usuario, u.dni, u.id_rol
        FROM usuarios u
        WHERE u.estado = 'ACTIVO'
          AND (
            (
              u.id_rol = 4
              AND NOT EXISTS (
                SELECT 1 FROM alumnos a WHERE a.id_usuario = u.id_usuario
              )
            )
            OR
            (
              u.id_rol = 2
              AND NOT EXISTS (
                SELECT 1 FROM personal p WHERE p.id_usuario = u.id_usuario
              )
            )
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

  // 10. Todo alumno Matriculado del año activo tiene un usuario ACTIVO.
  await verificarInvariante(
    10,
    "Alumno Matriculado del año activo sin usuario ACTIVO",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT a.id_alumno, a.dni, a.id_usuario, u.estado AS estado_usuario
        FROM alumnos a
        LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
        WHERE a.estado_matricula = 'Matriculado'
          AND a.anio_lectivo = (
            SELECT anio FROM anios_lectivos WHERE estado = 'ACTIVO' LIMIT 1
          )
          AND (u.id_usuario IS NULL OR u.estado IS DISTINCT FROM 'ACTIVO')
      ) q
      ORDER BY q.id_alumno
      LIMIT 5
    `,
  );

  // 11. Debe existir exactamente un año ACTIVO.
  await verificarInvariante(
    11,
    "Exactamente un año lectivo ACTIVO",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT COUNT(*) AS anios_activos
        FROM anios_lectivos
        WHERE estado = 'ACTIVO'
        HAVING COUNT(*) <> 1
      ) q
    `,
  );

  // 12. Todo alumnos.anio_lectivo debe existir en anios_lectivos.
  await verificarInvariante(
    12,
    "Matrícula con año ausente en anios_lectivos",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT a.id_alumno, a.dni, a.anio_lectivo
        FROM alumnos a
        LEFT JOIN anios_lectivos al ON al.anio = a.anio_lectivo
        WHERE al.anio IS NULL
      ) q
      ORDER BY q.id_alumno
      LIMIT 5
    `,
  );

  // 13. Todo alumno con grado debe tener un grado del mismo año.
  await verificarInvariante(
    13,
    "Alumno con grado de otro año",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT a.id_alumno, a.dni, a.anio_lectivo,
               a.id_grado, g.anio_lectivo AS grado_anio
        FROM alumnos a
        INNER JOIN grados g ON g.id_grado = a.id_grado
        WHERE a.id_grado IS NOT NULL
          AND g.anio_lectivo IS DISTINCT FROM a.anio_lectivo
      ) q
      ORDER BY q.id_alumno
      LIMIT 5
    `,
  );

  // 14. Pensión/pre-ticket debe coincidir con el año de su matrícula.
  await verificarInvariante(
    14,
    "Pensión o pre-ticket con año distinto al de su matrícula",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT 'PENSION' AS tipo, pe.id_pension AS id_registro,
               pe.id_alumno, pe.anio_lectivo AS anio_registro,
               a.anio_lectivo AS anio_matricula
        FROM pensiones pe
        INNER JOIN alumnos a ON a.id_alumno = pe.id_alumno
        WHERE pe.anio_lectivo IS DISTINCT FROM a.anio_lectivo

        UNION ALL

        SELECT 'PRETICKET' AS tipo, pt.id_preticket AS id_registro,
               pt.id_alumno, c.anio_lectivo AS anio_registro,
               a.anio_lectivo AS anio_matricula
        FROM pre_tickets pt
        INNER JOIN alumnos a ON a.id_alumno = pt.id_alumno
        INNER JOIN conceptos_pago c ON c.id_concepto = pt.id_concepto
        WHERE c.anio_lectivo IS DISTINCT FROM a.anio_lectivo
      ) q
      ORDER BY q.tipo, q.id_registro
      LIMIT 5
    `,
  );

  // 15. Todo carga_curricular.id_grado pertenece al mismo año de la carga.
  await verificarInvariante(
    15,
    "Carga curricular con grado de otro año",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT cc.id_carga, cc.anio_lectivo,
               cc.id_grado, g.anio_lectivo AS grado_anio
        FROM carga_curricular cc
        INNER JOIN grados g ON g.id_grado = cc.id_grado
        WHERE g.anio_lectivo IS DISTINCT FROM cc.anio_lectivo
      ) q
      ORDER BY q.id_carga
      LIMIT 5
    `,
  );

  // 16. Todo tutores_grado.id_grado pertenece al mismo año del tutor.
  await verificarInvariante(
    16,
    "Tutor de grado con grado de otro año",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT tg.id_tutor, tg.anio_lectivo,
               tg.id_grado, g.anio_lectivo AS grado_anio
        FROM tutores_grado tg
        INNER JOIN grados g ON g.id_grado = tg.id_grado
        WHERE g.anio_lectivo IS DISTINCT FROM tg.anio_lectivo
      ) q
      ORDER BY q.id_tutor
      LIMIT 5
    `,
  );

  // 17. Una sola promoción CONFIRMADA por matrícula de origen.
  await verificarInvariante(
    17,
    "Más de una promoción confirmada para la misma matrícula origen",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT p.id_alumno_origen, COUNT(*)::int AS total_confirmadas
        FROM promociones p
        WHERE p.estado = 'CONFIRMADA'
        GROUP BY p.id_alumno_origen
        HAVING COUNT(*) > 1
      ) q
      ORDER BY q.id_alumno_origen
      LIMIT 5
    `,
  );

  // 18. La matrícula destino debe ser del año y grado de la promoción.
  await verificarInvariante(
    18,
    "Promoción con matrícula destino de otro año o grado",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT p.id_promocion, p.anio_destino,
               ad.anio_lectivo AS alumno_anio,
               p.id_grado_destino,
               ad.id_grado AS alumno_grado,
               g.anio_lectivo AS grado_anio
        FROM promociones p
        INNER JOIN alumnos ad ON ad.id_alumno = p.id_alumno_destino
        INNER JOIN grados g ON g.id_grado = p.id_grado_destino
        WHERE p.estado = 'CONFIRMADA'
          AND p.resultado IN ('PROMOVIDO', 'REPITENTE')
          AND (
            ad.anio_lectivo IS DISTINCT FROM p.anio_destino
            OR g.anio_lectivo IS DISTINCT FROM p.anio_destino
            OR ad.id_grado IS DISTINCT FROM p.id_grado_destino
          )
      ) q
      ORDER BY q.id_promocion
      LIMIT 5
    `,
  );

  // 19. Egresados y retirados no deben tener matrícula destino.
  await verificarInvariante(
    19,
    "Egresado o retirado con matrícula destino",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT p.id_promocion, p.resultado, p.id_alumno_destino
        FROM promociones p
        WHERE p.estado = 'CONFIRMADA'
          AND p.resultado IN ('EGRESADO', 'RETIRADO')
          AND p.id_alumno_destino IS NOT NULL
      ) q
      ORDER BY q.id_promocion
      LIMIT 5
    `,
  );

  // 20. Política única por origen, destino y nombre.
  await verificarInvariante(
    20,
    "Política de promoción duplicada por origen/destino/nombre",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT p.anio_origen, p.anio_destino, p.nombre,
               COUNT(*)::int AS total
        FROM politicas_promocion p
        GROUP BY p.anio_origen, p.anio_destino, p.nombre
        HAVING COUNT(*) > 1
      ) q
      ORDER BY q.anio_origen, q.nombre
      LIMIT 5
    `,
  );

  // 21. H71: un retirado tiene expediente congelado y, si no conserva otra
  //     matrícula vigente, su usuario está INACTIVO.
  await verificarInvariante(
    21,
    "Retirado con expediente sin congelar o usuario activo sin otra matrícula",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT a.id_alumno, a.anio_lectivo, a.dni,
               a.id_usuario, u.estado AS estado_usuario,
               e.id_expediente, e.congelado
        FROM alumnos a
        INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
        LEFT JOIN expediente_alumno e ON e.id_alumno = a.id_alumno
        WHERE a.estado_matricula = 'Retirado'
          AND (
            e.id_expediente IS NULL
            OR e.congelado IS DISTINCT FROM TRUE
            OR (
              u.id_rol = 4
              AND u.estado IS DISTINCT FROM 'INACTIVO'
              AND NOT EXISTS (
                SELECT 1
                FROM alumnos a2
                WHERE a2.id_usuario = a.id_usuario
                  AND a2.estado_matricula <> 'Retirado'
              )
            )
          )
      ) q
      ORDER BY q.id_alumno
      LIMIT 5
    `,
  );

  // 22. H74: exactamente una configuración institucional.
  await verificarInvariante(
    22,
    "Configuración institucional única",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT COUNT(*)::int AS total
        FROM configuracion_institucional
      ) q
      WHERE q.total <> 1
    `,
  );

  // 23. H74: una configuración por cada año lectivo.
  await verificarInvariante(
    23,
    "Una configuración por año lectivo",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT a.anio, COUNT(c.anio)::int AS configuraciones
        FROM anios_lectivos a
        LEFT JOIN configuracion_anio c ON c.anio = a.anio
        GROUP BY a.anio
        HAVING COUNT(c.anio) <> 1
      ) q
      ORDER BY q.anio
      LIMIT 5
    `,
  );

  // 24. H74: días, jornada y límites coherentes.
  await verificarInvariante(
    24,
    "Días, jornada y límites coherentes",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT c.anio, c.dias_clase, c.hora_inicio_jornada,
               c.hora_fin_jornada, c.duracion_min_bloque,
               c.max_bloques_curso_dia, c.horas_default_carga
        FROM configuracion_anio c
        WHERE c.dias_clase IS NULL
           OR cardinality(c.dias_clase) = 0
           OR (
             c.hora_inicio_jornada IS NOT NULL
             AND c.hora_fin_jornada IS NOT NULL
             AND c.hora_fin_jornada <= c.hora_inicio_jornada
           )
           OR c.duracion_min_bloque <= 0
           OR c.max_bloques_curso_dia <= 0
           OR c.horas_default_carga <= 0
      ) q
      ORDER BY q.anio
      LIMIT 5
    `,
  );

  // 25. H75: tarifas con monto, mes o vigencia inválidos.
  await verificarInvariante(
    25,
    "Tarifas con monto, mes o vigencia inválidos",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT id_concepto, nombre, monto_base, tipo, mes,
               vigente_desde, vigente_hasta
        FROM conceptos_pago
        WHERE monto_base <= 0
           OR (tipo = 'PENSION' AND mes IS NULL)
           OR (vigente_hasta IS NOT NULL AND vigente_hasta < vigente_desde)
      ) q
      ORDER BY q.id_concepto
      LIMIT 5
    `,
  );

  // 26. H75: pensión sin concepto de tarifa.
  await verificarInvariante(
    26,
    "Pensión sin concepto de tarifa",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT p.id_pension, p.id_alumno, p.anio_lectivo, p.mes, p.estado
        FROM pensiones p
        WHERE p.id_concepto IS NULL
      ) q
      ORDER BY q.id_pension
      LIMIT 5
    `,
  );

  // 27. H75: tarifa abierta duplicada por alcance.
  await verificarInvariante(
    27,
    "Tarifa abierta duplicada por alcance",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT anio_lectivo, tipo, mes, nivel, id_grado, COUNT(*)::int AS total
        FROM conceptos_pago
        WHERE activo = TRUE AND vigente_hasta IS NULL
          AND tipo IN ('MATRICULA', 'PENSION')
        GROUP BY anio_lectivo, tipo, mes, nivel, id_grado
        HAVING COUNT(*) > 1
      ) q
      ORDER BY q.anio_lectivo, q.tipo
      LIMIT 5
    `,
  );

  // 28. H76: curso con área fuera del catálogo.
  await verificarInvariante(
    28,
    "Curso con área fuera del catálogo",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT c.id_curso, c.nombre_curso, c.area_academica
        FROM cursos c
        WHERE NOT EXISTS (
          SELECT 1 FROM areas_academicas a WHERE a.nombre = c.area_academica
        )
      ) q
      ORDER BY q.id_curso
      LIMIT 5
    `,
  );

  // 29. H76: competencia con orden duplicado.
  await verificarInvariante(
    29,
    "Competencia con orden duplicado por curso",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT id_curso, orden, COUNT(*)::int AS total
        FROM competencias
        GROUP BY id_curso, orden
        HAVING COUNT(*) > 1
      ) q
      ORDER BY q.id_curso, q.orden
      LIMIT 5
    `,
  );

  // 30. H76: carga con horas inválidas.
  await verificarInvariante(
    30,
    "Carga curricular con horas inválidas",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT id_carga, id_grado, id_curso, horas_asignadas
        FROM carga_curricular
        WHERE horas_asignadas IS NOT NULL AND horas_asignadas <= 0
      ) q
      ORDER BY q.id_carga
      LIMIT 5
    `,
  );

  // 31. H78: tipo de beca con reglas inválidas.
  await verificarInvariante(
    31,
    "Tipos de beca con reglas inválidas",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT id_tipo_beca, codigo, alcance, modalidad,
               valor_default, tope_monto
        FROM tipos_beca
        WHERE alcance NOT IN ('MATRICULA', 'PENSION', 'AMBOS')
           OR modalidad NOT IN ('PORCENTAJE', 'MONTO_FIJO')
           OR valor_default < 0
           OR (modalidad = 'PORCENTAJE' AND valor_default > 100)
           OR (tope_monto IS NOT NULL AND tope_monto < 0)
      ) q
      ORDER BY q.id_tipo_beca
      LIMIT 5
    `,
  );

  // 32. H78: beca aprobada con valor o vigencia inválidos.
  await verificarInvariante(
    32,
    "Becas con valor o vigencia inválidos",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT id_beca, id_alumno, id_tipo_beca, estado, valor,
               modalidad, fecha_inicio, fecha_fin
        FROM becas
        WHERE id_tipo_beca IS NULL
           OR alcance NOT IN ('MATRICULA', 'PENSION', 'AMBOS')
           OR modalidad NOT IN ('PORCENTAJE', 'MONTO_FIJO')
           OR valor <= 0
           OR (modalidad = 'PORCENTAJE' AND valor > 100)
           OR (fecha_fin IS NOT NULL AND fecha_fin < fecha_inicio)
           OR estado NOT IN ('SOLICITADA', 'APROBADA', 'RECHAZADA', 'ANULADA')
      ) q
      ORDER BY q.id_beca
      LIMIT 5
    `,
  );

  // 33. H78: el descuento debe coincidir con las aplicaciones registradas.
  await verificarInvariante(
    33,
    "Descuentos sin aplicaciones de beca consistentes",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT 'PENSION' AS origen, p.id_pension AS id,
               p.descuento, COALESCE(SUM(ab.monto_aplicado), 0) AS aplicado
        FROM pensiones p
        LEFT JOIN aplicaciones_beca ab ON ab.id_pension = p.id_pension
        WHERE p.descuento > 0
        GROUP BY p.id_pension, p.descuento
        HAVING ABS(p.descuento - COALESCE(SUM(ab.monto_aplicado), 0)) > 0.01
        UNION ALL
        SELECT 'PRETICKET' AS origen, pt.id_preticket AS id,
               pt.descuento, COALESCE(SUM(ab.monto_aplicado), 0) AS aplicado
        FROM pre_tickets pt
        LEFT JOIN aplicaciones_beca ab ON ab.id_preticket = pt.id_preticket
        WHERE pt.descuento > 0
        GROUP BY pt.id_preticket, pt.descuento
        HAVING ABS(pt.descuento - COALESCE(SUM(ab.monto_aplicado), 0)) > 0.01
      ) q
      ORDER BY q.origen, q.id
      LIMIT 5
    `,
  );

  // 34. H78: EXONERADO debe tener monto cero.
  await verificarInvariante(
    34,
    "Cargos EXONERADO con monto distinto de cero",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT 'PENSION' AS origen, id_pension AS id, monto_final AS monto
        FROM pensiones
        WHERE estado = 'EXONERADO' AND monto_final <> 0
        UNION ALL
        SELECT 'PRETICKET' AS origen, id_preticket AS id, monto
        FROM pre_tickets
        WHERE estado = 'EXONERADO' AND monto <> 0
      ) q
      ORDER BY q.origen, q.id
      LIMIT 5
    `,
  );

  // 35. H79: una instalación con ADMIN no debe quedar pendiente de setup.
  await verificarInvariante(
    35,
    "Configuración inicial pendiente con administrador existente",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT c.id_configuracion, c.setup_completado,
               (SELECT COUNT(*)::int
                FROM usuarios u
                INNER JOIN roles r ON r.id_rol = u.id_rol
                WHERE r.nombre_rol = 'ADMIN') AS admins
        FROM configuracion_institucional c
        WHERE c.setup_completado = false
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            INNER JOIN roles r ON r.id_rol = u.id_rol
            WHERE r.nombre_rol = 'ADMIN'
          )
      ) q
      ORDER BY q.id_configuracion
      LIMIT 5
    `,
  );

  // 36. H80: conclusiones estructuradas válidas y publicadas completas.
  await verificarInvariante(
    36,
    "Conclusiones estructuradas inválidas o publicadas incompletas",
    `
      SELECT q.*, COUNT(*) OVER() AS _total
      FROM (
        SELECT cd.id_conclusion, cd.id_alumno, cd.id_curso,
               cd.bimestre, cd.anio_lectivo, cd.nivel_logro, cd.estado,
               char_length(cd.descripcion) AS longitud,
               CASE
                 WHEN cd.nivel_logro IS NOT NULL
                   AND cd.nivel_logro NOT IN ('AD', 'A', 'B', 'C')
                   THEN 'NIVEL_INVALIDO'
                 WHEN cd.estado NOT IN ('BORRADOR', 'PUBLICADO')
                   THEN 'ESTADO_INVALIDO'
                 WHEN char_length(cd.descripcion) > 350
                   THEN 'LONGITUD'
                 WHEN cd.estado = 'PUBLICADO'
                   AND (cd.nivel_logro IS NULL OR btrim(cd.descripcion) = '')
                   THEN 'PUBLICADA_INCOMPLETA'
               END AS problema
        FROM conclusiones_descriptivas cd
      ) q
      WHERE q.problema IS NOT NULL
      ORDER BY q.id_conclusion
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
