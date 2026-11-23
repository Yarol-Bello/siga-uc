/**
 * DAO de promociones anuales (H73 / Fase 6.3)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Lee y escribe promociones, matrículas destino, expedientes y
 * pre-tickets. No crea usuarios ni credenciales QR.
 */

const { query } = require("../config/database");

const ejecutar = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

const listarMatriculasOrigen = async (
  { anioOrigen, idGrado = null, incluirRetirados = false },
  client = null,
) => {
  const result = await ejecutar(
    client,
    `SELECT
       a.id_alumno,
       a.id_usuario,
       a.dni,
       a.nombres,
       a.apellidos,
       a.fecha_nacimiento,
       a.id_apoderado,
       a.id_grado,
       a.condicion,
       a.estado_matricula,
       a.codigo_estudiante,
       a.anio_lectivo,
       a.fecha_retiro,
       a.motivo_retiro,
       a.colegio_destino,
       g.nombre_grado,
       g.nivel,
       g.seccion,
       g.orden,
       u.estado AS usuario_estado
     FROM alumnos a
     INNER JOIN grados g ON g.id_grado = a.id_grado
     INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
     WHERE a.anio_lectivo = $1
       AND ($2::int IS NULL OR a.id_grado = $2)
       AND (
         $3::boolean
         OR (a.estado_matricula <> 'Retirado' AND a.condicion <> 'Traslado')
       )
     ORDER BY g.nivel, g.seccion, g.orden, a.apellidos, a.nombres`,
    [anioOrigen, idGrado, incluirRetirados],
  );
  return result.rows;
};

const contarRetiradosOmitidos = async (
  { anioOrigen, idGrado = null },
  client = null,
) => {
  const result = await ejecutar(
    client,
    `SELECT COUNT(*)::int AS total
     FROM alumnos a
     WHERE a.anio_lectivo = $1
       AND ($2::int IS NULL OR a.id_grado = $2)
       AND (a.estado_matricula = 'Retirado' OR a.condicion = 'Traslado')`,
    [anioOrigen, idGrado],
  );
  return result.rows[0]?.total || 0;
};

const listarGrados = async (anio, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT id_grado, nombre_grado, nivel, seccion, anio_lectivo, orden
     FROM grados
     WHERE anio_lectivo = $1
     ORDER BY nivel, seccion, orden, nombre_grado`,
    [anio],
  );
  return result.rows;
};

const listarCursosPorGrado = async (anio, idGrado = null, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT cc.id_grado, cc.id_curso, c.nombre_curso
     FROM carga_curricular cc
     INNER JOIN cursos c ON c.id_curso = cc.id_curso
     WHERE cc.anio_lectivo = $1
       AND ($2::int IS NULL OR cc.id_grado = $2)
     ORDER BY cc.id_grado, c.nombre_curso`,
    [anio, idGrado],
  );
  return result.rows;
};

const listarActas = async (anio, idsGrados = [], client = null) => {
  const result = await ejecutar(
    client,
    `SELECT bimestre, id_grado, estado
     FROM actas_bimestrales
     WHERE anio_lectivo = $1
       AND (id_grado IS NULL OR id_grado = ANY($2::int[]))`,
    [anio, idsGrados],
  );
  return result.rows;
};

const listarNotasFinales = async (
  { anio, bimestres = [], idsAlumnos = [] },
  client = null,
) => {
  if (idsAlumnos.length === 0 || bimestres.length === 0) return [];
  const result = await ejecutar(
    client,
    `SELECT id_alumno, id_curso, bimestre, nota_final
     FROM notas_finales_area
     WHERE anio_lectivo = $1
       AND bimestre = ANY($2::int[])
       AND id_alumno = ANY($3::int[])`,
    [anio, bimestres, idsAlumnos],
  );
  return result.rows;
};

const listarAsistencia = async ({ anio, idsAlumnos = [] }, client = null) => {
  if (idsAlumnos.length === 0) return [];
  const result = await ejecutar(
    client,
    `SELECT
       id_alumno,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE estado = 'P')::int AS presentes,
       COUNT(*) FILTER (WHERE estado = 'T')::int AS tardanzas,
       COUNT(*) FILTER (WHERE estado = 'F')::int AS faltas
     FROM asistencia_alumnos
     WHERE EXTRACT(YEAR FROM fecha)::int = $1
       AND id_alumno = ANY($2::int[])
     GROUP BY id_alumno`,
    [anio, idsAlumnos],
  );
  return result.rows;
};

