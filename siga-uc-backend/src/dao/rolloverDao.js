/**
 * DAO del rollover anual (Fase 6.2)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Solo lee y escribe la oferta del año: grados, conceptos, períodos,
 * carga curricular y tutores. Nunca toca alumnos, pagos, notas, asistencia,
 * actas, horarios, becas ni QR.
 */

const { query } = require("../config/database");

const ejecutar = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

const existeTabla = async (nombre, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT to_regclass($1) AS tabla`,
    [`public.${nombre}`],
  );
  return Boolean(result.rows[0]?.tabla);
};

const leerGrados = async (anio, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT g.id_grado, g.nombre_grado, g.nivel, g.seccion,
            g.anio_lectivo, g.orden
     FROM grados g
     WHERE g.anio_lectivo = $1
     ORDER BY g.nivel, g.seccion, g.orden, g.nombre_grado`,
    [anio],
  );
  return result.rows;
};

const leerConceptos = async (anio, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT c.id_concepto, c.nombre, c.monto_base, c.tipo, c.mes,
            c.anio_lectivo
     FROM conceptos_pago c
     WHERE c.anio_lectivo = $1
     ORDER BY c.tipo, c.mes NULLS FIRST, c.nombre`,
    [anio],
  );
  return result.rows;
};

const leerPeriodos = async (anio, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT p.id_periodo, p.anio_lectivo, p.nombre, p.orden,
            p.hora_inicio, p.hora_fin, p.tipo, p.activo
     FROM periodos_clase p
     WHERE p.anio_lectivo = $1
     ORDER BY p.orden`,
    [anio],
  );
  return result.rows;
};

const leerCarga = async (anio, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT cc.id_carga, cc.id_grado, cc.id_curso, cc.id_personal,
            cc.anio_lectivo, cc.horas_asignadas,
            g.nombre_grado, g.seccion, g.nivel, g.orden,
            c.nombre_curso, c.area_academica,
            u.nombres || ' ' || u.apellidos AS docente_nombre,
            u.estado AS docente_estado
     FROM carga_curricular cc
     INNER JOIN grados g ON g.id_grado = cc.id_grado
     INNER JOIN cursos c ON c.id_curso = cc.id_curso
     INNER JOIN personal p ON p.id_personal = cc.id_personal
     INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
     WHERE cc.anio_lectivo = $1
     ORDER BY g.nivel, g.seccion, g.orden, c.nombre_curso`,
    [anio],
  );
  return result.rows;
};

const leerTutores = async (anio, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT tg.id_tutor, tg.id_grado, tg.id_personal, tg.anio_lectivo,
            g.nombre_grado, g.seccion, g.nivel, g.orden,
            u.nombres || ' ' || u.apellidos AS docente_nombre,
            u.estado AS docente_estado
     FROM tutores_grado tg
     INNER JOIN grados g ON g.id_grado = tg.id_grado
     INNER JOIN personal p ON p.id_personal = tg.id_personal
     INNER JOIN usuarios u ON u.id_usuario = p.id_usuario
     WHERE tg.anio_lectivo = $1
     ORDER BY g.nivel, g.seccion, g.orden`,
    [anio],
  );
  return result.rows;
};

/**
 * Actividad que impide clonar o revertir un año.
 * `asistencia_alumnos` no tiene anio_lectivo: se deriva de la fecha.
 */
const contarActividad = async (anio, client = null) => {
  const tieneActas = await existeTabla("actas_bimestrales", client);
  const tieneHorarios = await existeTabla("horarios", client);
  const subActas = tieneActas
    ? `(SELECT COUNT(*)::int FROM actas_bimestrales ab WHERE ab.anio_lectivo = $1)`
    : `0`;
  const subHorarios = tieneHorarios
    ? `(SELECT COUNT(*)::int FROM horarios h WHERE h.anio_lectivo = $1)`
    : `0`;

  const result = await ejecutar(
    client,
    `SELECT
       (SELECT COUNT(*)::int FROM alumnos a WHERE a.anio_lectivo = $1) AS alumnos,
       (SELECT COUNT(*)::int FROM pagos p
         INNER JOIN alumnos a ON a.id_alumno = p.id_alumno
         WHERE a.anio_lectivo = $1) AS pagos,
       (
         (SELECT COUNT(*)::int FROM calificaciones c WHERE c.anio_lectivo = $1)
         + (SELECT COUNT(*)::int FROM notas_finales_area n WHERE n.anio_lectivo = $1)
       ) AS notas,
       (SELECT COUNT(*)::int FROM asistencia_alumnos aa
         WHERE EXTRACT(YEAR FROM aa.fecha)::int = $1) AS asistencia,
       (SELECT COUNT(*)::int FROM pensiones pe WHERE pe.anio_lectivo = $1) AS pensiones,
       (SELECT COUNT(*)::int FROM pre_tickets pt
         INNER JOIN conceptos_pago cp ON cp.id_concepto = pt.id_concepto
         WHERE cp.anio_lectivo = $1) AS pretickets,
       ${subActas} AS actas,
       ${subHorarios} AS horarios`,
    [anio],
  );
  return result.rows[0] || {};
};

