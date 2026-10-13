/**
 * Controlador de Auditoría y Actas
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const auditoriaService = require("../services/auditoriaService");
const response = require("../utils/response");

const listarBitacora = async (req, res) => {
  try {
    const filtros = {
      modulo: req.query.modulo || null,
      accion: req.query.accion || null,
      id_usuario: req.query.id_usuario ? parseInt(req.query.id_usuario) : null,
      desde: req.query.desde || null,
      hasta: req.query.hasta || null,
      search: req.query.search || null,
    };
    const data = await auditoriaService.listarBitacora(filtros);
    return response.success(
      res,
      200,
      `${data.length} registros de auditoría`,
      data,
    );
  } catch (error) {
    console.error("❌ Error al listar bitácora:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtenerBitacora = async (req, res) => {
  try {
    const data = await auditoriaService.obtenerBitacora(req.params.id);
    return response.success(res, 200, "Registro obtenido", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarModulos = async (req, res) => {
  try {
    const data = await auditoriaService.listarModulos();
    return response.success(res, 200, "Módulos obtenidos", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarActas = async (req, res) => {
  try {
    const data = await auditoriaService.listarActas();
    return response.success(res, 200, `${data.length} actas`, data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const cerrarActa = async (req, res) => {
  try {
    const data = await auditoriaService.cerrarActa({
      ...req.body,
      cerrado_por: req.usuario.id_usuario,
    });
    return response.success(
      res,
      200,
      "Acta cerrada y firmada digitalmente",
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getEstadisticas = async (req, res) => {
  try {
    const data = await auditoriaService.getEstadisticas();
    return response.success(res, 200, "Estadísticas de auditoría", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  listarBitacora,
  obtenerBitacora,
  listarModulos,
  listarActas,
  cerrarActa,
  getEstadisticas,
};
