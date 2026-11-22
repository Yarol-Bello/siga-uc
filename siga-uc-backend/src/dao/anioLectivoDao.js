/**
 * DAO del catálogo de años lectivos (H49 / Fase 6.2)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * `anios_lectivos` nace en la migración H49. Si la tabla no existe, las
 * consultas lanzan el código 42P01 y el servicio lo traduce a 503
 * H49_NO_APLICADO.
 */

const { query } = require("../config/database");

const ejecutar = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

/**
 * Comprueba si una tabla existe. Se usa para no romper el catálogo en bases
 * antiguas que todavía no aplicaron H47/H48.
 */
const existeTabla = async (nombre, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT to_regclass($1) AS tabla`,
    [`public.${nombre}`],
  );
  return Boolean(result.rows[0]?.tabla);
};

/**
 * Lista los años con su estado y los conteos operativos.
 * No escribe nada.
 */
const listar = async () => {
  const tieneActas = await existeTabla("actas_bimestrales");
  const tieneHorarios = await existeTabla("horarios");
  const tienePeriodos = await existeTabla("periodos_clase");

  const subActas = tieneActas
    ? `(SELECT COUNT(*)::int FROM actas_bimestrales ab WHERE ab.anio_lectivo = a.anio)`
    : `0`;
  const subPeriodos = tienePeriodos
    ? `(SELECT COUNT(*)::int FROM periodos_clase p WHERE p.anio_lectivo = a.anio)`
    : `0`;
  const subHorarios = tieneHorarios
    ? `(SELECT COUNT(*)::int FROM horarios h WHERE h.anio_lectivo = a.anio)`
    : `0`;

  const result = await query(
    `SELECT
       a.anio,
       a.estado,
       a.fecha_inicio,
       a.fecha_fin,
       a.creado_por,
       a.fecha_creacion,
       a.cerrado_por,
       a.fecha_cierre,
       a.observacion,
       u.nombres || ' ' || u.apellidos AS creado_por_nombre,
       c.nombres || ' ' || c.apellidos AS cerrado_por_nombre,
       (SELECT COUNT(*)::int FROM grados g
         WHERE g.anio_lectivo = a.anio) AS grados,
       (SELECT COUNT(*)::int FROM conceptos_pago cp
         WHERE cp.anio_lectivo = a.anio) AS conceptos,
       (SELECT COUNT(*)::int FROM conceptos_pago cp
         WHERE cp.anio_lectivo = a.anio AND cp.tipo = 'MATRICULA') AS conceptos_matricula,
       ${subPeriodos} AS periodos,
       (SELECT COUNT(*)::int FROM carga_curricular cc
         WHERE cc.anio_lectivo = a.anio) AS carga,
       (SELECT COUNT(*)::int FROM tutores_grado tg
         WHERE tg.anio_lectivo = a.anio) AS tutores,
       (SELECT COUNT(*)::int FROM alumnos al
         WHERE al.anio_lectivo = a.anio) AS alumnos,
       (SELECT COUNT(*)::int FROM pagos p
         INNER JOIN alumnos al ON al.id_alumno = p.id_alumno
         WHERE al.anio_lectivo = a.anio) AS pagos,
       (
         (SELECT COUNT(*)::int FROM calificaciones ca
           WHERE ca.anio_lectivo = a.anio)
         + (SELECT COUNT(*)::int FROM notas_finales_area nf
             WHERE nf.anio_lectivo = a.anio)
       ) AS notas,
       (SELECT COUNT(*)::int FROM asistencia_alumnos aa
         WHERE EXTRACT(YEAR FROM aa.fecha)::int = a.anio) AS asistencia,
       (SELECT COUNT(*)::int FROM pensiones pe
         WHERE pe.anio_lectivo = a.anio) AS pensiones,
       (SELECT COUNT(*)::int FROM pre_tickets pt
         INNER JOIN conceptos_pago cp ON cp.id_concepto = pt.id_concepto
         WHERE cp.anio_lectivo = a.anio) AS pretickets,
       ${subActas} AS actas,
       ${subHorarios} AS horarios
     FROM anios_lectivos a
     LEFT JOIN usuarios u ON u.id_usuario = a.creado_por
     LEFT JOIN usuarios c ON c.id_usuario = a.cerrado_por
     ORDER BY a.anio DESC`,
  );

  return result.rows;
};

const findByAnio = async (anio, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT * FROM anios_lectivos WHERE anio = $1`,
    [anio],
  );
  return result.rows[0] || null;
};

