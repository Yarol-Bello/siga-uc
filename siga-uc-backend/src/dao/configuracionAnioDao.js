/**
 * DAO de configuración por año (Fase 4 / H77)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query, getClient } = require("../config/database");

const CAMPOS = `
  c.anio,
  c.dias_clase,
  c.hora_inicio_jornada,
  c.hora_fin_jornada,
  c.duracion_min_bloque,
  c.max_bloques_curso_dia,
  c.horas_default_carga,
  c.politica_inicio_pension,
  c.mes_inicio_pension,
  c.version,
  c.actualizado_por,
  c.actualizado_en,
  a.estado
`;

const obtener = async (anio, client = null) => {
  const ejecutar = client ? client.query.bind(client) : query;
  const result = await ejecutar(
    `SELECT ${CAMPOS}
     FROM configuracion_anio c
     INNER JOIN anios_lectivos a ON a.anio = c.anio
     WHERE c.anio = $1
     LIMIT 1`,
    [anio],
  );
  return result.rows[0] || null;
};

const listar = async () => {
  const result = await query(
    `SELECT ${CAMPOS}
     FROM configuracion_anio c
     INNER JOIN anios_lectivos a ON a.anio = c.anio
     ORDER BY c.anio DESC`,
  );
  return result.rows;
};

const obtenerParaActualizar = async (anio, client) => {
  const result = await client.query(
    `SELECT ${CAMPOS}
     FROM configuracion_anio c
     INNER JOIN anios_lectivos a ON a.anio = c.anio
     WHERE c.anio = $1
     FOR UPDATE OF c`,
    [anio],
  );
  return result.rows[0] || null;
};

const actualizar = async (anio, data, idUsuario, client) => {
  const result = await client.query(
    `UPDATE configuracion_anio SET
       dias_clase = $2,
       hora_inicio_jornada = $3,
       hora_fin_jornada = $4,
       duracion_min_bloque = $5,
       max_bloques_curso_dia = $6,
       horas_default_carga = $7,
       version = version + 1,
       actualizado_por = $8,
       actualizado_en = now()
     WHERE anio = $1
     RETURNING *`,
    [
      anio,
      data.dias_clase,
      data.hora_inicio_jornada,
      data.hora_fin_jornada,
      data.duracion_min_bloque,
      data.max_bloques_curso_dia,
      data.horas_default_carga,
      idUsuario || null,
    ],
  );
  return result.rows[0] || null;
};

const contarHorariosPublicados = async (anio, client = null) => {
  const ejecutar = client ? client.query.bind(client) : query;
  const result = await ejecutar(
    `SELECT COUNT(*)::int AS total
     FROM horarios
     WHERE anio_lectivo = $1 AND estado = 'PUBLICADO'`,
    [anio],
  );
  return Number(result.rows[0]?.total || 0);
};

const contarHorariosPorDiaFuera = async (anio, dias, client = null) => {
  const ejecutar = client ? client.query.bind(client) : query;
  const result = await ejecutar(
    `SELECT dia_semana, COUNT(*)::int AS total
     FROM horarios
     WHERE anio_lectivo = $1
       AND NOT (dia_semana = ANY($2::varchar[]))
     GROUP BY dia_semana
     ORDER BY dia_semana`,
    [anio, dias],
  );
  return result.rows;
};

const maxBloquesCursoDia = async (anio, client = null) => {
  const ejecutar = client ? client.query.bind(client) : query;
  const result = await ejecutar(
    `SELECT COALESCE(MAX(total), 0)::int AS maximo
     FROM (
       SELECT id_grado, id_curso, dia_semana, COUNT(*)::int AS total
       FROM horarios
       WHERE anio_lectivo = $1
       GROUP BY id_grado, id_curso, dia_semana
     ) q`,
    [anio],
  );
  return Number(result.rows[0]?.maximo || 0);
};

const contarPeriodosFueraJornada = async (
  anio,
  horaInicio,
  horaFin,
  client = null,
) => {
  const ejecutar = client ? client.query.bind(client) : query;
  const result = await ejecutar(
    `SELECT COUNT(*)::int AS total
     FROM periodos_clase
     WHERE anio_lectivo = $1
       AND activo = TRUE
       AND (hora_inicio < $2::time OR hora_fin > $3::time)`,
    [anio, horaInicio, horaFin],
  );
  return Number(result.rows[0]?.total || 0);
};

module.exports = {
  obtener,
  listar,
  obtenerParaActualizar,
  actualizar,
  contarHorariosPublicados,
  contarHorariosPorDiaFuera,
  maxBloquesCursoDia,
  contarPeriodosFueraJornada,
};
