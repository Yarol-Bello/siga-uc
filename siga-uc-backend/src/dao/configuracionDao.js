/**
 * DAO de Configuración del Sistema (Fase 1 / H74)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { query } = require("../config/database");

const CAMPOS_INSTITUCION = `
  id_configuracion,
  nombre_institucion,
  nombre_corto,
  ruc,
  direccion,
  distrito,
  provincia,
  departamento,
  pais,
  telefono,
  correo_contacto,
  sitio_web,
  logo_url,
  moneda,
  simbolo_moneda,
  zona_horaria,
  locale,
  nombre_remitente,
  texto_boleta,
  texto_libreta,
  texto_acta,
  texto_pie,
  serie_boleta,
  numero_boleta_inicial,
  actualizado_por,
  actualizado_en
`;

const CAMPOS_ANIO = `
  c.anio,
  a.estado,
  a.fecha_inicio,
  a.fecha_fin,
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
  c.actualizado_en
`;

/**
 * Comprueba si H74 está aplicada.
 * @returns {Promise<boolean>}
 */
const existeConfiguracionBase = async () => {
  const result = await query(
    `SELECT
       to_regclass('public.configuracion_institucional') AS institucional,
       to_regclass('public.configuracion_anio') AS anio`,
  );
  return Boolean(result.rows[0]?.institucional && result.rows[0]?.anio);
};

/**
 * Configuración institucional completa.
 * @returns {Promise<object|null>}
 */
const obtenerInstitucion = async () => {
  const result = await query(
    `SELECT ${CAMPOS_INSTITUCION}
     FROM public.configuracion_institucional
     WHERE id_configuracion = 1
     LIMIT 1`,
  );
  return result.rows[0] || null;
};

/**
 * Configuración de todos los años lectivos.
 * @returns {Promise<Array>}
 */
const listarAnios = async () => {
  const result = await query(
    `SELECT ${CAMPOS_ANIO}
     FROM public.configuracion_anio c
     INNER JOIN public.anios_lectivos a ON a.anio = c.anio
     ORDER BY c.anio DESC`,
  );
  return result.rows;
};

/**
 * Bloquea la fila institucional para actualizarla dentro de una transacción.
 * @param {object} client
 * @returns {Promise<object|null>}
 */
const obtenerInstitucionParaActualizar = async (client) => {
  const result = await client.query(
    `SELECT ${CAMPOS_INSTITUCION}
     FROM public.configuracion_institucional
     WHERE id_configuracion = 1
     FOR UPDATE`,
  );
  return result.rows[0] || null;
};

/**
 * Actualiza la fila institucional.
 * @param {object} data Campos ya normalizados.
 * @param {object} client
 * @param {number|null} idUsuario
 * @returns {Promise<object>}
 */
const actualizarInstitucion = async (data, client, idUsuario = null) => {
  const result = await client.query(
    `UPDATE public.configuracion_institucional SET
       nombre_institucion = $1,
       nombre_corto = $2,
       ruc = $3,
       direccion = $4,
       distrito = $5,
       provincia = $6,
       departamento = $7,
       pais = $8,
       telefono = $9,
       correo_contacto = $10,
       sitio_web = $11,
       logo_url = $12,
       moneda = $13,
       simbolo_moneda = $14,
       zona_horaria = $15,
       locale = $16,
       nombre_remitente = $17,
       texto_boleta = $18,
       texto_libreta = $19,
       texto_acta = $20,
       texto_pie = $21,
       serie_boleta = $22,
       numero_boleta_inicial = $23,
       actualizado_por = $24,
       actualizado_en = now()
     WHERE id_configuracion = 1
     RETURNING ${CAMPOS_INSTITUCION}`,
    [
      data.nombre_institucion,
      data.nombre_corto,
      data.ruc,
      data.direccion,
      data.distrito,
      data.provincia,
      data.departamento,
      data.pais,
      data.telefono,
      data.correo_contacto,
      data.sitio_web,
      data.logo_url,
      data.moneda,
      data.simbolo_moneda,
      data.zona_horaria,
      data.locale,
      data.nombre_remitente,
      data.texto_boleta,
      data.texto_libreta,
      data.texto_acta,
      data.texto_pie,
      data.serie_boleta,
      data.numero_boleta_inicial,
      idUsuario,
    ],
  );
  return result.rows[0] || null;
};

module.exports = {
  existeConfiguracionBase,
  obtenerInstitucion,
  listarAnios,
  obtenerInstitucionParaActualizar,
  actualizarInstitucion,
};
