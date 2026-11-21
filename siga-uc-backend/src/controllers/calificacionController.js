/**
 * Controlador de Calificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const calificacionService = require("../services/calificacionService");
const { getAnioLectivo } = require("../config/academico");
const response = require("../utils/response");

const obtenerPorAlumnoCurso = async (req, res) => {
  try {
    const { id_alumno, id_curso } = req.params;
    const { anio } = req.query;
    const idPersonal =
      req.usuario?.rol === "DOCENTE" ? req.usuario.id_personal : null;
    const data = await calificacionService.obtenerPorAlumnoCurso(
      id_alumno,
      id_curso,
      anio ? parseInt(anio) : getAnioLectivo(),
      idPersonal,
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
    const idPersonal =
      req.usuario?.rol === "DOCENTE" ? req.usuario.id_personal : null;
    const data = await calificacionService.obtenerPorCursoGrado(
      id_curso,
      id_grado,
      parseInt(bimestre),
      anio ? parseInt(anio) : getAnioLectivo(),
      idPersonal,
    );
    return response.success(res, 200, "Calificaciones del aula", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const registrar = async (req, res) => {
  try {
    // El usuario sale del token, nunca del body.
    const data = await calificacionService.registrar({
      ...req.body,
      modificado_por: req.usuario.id_usuario,
    });
    return response.success(res, 201, "Calificación registrada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const registrarMasivo = async (req, res) => {
  try {
    const { registros } = req.body;
    // El usuario sale del token, nunca del body.
    const registrosConUsuario = Array.isArray(registros)
      ? registros.map((registro) => ({
          ...registro,
          modificado_por: req.usuario.id_usuario,
        }))
      : registros;

    const result = await calificacionService.registrarMasivo(
      registrosConUsuario,
    );
    return response.success(
      res,
      201,
      `${result.guardados} calificaciones guardadas${
        result.total_errores ? `, ${result.total_errores} fallidas` : ""
      }. ${result.notas_finales_calculadas || 0} notas finales calculadas.`,
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
      anio || getAnioLectivo(),
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
    const idPersonal =
      req.usuario?.rol === "DOCENTE" ? req.usuario.id_personal : null;
    const data = await calificacionService.obtenerNotasFinales(
      id_alumno,
      anio ? parseInt(anio) : getAnioLectivo(),
      idPersonal,
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
