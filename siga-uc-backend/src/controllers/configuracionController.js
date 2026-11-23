/**
 * Controlador de Configuración del Sistema (Fase 1 / H74)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const configuracionService = require("../services/configuracionService");
const conceptoPagoService = require("../services/conceptoPagoService");
const academicoService = require("../services/academicoService");
const configuracionAnioService = require("../services/configuracionAnioService");
const becaService = require("../services/becaService");
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

const listarTarifas = async (req, res) => {
  try {
    const data = await conceptoPagoService.listar(req.query || {});
    return response.success(res, 200, `${data.length} tarifas encontradas`, data);
  } catch (error) {
    return responderError(res, error);
  }
};

const obtenerTarifa = async (req, res) => {
  try {
    const data = await conceptoPagoService.obtener(req.params.id);
    return response.success(res, 200, "Tarifa obtenida", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const previewTarifa = async (req, res) => {
  try {
    const modo = ["crear", "editar", "version"].includes(req.body?.modo)
      ? req.body.modo
      : req.body?.id_concepto
        ? "editar"
        : "crear";
    const data = await conceptoPagoService.preview(req.body || {}, {
      id: req.body?.id_concepto || null,
      modo,
    });
    return response.success(res, 200, "Vista previa de tarifa", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const crearTarifa = async (req, res) => {
  try {
    const data = await conceptoPagoService.crear(
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 201, "Tarifa creada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const actualizarTarifa = async (req, res) => {
  try {
    const data = await conceptoPagoService.actualizar(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Tarifa actualizada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const programarVersionTarifa = async (req, res) => {
  try {
    const data = await conceptoPagoService.programarVersion(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 201, "Nueva versión de tarifa programada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const desactivarTarifa = async (req, res) => {
  try {
    const data = await conceptoPagoService.desactivar(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Tarifa desactivada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const listarAreas = async (req, res) => {
  try {
    const data = await academicoService.listarAreas(
      req.query.incluir_inactivas === "1" ||
        req.query.incluir_inactivas === "true",
    );
    return response.success(res, 200, "Áreas académicas", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const crearArea = async (req, res) => {
  try {
    const data = await academicoService.crearArea(
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 201, "Área académica creada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const actualizarArea = async (req, res) => {
  try {
    const data = await academicoService.actualizarArea(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Área académica actualizada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const eliminarArea = async (req, res) => {
  try {
    const data = await academicoService.eliminarArea(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Área académica eliminada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const listarCursosAdmin = async (req, res) => {
  try {
    const data = await academicoService.listarCursosAdmin(
      req.query.incluir_inactivos !== "0",
    );
    return response.success(res, 200, "Cursos", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const crearCurso = async (req, res) => {
  try {
    const data = await academicoService.crearCurso(
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 201, "Curso creado", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const actualizarCurso = async (req, res) => {
  try {
    const data = await academicoService.actualizarCurso(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Curso actualizado", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const eliminarCurso = async (req, res) => {
  try {
    const data = await academicoService.eliminarCurso(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Curso eliminado", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const listarCompetenciasAdmin = async (req, res) => {
  try {
    const data = await academicoService.listarCompetenciasAdmin(
      req.params.idCurso,
      req.query.incluir_inactivas !== "0",
    );
    return response.success(res, 200, "Competencias", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const crearCompetencia = async (req, res) => {
  try {
    const data = await academicoService.crearCompetencia(
      req.params.idCurso,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 201, "Competencia creada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const actualizarCompetencia = async (req, res) => {
  try {
    const data = await academicoService.actualizarCompetencia(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Competencia actualizada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const eliminarCompetencia = async (req, res) => {
  try {
    const data = await academicoService.eliminarCompetencia(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Competencia eliminada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const obtenerHorarioAnio = async (req, res) => {
  try {
    const data = await configuracionAnioService.obtener(req.params.anio);
    return response.success(res, 200, "Configuración de jornada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const actualizarHorarioAnio = async (req, res) => {
  try {
    const data = await configuracionAnioService.actualizar(
      req.params.anio,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Jornada actualizada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const listarTiposBeca = async (req, res) => {
  try {
    const data = await becaService.listarTipos(
      req.query.incluir_inactivos === "1" ||
        req.query.incluir_inactivos === "true",
    );
    return response.success(res, 200, "Tipos de beca", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const crearTipoBeca = async (req, res) => {
  try {
    const data = await becaService.crearTipo(
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 201, "Tipo de beca creado", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const actualizarTipoBeca = async (req, res) => {
  try {
    const data = await becaService.actualizarTipo(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Tipo de beca actualizado", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const listarBecas = async (req, res) => {
  try {
    const data = await becaService.listarBecas(req.query || {});
    return response.success(res, 200, `${data.length} becas encontradas`, data);
  } catch (error) {
    return responderError(res, error);
  }
};

const previewBeca = async (req, res) => {
  try {
    const data = await becaService.previewBeca(req.body || {});
    return response.success(res, 200, "Vista previa de beca", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const crearBeca = async (req, res) => {
  try {
    const data = await becaService.crearBeca(
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 201, "Beca registrada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const actualizarBeca = async (req, res) => {
  try {
    const data = await becaService.actualizarBeca(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Beca actualizada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const aprobarBeca = async (req, res) => {
  try {
    const data = await becaService.aprobarBeca(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Beca aprobada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const rechazarBeca = async (req, res) => {
  try {
    const data = await becaService.rechazarBeca(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Beca rechazada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

const anularBeca = async (req, res) => {
  try {
    const data = await becaService.anularBeca(
      req.params.id,
      req.body || {},
      req.usuario,
      req.ip,
    );
    return response.success(res, 200, "Beca anulada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = {
  obtenerPublica,
  obtenerAdmin,
  actualizarInstitucional,
  obtenerHorarioAnio,
  actualizarHorarioAnio,
  listarTarifas,
  obtenerTarifa,
  previewTarifa,
  crearTarifa,
  actualizarTarifa,
  programarVersionTarifa,
  desactivarTarifa,
  listarAreas,
  crearArea,
  actualizarArea,
  eliminarArea,
  listarCursosAdmin,
  crearCurso,
  actualizarCurso,
  eliminarCurso,
  listarCompetenciasAdmin,
  crearCompetencia,
  actualizarCompetencia,
  eliminarCompetencia,
  listarTiposBeca,
  crearTipoBeca,
  actualizarTipoBeca,
  listarBecas,
  previewBeca,
  crearBeca,
  actualizarBeca,
  aprobarBeca,
  rechazarBeca,
  anularBeca,
};
