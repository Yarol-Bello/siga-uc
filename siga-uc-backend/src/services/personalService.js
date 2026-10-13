/**
 * Servicio de Personal y Usuarios
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const personalDao = require("../dao/personalDao");

const listar = async (filtros) => {
  return await personalDao.listar(filtros);
};

const obtener = async (id) => {
  const personal = await personalDao.findById(id);
  if (!personal) {
    const error = new Error("Personal no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return personal;
};

const listarRoles = async () => {
  return await personalDao.listarRoles();
};

const crear = async (data) => {
  if (!data.dni || !data.nombres || !data.apellidos || !data.id_rol) {
    const error = new Error(
      "Faltan campos obligatorios: dni, nombres, apellidos, id_rol",
    );
    error.statusCode = 400;
    throw error;
  }

  if (data.dni.length !== 8) {
    const error = new Error("El DNI debe tener 8 dígitos");
    error.statusCode = 400;
    throw error;
  }

  return await personalDao.crear(data);
};

const actualizar = async (id, data) => {
  const personal = await personalDao.findById(id);
  if (!personal) {
    const error = new Error("Personal no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return await personalDao.actualizar(id, data);
};

const cesar = async (id, data) => {
  const personal = await personalDao.findById(id);
  if (!personal) {
    const error = new Error("Personal no encontrado");
    error.statusCode = 404;
    throw error;
  }
  if (personal.estado === "CESADO") {
    const error = new Error("El trabajador ya está cesado");
    error.statusCode = 400;
    throw error;
  }
  if (!data.motivo_cese) {
    const error = new Error("El motivo de cese es obligatorio");
    error.statusCode = 400;
    throw error;
  }
  return await personalDao.cesar(id, data);
};

const reactivar = async (id) => {
  const personal = await personalDao.findById(id);
  if (!personal) {
    const error = new Error("Personal no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return await personalDao.reactivar(id);
};

const resetPassword = async (id) => {
  const personal = await personalDao.findById(id);
  if (!personal) {
    const error = new Error("Personal no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return await personalDao.resetPassword(personal.id_usuario, personal.dni);
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