const findByAnioForUpdate = async (anio, client) => {
  const result = await client.query(
    `SELECT * FROM anios_lectivos WHERE anio = $1 FOR UPDATE`,
    [anio],
  );
  return result.rows[0] || null;
};

const buscarActivosForUpdate = async (anioExcluido, client) => {
  const result = await client.query(
    `SELECT anio, estado
     FROM anios_lectivos
     WHERE estado = 'ACTIVO' AND anio <> $1
     ORDER BY anio
     FOR UPDATE`,
    [anioExcluido],
  );
  return result.rows;
};

const crear = async ({ anio, creadoPor = null, observacion = null }, client = null) => {
  const result = await ejecutar(
    client,
    `INSERT INTO anios_lectivos (anio, estado, creado_por, observacion)
     VALUES ($1, 'PLANIFICADO', $2, $3)
     ON CONFLICT (anio) DO NOTHING
     RETURNING *`,
    [anio, creadoPor, observacion],
  );
  return result.rows[0] || null;
};

const cerrar = async ({ anio, cerradoPor = null }, client = null) => {
  const result = await ejecutar(
    client,
    `UPDATE anios_lectivos
     SET estado = 'CERRADO',
         cerrado_por = $2,
         fecha_cierre = now()
     WHERE anio = $1 AND estado = 'ACTIVO'
     RETURNING *`,
    [anio, cerradoPor],
  );
  return result.rows[0] || null;
};

const activar = async (anio, client = null) => {
  const result = await ejecutar(
    client,
    `UPDATE anios_lectivos
     SET estado = 'ACTIVO',
         cerrado_por = NULL,
         fecha_cierre = NULL
     WHERE anio = $1 AND estado = 'PLANIFICADO'
     RETURNING *`,
    [anio],
  );
  return result.rows[0] || null;
};

const actualizarObservacion = async (anio, observacion, client = null) => {
  const result = await ejecutar(
    client,
    `UPDATE anios_lectivos
     SET observacion = $2
     WHERE anio = $1
     RETURNING *`,
    [anio, observacion],
  );
  return result.rows[0] || null;
};

/**
 * Oferta mínima para poder activar: al menos un grado y un concepto MATRICULA.
 */
const contarOfertaMinima = async (anio, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT
       (SELECT COUNT(*)::int FROM grados g WHERE g.anio_lectivo = $1) AS grados,
       (SELECT COUNT(*)::int FROM conceptos_pago cp
         WHERE cp.anio_lectivo = $1 AND cp.tipo = 'MATRICULA') AS matricula`,
    [anio],
  );
  return result.rows[0] || { grados: 0, matricula: 0 };
};

const eliminarAnio = async (anio, client = null) => {
  const result = await ejecutar(
    client,
    `DELETE FROM anios_lectivos WHERE anio = $1 RETURNING *`,
    [anio],
  );
  return result.rows[0] || null;
};

/**
 * Bloquea la activación de años con un advisory lock transaccional.
 */
const bloquearActivacion = async (client) => {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    "activar_anio",
  ]);
};

module.exports = {
  listar,
  findByAnio,
  findByAnioForUpdate,
  buscarActivosForUpdate,
  crear,
  cerrar,
  activar,
  actualizarObservacion,
  contarOfertaMinima,
  eliminarAnio,
  bloquearActivacion,
  existeTabla,
  ejecutar,
};
