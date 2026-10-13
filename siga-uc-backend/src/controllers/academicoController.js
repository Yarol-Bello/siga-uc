/**
 * Controlador de gestión académica
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const academicoService = require("../services/academicoService");
const response = require("../utils/response");

/**
 * GET /api/grados
 * Listar todos los grados
 */
const listarGrados = async (req, res) => {
  try {
    const { anio } = req.query;
    const grados = await academicoService.listarGrados(anio);
    return response.success(res, 200, "Grados obtenidos", grados);
  } catch (error) {
    console.error("❌ Error al listar grados:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/grados/:id
 * Obtener detalle de un grado
 */
const obtenerGrado = async (req, res) => {
  try {
    const { id } = req.params;
    const grado = await academicoService.obtenerGrado(id);
    return response.success(res, 200, "Grado obtenido", grado);
  } catch (error) {
    console.error("❌ Error al obtener grado:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/cursos
 * Listar todos los cursos
 */
const listarCursos = async (req, res) => {
  try {
    const cursos = await academicoService.listarCursos();
    return response.success(res, 200, "Cursos obtenidos", cursos);
  } catch (error) {
    console.error("❌ Error al listar cursos:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/cursos/:id
 * Obtener detalle de un curso con competencias
 */
const obtenerCurso = async (req, res) => {
  try {
    const { id } = req.params;
    const curso = await academicoService.obtenerCurso(id);
    return response.success(res, 200, "Curso obtenido", curso);
  } catch (error) {
    console.error("❌ Error al obtener curso:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/cursos/:id/competencias
 * Listar competencias de un curso
 */
const listarCompetencias = async (req, res) => {
  try {
    const { id } = req.params;
    const competencias = await academicoService.listarCompetencias(id);
    return response.success(res, 200, "Competencias obtenidas", competencias);
  } catch (error) {
    console.error("❌ Error al listar competencias:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/escala-calificacion
 * Listar escala de calificación (AD, A, B, C)
 */
const listarEscalaCalificacion = async (req, res) => {
  try {
    const escala = await academicoService.listarEscalaCalificacion();
    return response.success(
      res,
      200,
      "Escala de calificación obtenida",
      escala,
    );
  } catch (error) {
    console.error("❌ Error al listar escala:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/horarios/grado/:id_grado
 * Listar el horario de un grado
 */
const listarHorariosPorGrado = async (req, res) => {
  try {
    const { id_grado } = req.params;
    const data = await academicoService.listarHorariosPorGrado(id_grado);
    return response.success(res, 200, "Horario del grado obtenido", data);
  } catch (error) {
    console.error("❌ Error al listar horario:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  listarGrados,
  obtenerGrado,
  listarCursos,
  obtenerCurso,
  listarCompetencias,
  listarEscalaCalificacion,
  listarHorariosPorGrado,
};
