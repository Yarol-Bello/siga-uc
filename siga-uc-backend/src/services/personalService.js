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

const validarRolPersonal = (idRol) => {
  if (![1, 2, 3].includes(Number(idRol))) {
    const error = new Error("El rol ESTUDIANTE no aplica al personal.");
    error.statusCode = 400;
    throw error;
  }
};

const crear = async (data) => {
  if (!data.dni || !data.nombres || !data.apellidos || !data.id_rol) {
    const error = new Error(
      "Faltan campos obligatorios: dni, nombres, apellidos, id_rol",
    );
    error.statusCode = 400;
    throw error;
  }

  validarRolPersonal(data.id_rol);

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

  if (data.id_rol !== undefined && data.id_rol !== null) {
    validarRolPersonal(data.id_rol);
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

  const resultado = await personalDao.resetPassword(
    personal.id_usuario,
    personal.dni,
  );

  // Datos internos para la auditoría; el controller los retira de la respuesta.
  return {
    ...resultado,
    dni: personal.dni,
    id_usuario_afectado: personal.id_usuario,
  };
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
