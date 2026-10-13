/**
 * Servicio de Auditoría y Actas
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const auditoriaDao = require("../dao/auditoriaDao");

const listarBitacora = async (filtros) => {
  return await auditoriaDao.listarBitacora(filtros);
};

const obtenerBitacora = async (id) => {
  const bitacora = await auditoriaDao.findBitacoraById(id);
  if (!bitacora) {
    const error = new Error("Registro de auditoría no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return bitacora;
};

const listarModulos = async () => {
  return await auditoriaDao.listarModulos();
};

const listarActas = async () => {
  return await auditoriaDao.listarActas();
};

const cerrarActa = async (data) => {
  if (!data.periodo || !data.anio_lectivo) {
    const error = new Error("Faltan campos: periodo, anio_lectivo");
    error.statusCode = 400;
    throw error;
  }
  if (!data.cerrado_por) {
    const error = new Error("Falta el usuario que cierra el acta");
    error.statusCode = 400;
    throw error;
  }
  return await auditoriaDao.cerrarActa(data);
};

const getEstadisticas = async () => {
  return await auditoriaDao.getEstadisticas();
};

module.exports = {
  listarBitacora,
  obtenerBitacora,
  listarModulos,
  listarActas,
  cerrarActa,
  getEstadisticas,
};