const listarDeuda = async ({ anio, idsAlumnos = [] }, client = null) => {
  if (idsAlumnos.length === 0) return [];
  const result = await ejecutar(
    client,
    `SELECT
       a.id_alumno,
       COALESCE((
         SELECT SUM(pe.monto_final)
         FROM pensiones pe
         WHERE pe.id_alumno = a.id_alumno
           AND pe.anio_lectivo = $1
           AND pe.estado = 'PENDIENTE'
       ), 0) AS deuda_pensiones,
       COALESCE((
         SELECT SUM(pt.monto)
         FROM pre_tickets pt
         INNER JOIN conceptos_pago cp ON cp.id_concepto = pt.id_concepto
         WHERE pt.id_alumno = a.id_alumno
           AND cp.anio_lectivo = $1
           AND pt.estado = 'PENDIENTE'
       ), 0) AS deuda_pretickets
     FROM alumnos a
     WHERE a.id_alumno = ANY($2::int[])`,
    [anio, idsAlumnos],
  );
  return result.rows;
};

const listarBecas = async ({ anio, idsAlumnos = [] }, client = null) => {
  if (idsAlumnos.length === 0) return [];
  const result = await ejecutar(
    client,
    `SELECT
       b.id_beca,
       b.id_alumno,
       b.id_tipo_beca,
       b.tipo,
       b.porcentaje_descuento,
       b.monto_descuento,
       b.fecha_inicio,
       b.fecha_fin,
       b.activo,
       b.alcance,
       b.modalidad,
       b.valor,
       b.monto_maximo,
       b.estado,
       b.motivo,
       b.evidencia,
       b.grupo_exclusividad,
       b.prioridad,
       t.codigo AS tipo_codigo
     FROM becas b
     INNER JOIN tipos_beca t ON t.id_tipo_beca = b.id_tipo_beca
     INNER JOIN alumnos a ON a.id_alumno = b.id_alumno
     WHERE a.anio_lectivo = $1
       AND b.id_alumno = ANY($2::int[])
       AND b.activo = true
       AND (b.fecha_fin IS NULL OR b.fecha_fin >= CURRENT_DATE)
     ORDER BY b.id_beca`,
    [anio, idsAlumnos],
  );
  return result.rows;
};

const buscarPromocionesConfirmadas = async (
  { idsAlumnos = [] },
  client = null,
) => {
  if (idsAlumnos.length === 0) return [];
  const result = await ejecutar(
    client,
    `SELECT *
     FROM promociones
     WHERE estado = 'CONFIRMADA'
       AND id_alumno_origen = ANY($1::int[])
     ORDER BY id_promocion`,
    [idsAlumnos],
  );
  return result.rows;
};

const buscarMatriculasDestino = async (
  { anioDestino, idsUsuarios = [], dnis = [] },
  client = null,
) => {
  if (idsUsuarios.length === 0 && dnis.length === 0) return [];
  const result = await ejecutar(
    client,
    `SELECT id_alumno, id_usuario, dni, codigo_estudiante
     FROM alumnos
     WHERE anio_lectivo = $1
       AND (id_usuario = ANY($2::int[]) OR dni::text = ANY($3::text[]))`,
    [anioDestino, idsUsuarios, dnis],
  );
  return result.rows;
};

const buscarAnuladaParaReversion = async (
  { idAlumnoOrigen, anioDestino },
  client = null,
) => {
  const result = await ejecutar(
    client,
    `SELECT id_promocion
     FROM promociones
     WHERE id_alumno_origen = $1
       AND anio_destino = $2
       AND estado = 'ANULADA'
     ORDER BY id_promocion DESC
     LIMIT 1`,
    [idAlumnoOrigen, anioDestino],
  );
  return result.rows[0] || null;
};

const crearPromocion = async (data, client = null) => {
  const result = await ejecutar(
    client,
    `INSERT INTO promociones (
       id_alumno_origen, id_alumno_destino, anio_origen, anio_destino,
       id_grado_origen, id_grado_destino, estado, resultado,
       es_override, motivo, observacion, id_usuario,
       fecha_confirmacion, id_promocion_reversa, metadata
     ) VALUES (
       $1, $2, $3, $4, $5, $6, 'CONFIRMADA', $7,
       $8, $9, $10, $11, now(), $12, $13::jsonb
     )
     RETURNING *`,
    [
      data.id_alumno_origen,
      data.id_alumno_destino || null,
      data.anio_origen,
      data.anio_destino || null,
      data.id_grado_origen,
      data.id_grado_destino || null,
      data.resultado,
      Boolean(data.es_override),
      data.motivo || null,
      data.observacion || null,
      data.id_usuario || null,
      data.id_promocion_reversa || null,
      JSON.stringify(data.metadata || {}),
    ],
  );
  return result.rows[0];
};

