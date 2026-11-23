/**
 * Controlador de primera configuración (H79 / Fase 7)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const setupService = require("../services/setupService");
const response = require("../utils/response");

const responderError = (res, error) => {
  const status = error?.statusCode || 500;
  if (status >= 500) {
    console.error("❌ Error en configuración inicial:", error?.message || error);
    return response.error(
      res,
      status,
      status === 503
        ? error.message
        : "Ocurrió un error interno en el servidor",
      error.details || null,
    );
  }
  return response.error(
    res,
    status,
    error.message || "Error en la configuración inicial",
    error.details || null,
  );
};

const estado = async (req, res) => {
  try {
    const data = await setupService.estadoPublico();
    return response.success(res, 200, "Estado de configuración inicial", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const inicializar = async (req, res) => {
  try {
    const data = await setupService.inicializar(req.body || {}, req.ip);
    return response.success(
      res,
      201,
      "Configuración inicial completada",
      data,
    );
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = {
  estado,
  inicializar,
};
