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
  const data = await reporteDao.getLibretaAlumno(
    id_alumno,
    bimestre,
    anioLectivo,
  );
  if (!data?.alumno) {
    const error = new Error(
      "La matrícula no pertenece al año lectivo solicitado.",
    );
    error.statusCode = 404;
    error.details = { codigo: "MATRICULA_NO_ENCONTRADA_EN_ANIO" };
    throw error;
  }
  return data;
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

/**
 * Consolidado histórico por DNI (Fase 6.4).
 * Una fila por año lectivo, agrupada por id_usuario/DNI.
 */
const getConsolidadoPorDni = async (dni) => {
  const documento = String(dni || "").trim();
  if (!/^\d{8}$/.test(documento)) {
    const error = new Error("El DNI debe tener 8 dígitos.");
    error.statusCode = 400;
    throw error;
  }

  const data = await reporteDao.getConsolidadoPorDni(documento);
  if (!data) {
    const error = new Error("No se encontró un usuario con ese DNI.");
    error.statusCode = 404;
    error.details = { codigo: "ESTUDIANTE_NO_ENCONTRADO" };
    throw error;
  }

  return data;
};

module.exports = {
  getDashboard,
  getAlumnosRiesgo,
  getCuadroMerito,
  getLibreta,
  getResumenAsistencia,
  getAuditoriaDocentes,
  getConsolidadoPorDni,
};
