/**
 * DAO de horarios (H47)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");
const { getAnioLectivo } = require("../config/academico");

const SELECT_BASE = `
  SELECT
    h.id_horario,
    h.id_carga,
    h.anio_lectivo,
    h.dia_semana,
    h.id_periodo,
    h.aula,
    h.estado,
    h.creado_por,
    h.actualizado_por,
    h.creado_en,
    h.actualizado_en,
    p.nombre AS periodo_nombre,
    p.orden AS periodo_orden,
    p.hora_inicio,
    p.hora_fin,
    p.tipo AS periodo_tipo,
    g.id_grado,
    g.nombre_grado,
    g.seccion,
    g.nivel,
    c.id_curso,
    c.nombre_curso,
    c.area_academica,
    per.id_personal,
    u.nombres || ' ' || u.apellidos AS docente_nombre,
    uc.nombres || ' ' || uc.apellidos AS creado_por_nombre
  FROM horarios h
  INNER JOIN periodos_clase p ON p.id_periodo = h.id_periodo
  INNER JOIN grados g ON g.id_grado = h.id_grado
  INNER JOIN cursos c ON c.id_curso = h.id_curso
  INNER JOIN personal per ON per.id_personal = h.id_personal
  INNER JOIN usuarios u ON u.id_usuario = per.id_usuario
  LEFT JOIN usuarios uc ON uc.id_usuario = h.creado_por
`;

const ejecutar = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

const listar = async (filtros = {}, client = null) => {
  const conditions = ["h.anio_lectivo = $1"];
  const params = [filtros.anio];
  let idx = 2;

  if (filtros.id_grado) {
    conditions.push(`h.id_grado = $${idx++}`);
    params.push(filtros.id_grado);
  }
  if (filtros.id_personal) {
    conditions.push(`h.id_personal = $${idx++}`);
    params.push(filtros.id_personal);
  }
  if (filtros.estado) {
    conditions.push(`h.estado = $${idx++}`);
    params.push(filtros.estado);
  }

  const result = await ejecutar(
    client,
    `${SELECT_BASE}
     WHERE ${conditions.join(" AND ")}
     ORDER BY
       g.id_grado,
       CASE h.dia_semana
         WHEN 'Lunes' THEN 1
         WHEN 'Martes' THEN 2
         WHEN 'Miércoles' THEN 3
         WHEN 'Jueves' THEN 4
         WHEN 'Viernes' THEN 5
       END,
       p.orden,
       h.id_horario`,
    params,
  );
  return result.rows;
};

const findById = async (id, client = null) => {
  const result = await ejecutar(
    client,
    `${SELECT_BASE} WHERE h.id_horario = $1`,
    [id],
  );
  return result.rows[0] || null;
};

const getCarga = async (idCarga, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT
       cc.id_carga,
       cc.id_grado,
       cc.id_curso,
       cc.id_personal,
       cc.anio_lectivo,
       cc.horas_asignadas,
       cc.activo,
       g.nombre_grado,
       g.seccion,
       g.nivel,
       g.anio_lectivo AS grado_anio,
       c.nombre_curso,
       c.area_academica,
       u.nombres || ' ' || u.apellidos AS docente_nombre
     FROM carga_curricular cc
     INNER JOIN grados g ON g.id_grado = cc.id_grado
     INNER JOIN cursos c ON c.id_curso = cc.id_curso
     INNER JOIN personal per ON per.id_personal = cc.id_personal
     INNER JOIN usuarios u ON u.id_usuario = per.id_usuario
     WHERE cc.id_carga = $1`,
    [idCarga],
  );
  return result.rows[0] || null;
};

const getPeriodo = async (idPeriodo, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT id_periodo, anio_lectivo, nombre, orden, hora_inicio, hora_fin, tipo, activo
     FROM periodos_clase
     WHERE id_periodo = $1`,
    [idPeriodo],
  );
  return result.rows[0] || null;
};

const getAlumnoGrado = async (
  idUsuario,
  anioLectivo = getAnioLectivo(),
  client = null,
) => {
  const result = await ejecutar(
    client,
    `SELECT
       a.id_alumno,
       a.id_grado,
       a.anio_lectivo,
       g.nombre_grado,
       g.seccion,
       g.nivel
     FROM alumnos a
     INNER JOIN grados g ON g.id_grado = a.id_grado
     WHERE a.id_usuario = $1
       AND a.anio_lectivo = $2
     LIMIT 1`,
    [idUsuario, anioLectivo],
  );
  return result.rows[0] || null;
};

const contarPorCarga = async (idCarga, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE estado = 'PUBLICADO')::int AS publicados,
       COUNT(*) FILTER (WHERE estado = 'BORRADOR')::int AS borradores
     FROM horarios
     WHERE id_carga = $1`,
    [idCarga],
  );
  return result.rows[0] || { total: 0, publicados: 0, borradores: 0 };
};

const contarPorAlcance = async (anio, idGrado = null, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE estado = 'PUBLICADO')::int AS publicados,
       COUNT(*) FILTER (WHERE estado = 'BORRADOR')::int AS borradores
     FROM horarios
     WHERE anio_lectivo = $1
       AND ($2::int IS NULL OR id_grado = $2)`,
    [anio, idGrado],
  );
  return result.rows[0] || { total: 0, publicados: 0, borradores: 0 };
};

const findConflictoGrado = async (
  client,
  { anio, idGrado, diaSemana, idPeriodo, excluirId = null },
) => {
  const result = await ejecutar(
    client,
    `SELECT
       h.id_horario,
       g.nombre_grado,
       g.seccion,
       p.nombre AS periodo_nombre
     FROM horarios h
     INNER JOIN grados g ON g.id_grado = h.id_grado
     INNER JOIN periodos_clase p ON p.id_periodo = h.id_periodo
     WHERE h.anio_lectivo = $1
       AND h.id_grado = $2
       AND h.dia_semana = $3
       AND h.id_periodo = $4
       AND ($5::int IS NULL OR h.id_horario <> $5)
     LIMIT 1`,
    [anio, idGrado, diaSemana, idPeriodo, excluirId],
  );
  return result.rows[0] || null;
};

const findConflictoDocente = async (
  client,
  { anio, idPersonal, diaSemana, idPeriodo, excluirId = null },
) => {
  const result = await ejecutar(
    client,
    `SELECT
       h.id_horario,
       g.nombre_grado,
       g.seccion,
       p.nombre AS periodo_nombre,
       u.nombres || ' ' || u.apellidos AS docente_nombre
     FROM horarios h
     INNER JOIN grados g ON g.id_grado = h.id_grado
     INNER JOIN periodos_clase p ON p.id_periodo = h.id_periodo
     INNER JOIN personal per ON per.id_personal = h.id_personal
     INNER JOIN usuarios u ON u.id_usuario = per.id_usuario
     WHERE h.anio_lectivo = $1
       AND h.id_personal = $2
       AND h.dia_semana = $3
       AND h.id_periodo = $4
       AND ($5::int IS NULL OR h.id_horario <> $5)
     LIMIT 1`,
    [anio, idPersonal, diaSemana, idPeriodo, excluirId],
  );
  return result.rows[0] || null;
};

const findConflictoAula = async (
  client,
  { anio, aula, diaSemana, idPeriodo, excluirId = null },
) => {
  const result = await ejecutar(
    client,
    `SELECT
       h.id_horario,
       h.aula,
       g.nombre_grado,
       g.seccion,
       p.nombre AS periodo_nombre
     FROM horarios h
     INNER JOIN grados g ON g.id_grado = h.id_grado
     INNER JOIN periodos_clase p ON p.id_periodo = h.id_periodo
     WHERE h.anio_lectivo = $1
       AND h.aula IS NOT NULL
       AND lower(btrim(h.aula)) = lower(btrim($2))
       AND h.dia_semana = $3
       AND h.id_periodo = $4
       AND ($5::int IS NULL OR h.id_horario <> $5)
     LIMIT 1`,
    [anio, aula, diaSemana, idPeriodo, excluirId],
  );
  return result.rows[0] || null;
};

const contarCursoDia = async (
  client,
  { anio, idGrado, idCurso, diaSemana, excluirId = null },
) => {
  const result = await ejecutar(
    client,
    `SELECT COUNT(*)::int AS total
     FROM horarios
     WHERE anio_lectivo = $1
       AND id_grado = $2
       AND id_curso = $3
       AND dia_semana = $4
       AND ($5::int IS NULL OR id_horario <> $5)`,
    [anio, idGrado, idCurso, diaSemana, excluirId],
  );
  return result.rows[0]?.total || 0;
};

const insertar = async (client, data) => {
  const result = await client.query(
    `INSERT INTO horarios (
       id_carga, id_grado, id_curso, id_personal, anio_lectivo,
       dia_semana, id_periodo, aula, estado, creado_por, actualizado_por
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'BORRADOR', $9, $9)
     RETURNING id_horario`,
    [
      data.id_carga,
      data.id_grado,
      data.id_curso,
      data.id_personal,
      data.anio_lectivo,
      data.dia_semana,
      data.id_periodo,
      data.aula,
      data.id_usuario,
    ],
  );
  return result.rows[0];
};

const actualizar = async (client, id, data) => {
  const result = await client.query(
    `UPDATE horarios SET
       id_carga = $1,
       id_grado = $2,
       id_curso = $3,
       id_personal = $4,
       anio_lectivo = $5,
       dia_semana = $6,
       id_periodo = $7,
       aula = $8,
       actualizado_por = $9,
       actualizado_en = now()
     WHERE id_horario = $10
     RETURNING id_horario`,
    [
      data.id_carga,
      data.id_grado,
      data.id_curso,
      data.id_personal,
      data.anio_lectivo,
      data.dia_semana,
      data.id_periodo,
      data.aula,
      data.id_usuario,
      id,
    ],
  );
  return result.rows[0] || null;
};

const eliminar = async (client, id) => {
  const result = await client.query(
    `DELETE FROM horarios WHERE id_horario = $1 RETURNING id_horario`,
    [id],
  );
  return result.rows[0] || null;
};

const cambiarEstadoAlcance = async (
  client,
  { anio, idGrado = null, estado, idUsuario },
) => {
  const result = await client.query(
    `WITH actualizados AS (
       UPDATE horarios SET
         estado = $3,
         actualizado_por = $4,
         actualizado_en = now()
       WHERE anio_lectivo = $1
         AND ($2::int IS NULL OR id_grado = $2)
       RETURNING 1
     )
     SELECT COUNT(*)::int AS total FROM actualizados`,
    [anio, idGrado, estado, idUsuario],
  );
  return result.rows[0]?.total || 0;
};

const faltantesPublicacion = async (
  client,
  { anio, idGrado = null, horasDefault },
) => {
  const result = await client.query(
    `SELECT
       cc.id_carga,
       cc.id_grado,
       g.nombre_grado,
       g.seccion,
       cc.id_curso,
       c.nombre_curso,
       cc.id_personal,
       u.nombres || ' ' || u.apellidos AS docente_nombre,
       COALESCE(cc.horas_asignadas, $3)::int AS requeridas,
       COUNT(h.id_horario)::int AS programadas,
       (COALESCE(cc.horas_asignadas, $3) - COUNT(h.id_horario))::int AS faltan
     FROM carga_curricular cc
     INNER JOIN grados g ON g.id_grado = cc.id_grado
     INNER JOIN cursos c ON c.id_curso = cc.id_curso
     INNER JOIN personal per ON per.id_personal = cc.id_personal
     INNER JOIN usuarios u ON u.id_usuario = per.id_usuario
     LEFT JOIN horarios h ON h.id_carga = cc.id_carga
     WHERE cc.anio_lectivo = $1
       AND cc.activo = TRUE
        AND ($2::int IS NULL OR cc.id_grado = $2)
     GROUP BY
       cc.id_carga, cc.id_grado, g.id_grado, g.nombre_grado, g.seccion,
       cc.id_curso, c.nombre_curso, cc.id_personal,
       u.nombres, u.apellidos, cc.horas_asignadas
     HAVING COUNT(h.id_horario) <> COALESCE(cc.horas_asignadas, $3)
     ORDER BY g.id_grado, c.nombre_curso`,
    [anio, idGrado, horasDefault],
  );
  return result.rows;
};

const findConflictoReasignacion = async (client, idCarga, idPersonal) => {
  const result = await client.query(
    `SELECT
       h.id_horario,
       h.dia_semana,
       p.nombre AS periodo_nombre,
       g.nombre_grado,
       g.seccion,
       u.nombres || ' ' || u.apellidos AS docente_nombre
     FROM horarios h
     INNER JOIN horarios x
       ON x.anio_lectivo = h.anio_lectivo
      AND x.dia_semana = h.dia_semana
      AND x.id_periodo = h.id_periodo
      AND x.id_personal = $2
      AND x.id_carga <> h.id_carga
     INNER JOIN periodos_clase p ON p.id_periodo = h.id_periodo
     INNER JOIN grados g ON g.id_grado = h.id_grado
     INNER JOIN personal per ON per.id_personal = $2
     INNER JOIN usuarios u ON u.id_usuario = per.id_usuario
     WHERE h.id_carga = $1
     ORDER BY h.dia_semana, p.orden
     LIMIT 1`,
    [idCarga, idPersonal],
  );
  return result.rows[0] || null;
};

const actualizarDocentePorCarga = async (
  client,
  { idCarga, idPersonal, idUsuario },
) => {
  const result = await client.query(
    `UPDATE horarios SET
       id_personal = $2,
       actualizado_por = $3,
       actualizado_en = now()
     WHERE id_carga = $1
     RETURNING id_horario`,
    [idCarga, idPersonal, idUsuario],
  );
  return result.rowCount;
};

const eliminarPorCarga = async (client, idCarga) => {
  const result = await client.query(
    `DELETE FROM horarios WHERE id_carga = $1 RETURNING id_horario`,
    [idCarga],
  );
  return result.rowCount;
};

const listarCargasGeneracion = async (
  client,
  { anio, idGrado = null, horasDefault },
) => {
  const result = await client.query(
    `SELECT
       cc.id_carga,
       cc.anio_lectivo,
       cc.id_grado,
       g.nombre_grado,
       g.seccion,
       cc.id_curso,
       c.nombre_curso,
       cc.id_personal,
       u.nombres || ' ' || u.apellidos AS docente_nombre,
       COALESCE(cc.horas_asignadas, $3)::int AS horas
     FROM carga_curricular cc
     INNER JOIN grados g ON g.id_grado = cc.id_grado
     INNER JOIN cursos c ON c.id_curso = cc.id_curso
     INNER JOIN personal per ON per.id_personal = cc.id_personal
     INNER JOIN usuarios u ON u.id_usuario = per.id_usuario
     WHERE cc.anio_lectivo = $1
       AND cc.activo = TRUE
        AND ($2::int IS NULL OR cc.id_grado = $2)
     ORDER BY cc.id_personal, cc.id_grado, c.nombre_curso`,
    [anio, idGrado, horasDefault],
  );
  return result.rows;
};

const listarPeriodosActivos = async (client, anio) => {
  const result = await client.query(
    `SELECT id_periodo, anio_lectivo, nombre, orden, hora_inicio, hora_fin, tipo, activo
     FROM periodos_clase
     WHERE anio_lectivo = $1
       AND tipo = 'CLASE'
       AND activo = true
     ORDER BY orden`,
    [anio],
  );
  return result.rows;
};

const listarBloquesExternos = async (client, { anio, idsGrados }) => {
  const result = await client.query(
    `SELECT id_personal, dia_semana, id_periodo
     FROM horarios
     WHERE anio_lectivo = $1
       AND NOT (id_grado = ANY($2::int[]))`,
    [anio, idsGrados],
  );
  return result.rows;
};

const contarPublicadosPorGrados = async (client, { anio, idsGrados }) => {
  const result = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM horarios
     WHERE anio_lectivo = $1
       AND id_grado = ANY($2::int[])
       AND estado = 'PUBLICADO'`,
    [anio, idsGrados],
  );
  return result.rows[0]?.total || 0;
};

const eliminarBorradoresPorGrados = async (client, { anio, idsGrados }) => {
  const result = await client.query(
    `DELETE FROM horarios
     WHERE anio_lectivo = $1
       AND id_grado = ANY($2::int[])
       AND estado = 'BORRADOR'
     RETURNING id_horario`,
    [anio, idsGrados],
  );
  return result.rowCount;
};

const insertarLote = async (client, { bloques, idUsuario }) => {
  if (!bloques || bloques.length === 0) return 0;

  const arrays = {
    id_carga: [],
    id_grado: [],
    id_curso: [],
    id_personal: [],
    anio_lectivo: [],
    dia_semana: [],
    id_periodo: [],
    aula: [],
  };

  for (const bloque of bloques) {
    arrays.id_carga.push(bloque.id_carga);
    arrays.id_grado.push(bloque.id_grado);
    arrays.id_curso.push(bloque.id_curso);
    arrays.id_personal.push(bloque.id_personal);
    arrays.anio_lectivo.push(bloque.anio_lectivo);
    arrays.dia_semana.push(bloque.dia_semana);
    arrays.id_periodo.push(bloque.id_periodo);
    arrays.aula.push(bloque.aula ?? null);
  }

  const result = await client.query(
    `INSERT INTO horarios (
       id_carga, id_grado, id_curso, id_personal, anio_lectivo,
       dia_semana, id_periodo, aula, estado, creado_por, actualizado_por
     )
     SELECT
       t.id_carga, t.id_grado, t.id_curso, t.id_personal, t.anio_lectivo,
       t.dia_semana, t.id_periodo, t.aula, 'BORRADOR', $9, $9
     FROM unnest(
       $1::int[], $2::int[], $3::int[], $4::int[],
       $5::int[], $6::text[], $7::int[], $8::text[]
     ) AS t(
       id_carga, id_grado, id_curso, id_personal,
       anio_lectivo, dia_semana, id_periodo, aula
     )`,
    [
      arrays.id_carga,
      arrays.id_grado,
      arrays.id_curso,
      arrays.id_personal,
      arrays.anio_lectivo,
      arrays.dia_semana,
      arrays.id_periodo,
      arrays.aula,
      idUsuario || null,
    ],
  );
  return result.rowCount;
};

module.exports = {
  listar,
  findById,
  getCarga,
  getPeriodo,
  getAlumnoGrado,
  contarPorCarga,
  contarPorAlcance,
  findConflictoGrado,
  findConflictoDocente,
  findConflictoAula,
  contarCursoDia,
  insertar,
  actualizar,
  eliminar,
  cambiarEstadoAlcance,
  faltantesPublicacion,
  findConflictoReasignacion,
  actualizarDocentePorCarga,
  eliminarPorCarga,
  listarCargasGeneracion,
  listarPeriodosActivos,
  listarBloquesExternos,
  contarPublicadosPorGrados,
  eliminarBorradoresPorGrados,
  insertarLote,
};