const buscarGradoDestino = async ({ anio, nombre, seccion }, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT g.*
     FROM grados g
     WHERE g.anio_lectivo = $1
       AND g.nombre_grado = $2
       AND g.seccion = $3
     LIMIT 1`,
    [anio, nombre, seccion],
  );
  return result.rows[0] || null;
};

const insertarGrado = async (grado, anio, client = null) => {
  const result = await ejecutar(
    client,
    `INSERT INTO grados (nombre_grado, nivel, seccion, anio_lectivo, orden)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      grado.nombre_grado,
      grado.nivel,
      grado.seccion,
      anio,
      grado.orden,
    ],
  );
  return result.rows[0];
};

const buscarConceptoPorTipoMes = async ({ anio, tipo, mes }, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT c.*
     FROM conceptos_pago c
     WHERE c.anio_lectivo = $1
       AND c.tipo = $2
       AND c.mes IS NOT DISTINCT FROM $3::int
     LIMIT 1`,
    [anio, tipo, mes],
  );
  return result.rows[0] || null;
};

const buscarConceptoPorNombre = async ({ anio, nombre }, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT c.*
     FROM conceptos_pago c
     WHERE c.anio_lectivo = $1 AND c.nombre = $2
     LIMIT 1`,
    [anio, nombre],
  );
  return result.rows[0] || null;
};

const insertarConcepto = async (concepto, anio, client = null) => {
  const result = await ejecutar(
    client,
    `INSERT INTO conceptos_pago (nombre, monto_base, tipo, mes, anio_lectivo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      concepto.nombre,
      concepto.monto_base,
      concepto.tipo,
      concepto.mes,
      anio,
    ],
  );
  return result.rows[0];
};

const buscarPeriodoPorOrden = async ({ anio, orden }, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT p.*
     FROM periodos_clase p
     WHERE p.anio_lectivo = $1 AND p.orden = $2
     LIMIT 1`,
    [anio, orden],
  );
  return result.rows[0] || null;
};

const insertarPeriodo = async (periodo, anio, client = null) => {
  const result = await ejecutar(
    client,
    `INSERT INTO periodos_clase
       (anio_lectivo, nombre, orden, hora_inicio, hora_fin, tipo, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      anio,
      periodo.nombre,
      periodo.orden,
      periodo.hora_inicio,
      periodo.hora_fin,
      periodo.tipo,
      periodo.activo,
    ],
  );
  return result.rows[0];
};

const buscarCarga = async ({ anio, idGrado, idCurso }, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT cc.*
     FROM carga_curricular cc
     WHERE cc.anio_lectivo = $1
       AND cc.id_grado = $2
       AND cc.id_curso = $3
     LIMIT 1`,
    [anio, idGrado, idCurso],
  );
  return result.rows[0] || null;
};

const insertarCarga = async (carga, anio, client = null) => {
  const result = await ejecutar(
    client,
    `INSERT INTO carga_curricular
       (id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      carga.id_grado,
      carga.id_curso,
      carga.id_personal,
      anio,
      carga.horas_asignadas,
    ],
  );
  return result.rows[0];
};

const buscarTutor = async ({ anio, idGrado }, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT tg.*
     FROM tutores_grado tg
     WHERE tg.anio_lectivo = $1 AND tg.id_grado = $2
     LIMIT 1`,
    [anio, idGrado],
  );
  return result.rows[0] || null;
};

const insertarTutor = async (tutor, anio, client = null) => {
  const result = await ejecutar(
    client,
    `INSERT INTO tutores_grado (id_grado, id_personal, anio_lectivo)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [tutor.id_grado, tutor.id_personal, anio],
  );
  return result.rows[0];
};

const eliminarOferta = async (anio, client) => {
  const tutores = await client.query(
    `DELETE FROM tutores_grado WHERE anio_lectivo = $1`,
    [anio],
  );
  const carga = await client.query(
    `DELETE FROM carga_curricular WHERE anio_lectivo = $1`,
    [anio],
  );
  const periodos = await client.query(
    `DELETE FROM periodos_clase WHERE anio_lectivo = $1`,
    [anio],
  );
  const conceptos = await client.query(
    `DELETE FROM conceptos_pago WHERE anio_lectivo = $1`,
    [anio],
  );
  const grados = await client.query(
    `DELETE FROM grados WHERE anio_lectivo = $1`,
    [anio],
  );

  return {
    tutores: tutores.rowCount,
    carga: carga.rowCount,
    periodos: periodos.rowCount,
    conceptos: conceptos.rowCount,
    grados: grados.rowCount,
  };
};

module.exports = {
  leerGrados,
  leerConceptos,
  leerPeriodos,
  leerCarga,
  leerTutores,
  contarActividad,
  buscarGradoDestino,
  insertarGrado,
  buscarConceptoPorTipoMes,
  buscarConceptoPorNombre,
  insertarConcepto,
  buscarPeriodoPorOrden,
  insertarPeriodo,
  buscarCarga,
  insertarCarga,
  buscarTutor,
  insertarTutor,
  eliminarOferta,
};
