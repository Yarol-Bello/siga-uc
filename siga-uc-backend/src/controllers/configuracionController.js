/**
 * Controlador de Configuración del Sistema
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const configuracionService = require("../services/configuracionService");
const response = require("../utils/response");

/**
 * GET /api/configuracion
 * Obtener la configuración pública del sistema (año lectivo activo)
 */
const obtener = async (req, res) => {
  try {
    const data = configuracionService.obtenerConfiguracion();
    return response.success(res, 200, "Configuración obtenida", data);
  } catch (error) {
    console.error("❌ Error al obtener configuración:", error);
    return response.error(res, 500, "Error interno del servidor");
  }
};

module.exports = {
  obtener,
};
