/**
 * Servicio de Caja
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const cajaDao = require("../dao/cajaDao");

const obtenerCajaAbierta = async () => {
  return await cajaDao.obtenerCajaAbierta();
};

const listarCajas = async () => {
  return await cajaDao.listarCajas();
};

const listarAperturas = async (filtros) => {
  return await cajaDao.listarAperturas(filtros);
};

const obtenerApertura = async (id) => {
  const apertura = await cajaDao.findAperturaById(id);
  if (!apertura) {
    const error = new Error("Apertura no encontrada");
    error.statusCode = 404;
    throw error;
  }
  return apertura;
};

const aperturar = async (data) => {
  if (!data.monto_inicial || data.monto_inicial < 0) {
    const error = new Error("El monto inicial debe ser mayor o igual a 0");
    error.statusCode = 400;
    throw error;
  }
  if (!data.id_usuario_apertura) {
    const error = new Error("Falta el usuario que apertura");
    error.statusCode = 400;
    throw error;
  }
  return await cajaDao.aperturar(data);
};

const listarMovimientos = async (id_apertura) => {
  const apertura = await cajaDao.findAperturaById(id_apertura);
  if (!apertura) {
    const error = new Error("Apertura no encontrada");
    error.statusCode = 404;
    throw error;
  }
  return await cajaDao.listarMovimientos(id_apertura);
};

const registrarEgreso = async (data) => {
  if (!data.concepto || !data.monto || data.monto <= 0) {
    const error = new Error("Concepto y monto (mayor a 0) son obligatorios");
    error.statusCode = 400;
    throw error;
  }
  return await cajaDao.registrarEgreso(data);
};

const cerrar = async (data) => {
  if (data.efectivo_fisico === undefined || data.efectivo_fisico < 0) {
    const error = new Error(
      "El efectivo físico es obligatorio y debe ser >= 0",
    );
    error.statusCode = 400;
    throw error;
  }
  if (!data.id_usuario_cierre) {
    const error = new Error("Falta el usuario que cierra");
    error.statusCode = 400;
    throw error;
  }
  return await cajaDao.cerrar(data);
};

const listarCierres = async () => {
  return await cajaDao.listarCierres();
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