const SELECT_PROMOCION = `
  SELECT
    p.*,
    ao.dni AS alumno_origen_dni,
    ao.nombres || ' ' || ao.apellidos AS alumno_origen_nombre,
    ad.dni AS alumno_destino_dni,
    ad.nombres || ' ' || ad.apellidos AS alumno_destino_nombre,
    go.nombre_grado AS grado_origen_nombre,
    go.seccion AS grado_origen_seccion,
    gd.nombre_grado AS grado_destino_nombre,
    gd.seccion AS grado_destino_seccion,
    u.nombres || ' ' || u.apellidos AS usuario_nombre
  FROM promociones p
  INNER JOIN alumnos ao ON ao.id_alumno = p.id_alumno_origen
  INNER JOIN grados go ON go.id_grado = p.id_grado_origen
  LEFT JOIN alumnos ad ON ad.id_alumno = p.id_alumno_destino
  LEFT JOIN grados gd ON gd.id_grado = p.id_grado_destino
  LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
`;

const findById = async (id, client = null) => {
  const result = await ejecutar(
    client,
    `${SELECT_PROMOCION} WHERE p.id_promocion = $1`,
    [id],
  );
  return result.rows[0] || null;
};

const findByIdForUpdate = async (id, client) => {
  const result = await client.query(
    `SELECT * FROM promociones WHERE id_promocion = $1 FOR UPDATE`,
    [id],
  );
  return result.rows[0] || null;
};

const listar = async (filtros = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filtros.anio_origen) {
    conditions.push(`p.anio_origen = $${idx++}`);
    params.push(filtros.anio_origen);
  }
  if (filtros.anio_destino) {
    conditions.push(`p.anio_destino = $${idx++}`);
    params.push(filtros.anio_destino);
  }
  if (filtros.estado) {
    conditions.push(`p.estado = $${idx++}`);
    params.push(filtros.estado);
  }
  if (filtros.resultado) {
    conditions.push(`p.resultado = $${idx++}`);
    params.push(filtros.resultado);
  }
  if (filtros.id_grado_origen) {
    conditions.push(`p.id_grado_origen = $${idx++}`);
    params.push(filtros.id_grado_origen);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `${SELECT_PROMOCION}
     ${where}
     ORDER BY p.anio_origen DESC, p.anio_destino DESC, p.id_promocion DESC`,
    params,
  );
  return result.rows;
};

const actualizarAnulada = async (id, data, client = null) => {
  const result = await ejecutar(
    client,
    `UPDATE promociones SET
       estado = 'ANULADA',
       id_alumno_destino = NULL,
       metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
     WHERE id_promocion = $1
     RETURNING *`,
    [id, JSON.stringify(data.metadata || {})],
  );
  return result.rows[0] || null;
};

const contarActividadDestino = async (idAlumnoDestino, client = null) => {
  const result = await ejecutar(
    client,
    `SELECT
       (SELECT COUNT(*)::int FROM pagos WHERE id_alumno = $1) AS pagos,
       (SELECT COUNT(*)::int FROM calificaciones WHERE id_alumno = $1) AS calificaciones,
       (SELECT COUNT(*)::int FROM notas_finales_area WHERE id_alumno = $1) AS notas,
       (SELECT COUNT(*)::int FROM asistencia_alumnos WHERE id_alumno = $1) AS asistencia,
       (SELECT COUNT(*)::int FROM pensiones WHERE id_alumno = $1) AS pensiones,
       (SELECT COUNT(*)::int FROM pre_tickets WHERE id_alumno = $1 AND estado = 'PAGADO') AS pretickets_pagados`,
    [idAlumnoDestino],
  );
  return result.rows[0] || {};
};

const eliminarDestino = async (
  { idAlumnoDestino, idsBecas = [] },
  client,
) => {
  const pretickets = await client.query(
    `DELETE FROM pre_tickets WHERE id_alumno = $1`,
    [idAlumnoDestino],
  );

  let becas = { rowCount: 0 };
  if (idsBecas.length > 0) {
    becas = await client.query(
      `DELETE FROM becas WHERE id_alumno = $1 AND id_beca = ANY($2::int[])`,
      [idAlumnoDestino, idsBecas],
    );
  }

  const expedientes = await client.query(
    `DELETE FROM expediente_alumno WHERE id_alumno = $1`,
    [idAlumnoDestino],
  );

  const alumnos = await client.query(
    `DELETE FROM alumnos WHERE id_alumno = $1`,
    [idAlumnoDestino],
  );

  return {
    pretickets: pretickets.rowCount,
    becas: becas.rowCount,
    expedientes: expedientes.rowCount,
    alumnos: alumnos.rowCount,
  };
};

