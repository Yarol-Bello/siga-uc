/**
 * Configuración del módulo de horarios (H47)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const DIAS_SEMANA = Object.freeze([
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
]);

const TIPOS_PERIODO = Object.freeze(["CLASE", "RECREO", "ALMUERZO"]);
const ESTADOS_HORARIO = Object.freeze(["BORRADOR", "PUBLICADO"]);

const parseEnteroPositivo = (valor, defecto) => {
  const numero = Number.parseInt(valor, 10);
  return Number.isInteger(numero) && numero > 0 ? numero : defecto;
};

const HORAS_DEFAULT_CARGA = parseEnteroPositivo(
  process.env.HORAS_DEFAULT_CARGA,
  2,
);

const MAX_BLOQUES_CURSO_DIA = parseEnteroPositivo(
  process.env.MAX_BLOQUES_CURSO_DIA,
  2,
);

module.exports = {
  DIAS_SEMANA,
  TIPOS_PERIODO,
  ESTADOS_HORARIO,
  HORAS_DEFAULT_CARGA,
  MAX_BLOQUES_CURSO_DIA,
};
