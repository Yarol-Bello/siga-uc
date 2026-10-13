/**
 * Controlador de Personal y Usuarios
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const personalService = require("../services/personalService");
const response = require("../utils/response");

const listar = async (req, res) => {
  try {
    const filtros = {
      id_rol: req.query.id_rol ? parseInt(req.query.id_rol) : null,
      estado: req.query.estado || null,
      search: req.query.search || null,
    };
    const data = await personalService.listar(filtros);
    return response.success(
      res,
      200,
      `Se encontraron ${data.length} trabajadores`,
      data,
    );
  } catch (error) {
    console.error("❌ Error al listar personal:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtener = async (req, res) => {
  try {
    const data = await personalService.obtener(req.params.id);
    return response.success(res, 200, "Personal obtenido", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarRoles = async (req, res) => {
  try {
    const data = await personalService.listarRoles();
    return response.success(res, 200, "Roles obtenidos", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const crear = async (req, res) => {
  try {
    const data = await personalService.crear(req.body);
    return response.success(res, 201, "Personal registrado exitosamente", data);
  } catch (error) {
    console.error("❌ Error al crear personal:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const actualizar = async (req, res) => {
  try {
    const data = await personalService.actualizar(req.params.id, req.body);
    return response.success(res, 200, "Personal actualizado", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const cesar = async (req, res) => {
  try {
    const data = await personalService.cesar(req.params.id, req.body);
    return response.success(res, 200, "Cese registrado exitosamente", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const reactivar = async (req, res) => {
  try {
    const data = await personalService.reactivar(req.params.id);
    return response.success(res, 200, "Trabajador reactivado", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const resetPassword = async (req, res) => {
  try {
    const data = await personalService.resetPassword(req.params.id);
    return response.success(res, 200, "Contraseña restablecida", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  listar,
  obtener,
  listarRoles,
  crear,
  actualizar,
  cesar,
  reactivar,
  resetPassword,
};
