/**
 * Servicio de gestión académica (grados, cursos, competencias)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const gradoDao = require("../dao/gradoDao");
const cursoDao = require("../dao/cursoDao");

/**
 * Listar todos los grados
 */
const listarGrados = async (anioLectivo) => {
  return await gradoDao.listar(anioLectivo);
};

/**
 * Obtener detalle de un grado (con tutor)
 */
const obtenerGrado = async (id_grado) => {
  const grado = await gradoDao.findById(id_grado);

  if (!grado) {
    const error = new Error("Grado no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const tutor = await gradoDao.getTutor(id_grado);

  return {
    ...grado,
    tutor,
  };
};

/**
 * Listar todos los cursos
 */
const listarCursos = async () => {
  return await cursoDao.listar();
};

/**
 * Obtener detalle de un curso (con competencias)
 */
const obtenerCurso = async (id_curso) => {
  const curso = await cursoDao.findById(id_curso);

  if (!curso) {
    const error = new Error("Curso no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const competencias = await cursoDao.listarCompetencias(id_curso);

  return {
    ...curso,
    competencias,
  };
};

/**
 * Listar competencias de un curso
 */
const listarCompetencias = async (id_curso) => {
  const curso = await cursoDao.findById(id_curso);
  if (!curso) {
    const error = new Error("Curso no encontrado");
    error.statusCode = 404;
    throw error;
  }

  return await cursoDao.listarCompetencias(id_curso);
};

/**
 * Listar escala de calificación
 */
const listarEscalaCalificacion = async () => {
  return await cursoDao.listarEscalaCalificacion();
};

/**
 * Listar horarios de un grado
 */
const listarHorariosPorGrado = async (id_grado) => {
  return await gradoDao.listarHorariosPorGrado(id_grado);
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
