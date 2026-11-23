/**
 * Controlador de Configuración del Sistema (Fase 1 / H74)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const configuracionService = require("../services/configuracionService");
const response = require("../utils/response");

/**
 * Responde errores de negocio. Los 5xx no exponen SQL; el 503 de H74
 * conserva el mensaje operativo y su código seguro.
 */
const responderError = (res, error) => {
  const status = error?.statusCode || 500;

  if (status >= 500) {
    console.error("❌ Error en configuración:", error?.message || error);
    const message =
      status === 503
        ? error.message
        : "Ocurrió un error interno en el servidor";
    return res.status(status).json({
      success: false,
      message,
      errors: error?.details || null,
      timestamp: new Date().toISOString(),
    });
  }

  return response.error(
    res,
    status,
    error.message || "Error en la operación",
    error.details || null,
  );
};

/**
 * GET /api/configuracion
 * Configuración pública segura: año activo e institución visible.
 */
const obtenerPublica = async (req, res) => {
  try {
    const data = await configuracionService.obtenerConfiguracionPublica();
    return response.success(res, 200, "Configuración obtenida", data);
  } catch (error) {
    return responderError(res, error);
  }
};

/**
 * GET /api/configuracion/admin
 * Configuración completa para ADMIN/SECRETARÍA.
 */
const obtenerAdmin = async (req, res) => {
  try {
    const data = await configuracionService.obtenerConfiguracionAdmin();
    return response.success(res, 200, "Configuración administrativa obtenida", data);
  } catch (error) {
    return responderError(res, error);
  }
};

/**
 * PUT /api/configuracion/institucional
 * Actualiza la configuración global. Solo ADMIN. Exige motivo.
 */
const actualizarInstitucional = async (req, res) => {
  try {
    const data = await configuracionService.actualizarInstitucion(
      req.body || {},
      req.usuario,
      req.ip,
    );
    const mensaje = data.sin_cambios
      ? "No hubo cambios en la configuración"
      : "Configuración actualizada";
    return response.success(res, 200, mensaje, data);
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = {
  obtenerPublica,
  obtenerAdmin,
  actualizarInstitucional,
};