const insertarAlumnoDestino = async (data, client) => {
  const result = await client.query(
    `INSERT INTO alumnos (
       id_usuario, dni, nombres, apellidos, fecha_nacimiento,
       id_apoderado, id_grado, condicion, colegio_procedencia,
       estado_matricula, codigo_estudiante, anio_lectivo
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      data.id_usuario,
      data.dni,
      data.nombres,
      data.apellidos,
      data.fecha_nacimiento,
      data.id_apoderado,
      data.id_grado,
      data.condicion || "Regular",
      data.colegio_procedencia || null,
      data.estado_matricula,
      data.codigo_estudiante,
      data.anio_lectivo,
    ],
  );
  return result.rows[0];
};

const insertarExpediente = async (idAlumno, client) => {
  const result = await client.query(
    `INSERT INTO expediente_alumno
       (id_alumno, nivel_logro_actual, asistencia_acumulada, congelado)
     VALUES ($1, NULL, 0, false)
     RETURNING *`,
    [idAlumno],
  );
  return result.rows[0];
};

const obtenerConceptoMatricula = async (
  anio,
  idGrado = null,
  client = null,
) => {
  const result = await ejecutar(
    client,
    `SELECT id_concepto, monto_base
     FROM resolver_concepto_pago($1, 'MATRICULA', NULL, $2, CURRENT_DATE)`,
    [anio, idGrado],
  );
  return result.rows[0] || null;
};

const insertarPreticket = async (data, client) => {
  const result = await client.query(
    `INSERT INTO pre_tickets
       (id_alumno, id_concepto, monto, estado, id_usuario_emite)
     VALUES ($1, $2, $3, 'PENDIENTE', $4)
     RETURNING *`,
    [data.id_alumno, data.id_concepto, data.monto, data.id_usuario_emite || null],
  );
  return result.rows[0];
};

const copiarBeca = async (data, client) => {
  const result = await client.query(
    `INSERT INTO becas (
       id_alumno, id_tipo_beca, tipo, porcentaje_descuento, monto_descuento,
       fecha_inicio, fecha_fin, activo, alcance, modalidad, valor,
       monto_maximo, estado, motivo, evidencia, fecha_aprobacion,
       grupo_exclusividad, prioridad
     ) VALUES (
       $1,
       COALESCE(
         $2::int,
         (SELECT id_tipo_beca FROM tipos_beca
          WHERE upper(codigo) = upper($3) LIMIT 1)
       ),
       $3, $4, $5, CURRENT_DATE, $6, true,
       COALESCE($7, 'PENSION'), COALESCE($8, 'PORCENTAJE'),
       COALESCE(
         NULLIF($9::numeric, 0),
         NULLIF($5::numeric, 0),
         NULLIF($4::numeric, 0),
         0
       ),
       $10, 'APROBADA', $11, $12::jsonb, NOW(), $13, $14
     )
     RETURNING *`,
    [
      data.id_alumno,
      data.id_tipo_beca,
      data.tipo,
      data.porcentaje_descuento,
      data.monto_descuento,
      data.fecha_fin || null,
      data.alcance,
      data.modalidad,
      data.valor,
      data.monto_maximo,
      data.motivo,
      data.evidencia ? JSON.stringify(data.evidencia) : null,
      data.grupo_exclusividad,
      data.prioridad,
    ],
  );
  return result.rows[0];
};

module.exports = {
  listarMatriculasOrigen,
  contarRetiradosOmitidos,
  listarGrados,
  listarCursosPorGrado,
  listarActas,
  listarNotasFinales,
  listarAsistencia,
  listarDeuda,
  listarBecas,
  buscarPromocionesConfirmadas,
  buscarMatriculasDestino,
  buscarAnuladaParaReversion,
  crearPromocion,
  findById,
  findByIdForUpdate,
  listar,
  actualizarAnulada,
  contarActividadDestino,
  eliminarDestino,
  insertarAlumnoDestino,
  insertarExpediente,
  obtenerConceptoMatricula,
  insertarPreticket,
  copiarBeca,
};
