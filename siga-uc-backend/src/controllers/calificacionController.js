/**
 * Controlador de Calificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const calificacionService = require("../services/calificacionService");
const response = require("../utils/response");

const obtenerPorAlumnoCurso = async (req, res) => {
  try {
    const { id_alumno, id_curso } = req.params;
    const { anio } = req.query;
    const data = await calificacionService.obtenerPorAlumnoCurso(
      id_alumno,
      id_curso,
      anio,
    );
    return response.success(res, 200, "Calificaciones obtenidas", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtenerPorCursoGrado = async (req, res) => {
  try {
    const { id_curso, id_grado } = req.params;
    const { bimestre = 1, anio } = req.query;
    const data = await calificacionService.obtenerPorCursoGrado(
      id_curso,
      id_grado,
      parseInt(bimestre),
      anio ? parseInt(anio) : 2026,
    );
    return response.success(res, 200, "Calificaciones del aula", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const registrar = async (req, res) => {
  try {
    const data = await calificacionService.registrar(req.body);
    return response.success(res, 201, "Calificación registrada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const registrarMasivo = async (req, res) => {
  try {
    const { registros } = req.body;
    const result = await calificacionService.registrarMasivo(registros);
    return response.success(
      res,
      201,
      `${result.insertados} calificaciones registradas`,
      result,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const calcularNotaFinal = async (req, res) => {
  try {
    const { id_alumno, id_curso, bimestre } = req.body;
    const { anio } = req.body;
    const data = await calificacionService.calcularYGuardarNotaFinal(
      id_alumno,
      id_curso,
      bimestre,
      anio || 2026,
    );
    return response.success(res, 200, "Nota final calculada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtenerNotasFinales = async (req, res) => {
  try {
    const { id_alumno } = req.params;
    const { anio } = req.query;
    const data = await calificacionService.obtenerNotasFinales(
      id_alumno,
      anio ? parseInt(anio) : 2026,
    );
    return response.success(res, 200, "Notas finales del alumno", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  obtenerPorAlumnoCurso,
  obtenerPorCursoGrado,
  registrar,
  registrarMasivo,
  calcularNotaFinal,
  obtenerNotasFinales,
};
