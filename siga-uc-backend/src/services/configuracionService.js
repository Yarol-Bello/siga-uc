/**
 * Servicio de Configuración del Sistema
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { getAnioLectivo } = require("../config/academico");

/**
 * Configuración pública que consume el frontend.
 * @returns {{ anio_lectivo: number }}
 */
const obtenerConfiguracion = () => ({
  anio_lectivo: getAnioLectivo(),
});

module.exports = {
  obtenerConfiguracion,
};
