/**
 * Controlador de años lectivos y rollover (H49 / Fase 6.2)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const anioLectivoService = require("../services/anioLectivoService");
const rolloverService = require("../services/rolloverService");
const auditoriaService = require("../services/auditoriaService");
const response = require("../utils/response");

const MODULO = "Años Lectivos";

/**
 * Responde errores de negocio. Los 5xx no exponen SQL; el 503 de H49
 * conserva un mensaje operativo seguro.
 */
const responderError = (res, error) => {
  const status = error?.statusCode || 500;

  if (status >= 500) {
    console.error("❌ Error en años lectivos:", error?.message || error);
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
 * GET /api/anios-lectivos
 * Catálogo de años con estado y conteos.
 */
const listar = async (req, res) => {
  try {
    const anios = await anioLectivoService.listar();
    return response.success(res, 200, "Años lectivos obtenidos", anios);
  } catch (error) {
    return responderError(res, error);
  }
};

/**
 * POST /api/anios-lectivos/preview
 * Previsualización de solo lectura.
 */
const preview = async (req, res) => {
  try {
    const data = await rolloverService.previsualizar(req.body || {});
    return response.success(
      res,
      200,
      "Previsualización de rollover generada",
      data,
    );
  } catch (error) {
    return responderError(res, error);
  }
};

/**
 * POST /api/anios-lectivos/rollover
 * Clonado transaccional e idempotente de la oferta.
 */
const rollover = async (req, res) => {
  try {
    const data = await rolloverService.confirmar(
      req.body || {},
      req.usuario?.id_usuario || null,
    );

    await auditoriaService.registrarSeguro(req, {
      modulo: MODULO,
      accion: "ROLLOVER",
      descripcion: `Rollover de oferta ${data.anio_origen} → ${data.anio_destino} (${data.creados} creados, ${data.existentes} existentes).`,
      nuevo: {
        anio_origen: data.anio_origen,
        anio_destino: data.anio_destino,
        incluir_otros: data.incluir_otros,
        creados: data.creados,
        existentes: data.existentes,
        conteos: data.conteos,
      },
    });

    return response.success(
      res,
      200,
      "Oferta del año lectivo clonada correctamente",
      data,
    );
  } catch (error) {
    return responderError(res, error);
  }
};

/**
 * PUT /api/anios-lectivos/:anio/activar
 * Activación auditada con un solo año ACTIVO.
 */
const activar = async (req, res) => {
  try {
    const data = await anioLectivoService.activar({
      anio: req.params.anio,
      confirmar: req.body?.confirmar,
      idUsuario: req.usuario?.id_usuario || null,
    });

    await auditoriaService.registrarSeguro(req, {
      modulo: MODULO,
      accion: "ACTIVAR",
      descripcion: `Año lectivo ${data.anio} activado${
        data.anterior ? `; ${data.anterior} pasó a CERRADO` : ""
      }.`,
      anterior: data.anterior
        ? { anio: data.anterior, estado: "ACTIVO" }
        : null,
      nuevo: {
        anio: data.anio,
        estado: "ACTIVO",
        anios_cerrados: data.anios_cerrados,
      },
    });

    return response.success(res, 200, "Año lectivo activado", data);
  } catch (error) {
    return responderError(res, error);
  }
};

/**
 * DELETE /api/anios-lectivos/:anio/rollover
 * Reversión de un rollover vacío.
 */
const revertirRollover = async (req, res) => {
  try {
    const data = await rolloverService.revertir({
      anio: req.params.anio,
      motivo: req.body?.motivo,
      confirmar: req.body?.confirmar,
      idUsuario: req.usuario?.id_usuario || null,
    });

    await auditoriaService.registrarSeguro(req, {
      modulo: MODULO,
      accion: "REVERTIR_ROLLOVER",
      descripcion: `Rollover del año ${data.anio} revertido: ${data.motivo}`,
      anterior: {
        anio: data.anio,
        anio_origen: data.anio_origen,
        incluir_otros: data.incluir_otros,
        conteos: data.conteos,
      },
      nuevo: {
        revertido: true,
        anio_eliminado: data.anio_eliminado,
        motivo: data.motivo,
      },
    });

    return response.success(
      res,
      200,
      "Rollover revertido correctamente",
      data,
    );
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = {
  listar,
  preview,
  rollover,
  activar,
  revertirRollover,
};
