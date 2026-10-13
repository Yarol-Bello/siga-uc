/**
 * Servicio de Reportes
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const reporteDao = require("../dao/reporteDao");

const getDashboard = async (anioLectivo) => {
  return await reporteDao.getDashboardEjecutivo(anioLectivo);
};

const getAlumnosRiesgo = async (id_grado, bimestre, anioLectivo) => {
  if (!id_grado || !bimestre) {
    const error = new Error("Faltan parámetros: id_grado, bimestre");
    error.statusCode = 400;
    throw error;
  }
  return await reporteDao.getAlumnosRiesgo(id_grado, bimestre, anioLectivo);
};

const getCuadroMerito = async (id_grado, bimestre, anioLectivo) => {
  if (!id_grado || !bimestre) {
    const error = new Error("Faltan parámetros: id_grado, bimestre");
    error.statusCode = 400;
    throw error;
  }
  return await reporteDao.getCuadroMerito(id_grado, bimestre, anioLectivo);
};

const getLibreta = async (id_alumno, bimestre, anioLectivo) => {
  if (!bimestre) {
    const error = new Error("Falta el bimestre");
    error.statusCode = 400;
    throw error;
  }
  return await reporteDao.getLibretaAlumno(id_alumno, bimestre, anioLectivo);
};

const getResumenAsistencia = async (id_grado, anioLectivo) => {
  return await reporteDao.getResumenAsistenciaGrado(id_grado, anioLectivo);
};

/**
 * Auditoría de carga de notas por docentes
 */
const getAuditoriaDocentes = async (id_grado, bimestre, anioLectivo) => {
  if (!id_grado || !bimestre) {
    const error = new Error("Faltan parámetros: id_grado, bimestre");
    error.statusCode = 400;
    throw error;
  }
  return await reporteDao.getAuditoriaDocentes(id_grado, bimestre, anioLectivo);
};

module.exports = {
  getDashboard,
  getAlumnosRiesgo,
  getCuadroMerito,
  getLibreta,
  getResumenAsistencia,
  getAuditoriaDocentes,
};
