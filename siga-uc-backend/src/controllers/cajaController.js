/**
 * Controlador de Caja
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const cajaService = require("../services/cajaService");
const response = require("../utils/response");

const obtenerCajaAbierta = async (req, res) => {
  try {
    const data = await cajaService.obtenerCajaAbierta();
    return response.success(
      res,
      200,
      data ? "Caja abierta encontrada" : "No hay caja abierta",
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarCajas = async (req, res) => {
  try {
    const data = await cajaService.listarCajas();
    return response.success(res, 200, "Cajas listadas", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarAperturas = async (req, res) => {
  try {
    const filtros = {
      desde: req.query.desde || null,
      hasta: req.query.hasta || null,
    };
    const data = await cajaService.listarAperturas(filtros);
    return response.success(
      res,
      200,
      `${data.length} aperturas encontradas`,
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtenerApertura = async (req, res) => {
  try {
    const data = await cajaService.obtenerApertura(req.params.id);
    return response.success(res, 200, "Apertura obtenida", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const aperturar = async (req, res) => {
  try {
    const data = await cajaService.aperturar({
      ...req.body,
      id_usuario_apertura: req.usuario.id_usuario,
    });
    return response.success(res, 201, "Caja aperturada exitosamente", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarMovimientos = async (req, res) => {
  try {
    const data = await cajaService.listarMovimientos(req.params.id_apertura);
    return response.success(
      res,
      200,
      `${data.length} movimientos encontrados`,
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const registrarEgreso = async (req, res) => {
  try {
    const data = await cajaService.registrarEgreso({
      ...req.body,
      id_usuario: req.usuario.id_usuario,
    });
    return response.success(res, 201, "Egreso registrado", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const cerrar = async (req, res) => {
  try {
    const data = await cajaService.cerrar({
      ...req.body,
      id_usuario_cierre: req.usuario.id_usuario,
    });
    return response.success(res, 200, "Caja cerrada exitosamente", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarCierres = async (req, res) => {
  try {
    const data = await cajaService.listarCierres();
    return response.success(
      res,
      200,
      `${data.length} cierres encontrados`,
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  obtenerCajaAbierta,
  listarCajas,
  listarAperturas,
  obtenerApertura,
  aperturar,
  listarMovimientos,
  registrarEgreso,
  cerrar,
  listarCierres,
};
