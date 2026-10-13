/**
 * Servicio de Carga Curricular
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const cargaCurricularDao = require("../dao/cargaCurricularDao");

const listar = async (filtros) => {
  return await cargaCurricularDao.listar(filtros);
};

const obtener = async (id) => {
  const carga = await cargaCurricularDao.findById(id);
  if (!carga) {
    const error = new Error("Carga curricular no encontrada");
    error.statusCode = 404;
    throw error;
  }
  return carga;
};

const listarPorGrado = async (id_grado) => {
  return await cargaCurricularDao.listarPorGrado(id_grado);
};

const listarPorDocente = async (id_personal, anioLectivo) => {
  return await cargaCurricularDao.listarPorDocente(id_personal, anioLectivo);
};

const getTutor = async (id_grado, anioLectivo) => {
  return await cargaCurricularDao.getTutor(id_grado, anioLectivo);
};

const crear = async (data) => {
  // Validaciones
  if (!data.id_grado || !data.id_curso || !data.id_personal) {
    const error = new Error(
      "Faltan campos obligatorios: id_grado, id_curso, id_personal",
    );
    error.statusCode = 400;
    throw error;
  }
  return await cargaCurricularDao.crear(data);
};

const actualizar = async (id, data) => {
  const carga = await cargaCurricularDao.findById(id);
  if (!carga) {
    const error = new Error("Carga curricular no encontrada");
    error.statusCode = 404;
    throw error;
  }
  return await cargaCurricularDao.actualizar(id, data);
};

const eliminar = async (id) => {
  const carga = await cargaCurricularDao.findById(id);
  if (!carga) {
    const error = new Error("Carga curricular no encontrada");
    error.statusCode = 404;
    throw error;
  }
  return await cargaCurricularDao.eliminar(id);
};

const asignarTutor = async (data) => {
  if (!data.id_grado || !data.id_personal) {
    const error = new Error(
      "Faltan campos obligatorios: id_grado, id_personal",
    );
    error.statusCode = 400;
    throw error;
  }
  return await cargaCurricularDao.asignarTutor(data);
};

module.exports = {
  listar,
  obtener,
  listarPorGrado,
  listarPorDocente,
  getTutor,
  crear,
  actualizar,
  eliminar,
  asignarTutor,
};
