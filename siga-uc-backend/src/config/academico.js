/**
 * Configuración académica centralizada
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const env = require("./env");

/**
 * Año lectivo activo del sistema.
 * Se configura con ANIO_LECTIVO en el .env; el frontend lo recibe por API.
 * @returns {number}
 */
const getAnioLectivo = () => env.ANIO_LECTIVO;

module.exports = {
  getAnioLectivo,
};
