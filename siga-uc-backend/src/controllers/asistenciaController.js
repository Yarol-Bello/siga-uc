/**
 * Controlador de Asistencia
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const asistenciaService = require("../services/asistenciaService");
const response = require("../utils/response");

const obtenerPorCursoFecha = async (req, res) => {
  try {
    const { id_curso, fecha } = req.params;
    const { id_grado } = req.query;
    const data = await asistenciaService.obtenerPorCursoFecha(
      id_curso,
      fecha,
      id_grado,
    );
    return response.success(
      res,
      200,
      `Asistencia del curso en fecha ${fecha}`,
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtenerPorAlumno = async (req, res) => {
  try {
    const filtros = {
      id_curso: req.query.id_curso ? parseInt(req.query.id_curso) : null,
      desde: req.query.desde || null,
      hasta: req.query.hasta || null,
    };
    const data = await asistenciaService.obtenerPorAlumno(
      req.params.id_alumno,
      filtros,
    );
    return response.success(
      res,
      200,
      `Historial de asistencia (${data.length} registros)`,
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtenerResumenPorAlumno = async (req, res) => {
  try {
    const data = await asistenciaService.obtenerResumenPorAlumno(
      req.params.id_alumno,
    );
    return response.success(res, 200, "Resumen de asistencia", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const registrar = async (req, res) => {
  try {
    const data = await asistenciaService.registrar(req.body);
    return response.success(res, 201, "Asistencia registrada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const registrarMasivo = async (req, res) => {
  try {
    const { registros } = req.body;
    const result = await asistenciaService.registrarMasivo(registros);
    return response.success(
      res,
      201,
      `${result.insertados} asistencias registradas`,
      result,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

// ============================================================
// ASISTENCIA DE PERSONAL
// ============================================================

const listarAsistenciaPersonal = async (req, res) => {
  try {
    const { fecha } = req.query;
    const data = await asistenciaService.listarAsistenciaPersonal(fecha);
    return response.success(
      res,
      200,
      `Asistencia del personal (${data.length} registros)`,
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const buscarPersonalPorDni = async (req, res) => {
  try {
    const data = await asistenciaService.buscarPersonalPorDni(req.params.dni);
    return response.success(res, 200, "Personal encontrado", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const registrarAsistenciaPersonal = async (req, res) => {
  try {
    const data = await asistenciaService.registrarAsistenciaPersonal(req.body);
    return response.success(res, 201, "Asistencia registrada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtenerResumenAsistenciaPersonal = async (req, res) => {
  try {
    const { fecha } = req.query;
    const data =
      await asistenciaService.obtenerResumenAsistenciaPersonal(fecha);
    return response.success(
      res,
      200,
      "Resumen de asistencia del personal",
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  obtenerPorCursoFecha,
  obtenerPorAlumno,
  obtenerResumenPorAlumno,
  registrar,
  registrarMasivo,
  listarAsistenciaPersonal,
  buscarPersonalPorDni,
  registrarAsistenciaPersonal,
  obtenerResumenAsistenciaPersonal,
};
