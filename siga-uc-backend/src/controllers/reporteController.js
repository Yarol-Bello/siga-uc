/**
 * Controlador de Reportes
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const reporteService = require("../services/reporteService");
const response = require("../utils/response");

const getDashboard = async (req, res) => {
  try {
    const { anio } = req.query;
    const data = await reporteService.getDashboard(
      anio ? parseInt(anio) : 2026,
    );
    return response.success(res, 200, "Dashboard ejecutivo", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getAlumnosRiesgo = async (req, res) => {
  try {
    const { id_grado } = req.params;
    const { bimestre = 1, anio } = req.query;
    const data = await reporteService.getAlumnosRiesgo(
      id_grado,
      parseInt(bimestre),
      anio ? parseInt(anio) : 2026,
    );
    return response.success(res, 200, `${data.length} alumnos en riesgo`, data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getCuadroMerito = async (req, res) => {
  try {
    const { id_grado } = req.params;
    const { bimestre = 1, anio } = req.query;
    const data = await reporteService.getCuadroMerito(
      id_grado,
      parseInt(bimestre),
      anio ? parseInt(anio) : 2026,
    );
    return response.success(res, 200, "Cuadro de mérito", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getLibreta = async (req, res) => {
  try {
    const { id_alumno } = req.params;
    const { bimestre = 1, anio } = req.query;
    const data = await reporteService.getLibreta(
      id_alumno,
      parseInt(bimestre),
      anio ? parseInt(anio) : 2026,
    );
    return response.success(res, 200, "Libreta del alumno", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getResumenAsistencia = async (req, res) => {
  try {
    const { id_grado } = req.params;
    const { anio } = req.query;
    const data = await reporteService.getResumenAsistencia(
      id_grado,
      anio ? parseInt(anio) : 2026,
    );
    return response.success(res, 200, "Resumen de asistencia del grado", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/reportes/auditoria-docentes/:id_grado
 */
const getAuditoriaDocentes = async (req, res) => {
  try {
    const { id_grado } = req.params;
    const { bimestre = 2, anio } = req.query;
    const data = await reporteService.getAuditoriaDocentes(
      id_grado,
      parseInt(bimestre),
      anio ? parseInt(anio) : 2026,
    );
    return response.success(res, 200, "Auditoría de docentes", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  getDashboard,
  getAlumnosRiesgo,
  getCuadroMerito,
  getLibreta,
  getResumenAsistencia,
  getAuditoriaDocentes,
};
