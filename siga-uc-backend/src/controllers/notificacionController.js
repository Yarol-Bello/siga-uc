/**
 * Controlador de Notificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const notificacionService = require("../services/notificacionService");
const response = require("../utils/response");

const listar = async (req, res) => {
  try {
    const filtros = {
      leido:
        req.query.leido !== undefined ? req.query.leido === "true" : undefined,
    };
    const data = await notificacionService.listar(
      req.usuario.id_usuario,
      filtros,
    );
    return response.success(res, 200, `${data.length} notificaciones`, data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtener = async (req, res) => {
  try {
    const data = await notificacionService.obtener(
      req.params.id,
      req.usuario.id_usuario,
    );
    return response.success(res, 200, "Notificación obtenida", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const contarNoLeidas = async (req, res) => {
  try {
    const data = await notificacionService.contarNoLeidas(
      req.usuario.id_usuario,
    );
    return response.success(res, 200, "Conteo de no leídas", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const crear = async (req, res) => {
  try {
    const data = await notificacionService.crear({
      ...req.body,
      id_usuario_remitente: req.usuario.id_usuario,
    });
    return response.success(res, 201, "Notificación enviada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const crearMasivo = async (req, res) => {
  try {
    const data = await notificacionService.crearMasivo({
      ...req.body,
      id_usuario_remitente: req.usuario.id_usuario,
    });
    return response.success(
      res,
      201,
      `${data.length} notificaciones enviadas`,
      {
        total_enviadas: data.length,
      },
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const marcarLeida = async (req, res) => {
  try {
    const data = await notificacionService.marcarLeida(
      req.params.id,
      req.usuario.id_usuario,
    );
    return response.success(res, 200, "Notificación marcada como leída", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const marcarTodasLeidas = async (req, res) => {
  try {
    const data = await notificacionService.marcarTodasLeidas(
      req.usuario.id_usuario,
    );
    return response.success(
      res,
      200,
      `${data.marcadas} notificaciones marcadas como leídas`,
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const eliminar = async (req, res) => {
  try {
    const data = await notificacionService.eliminar(
      req.params.id,
      req.usuario.id_usuario,
    );
    return response.success(res, 200, "Notificación eliminada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  listar,
  obtener,
  contarNoLeidas,
  crear,
  crearMasivo,
  marcarLeida,
  marcarTodasLeidas,
  eliminar,
};
