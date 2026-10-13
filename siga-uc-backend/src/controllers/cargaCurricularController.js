/**
 * Controlador de Carga Curricular
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const cargaCurricularService = require("../services/cargaCurricularService");
const response = require("../utils/response");

const listar = async (req, res) => {
  try {
    const filtros = {
      id_grado: req.query.id_grado ? parseInt(req.query.id_grado) : null,
      id_personal: req.query.id_personal
        ? parseInt(req.query.id_personal)
        : null,
      id_curso: req.query.id_curso ? parseInt(req.query.id_curso) : null,
      anio_lectivo: req.query.anio ? parseInt(req.query.anio) : 2026,
    };
    const data = await cargaCurricularService.listar(filtros);
    return response.success(
      res,
      200,
      `Se encontraron ${data.length} asignaciones`,
      data,
    );
  } catch (error) {
    console.error("❌ Error al listar carga:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtener = async (req, res) => {
  try {
    const data = await cargaCurricularService.obtener(req.params.id);
    return response.success(res, 200, "Carga obtenida", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarPorGrado = async (req, res) => {
  try {
    const data = await cargaCurricularService.listarPorGrado(req.params.id);
    return response.success(
      res,
      200,
      `Cursos del grado ${req.params.id}`,
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarPorDocente = async (req, res) => {
  try {
    const { id } = req.params;
    const { anio } = req.query;
    const data = await cargaCurricularService.listarPorDocente(id, anio);
    return response.success(res, 200, `Cursos del docente ${id}`, data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const crear = async (req, res) => {
  try {
    const data = await cargaCurricularService.crear(req.body);
    return response.success(res, 201, "Asignación creada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const actualizar = async (req, res) => {
  try {
    const data = await cargaCurricularService.actualizar(
      req.params.id,
      req.body,
    );
    return response.success(res, 200, "Asignación actualizada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const eliminar = async (req, res) => {
  try {
    const data = await cargaCurricularService.eliminar(req.params.id);
    return response.success(res, 200, "Asignación eliminada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const asignarTutor = async (req, res) => {
  try {
    const data = await cargaCurricularService.asignarTutor(req.body);
    return response.success(res, 200, "Tutor asignado", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getTutor = async (req, res) => {
  try {
    const { id } = req.params;
    const { anio } = req.query;
    const data = await cargaCurricularService.getTutor(id, anio);
    return response.success(res, 200, "Tutor del grado", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  listar,
  obtener,
  listarPorGrado,
  listarPorDocente,
  crear,
  actualizar,
  eliminar,
  asignarTutor,
  getTutor,
};
