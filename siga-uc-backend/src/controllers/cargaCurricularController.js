/**
 * Controlador de Carga Curricular
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const cargaCurricularService = require("../services/cargaCurricularService");
const auditoriaService = require("../services/auditoriaService");
const { getAnioLectivo } = require("../config/academico");
const response = require("../utils/response");

const resumenCarga = (carga) => ({
  id_carga: carga.id_carga,
  id_grado: carga.id_grado,
  id_curso: carga.id_curso,
  id_personal: carga.id_personal,
  anio_lectivo: carga.anio_lectivo,
  horas_asignadas: carga.horas_asignadas,
});

const listar = async (req, res) => {
  try {
    const filtros = {
      id_grado: req.query.id_grado ? parseInt(req.query.id_grado) : null,
      id_personal: req.query.id_personal
        ? parseInt(req.query.id_personal)
        : null,
      id_curso: req.query.id_curso ? parseInt(req.query.id_curso) : null,
      anio_lectivo: req.query.anio
        ? parseInt(req.query.anio)
        : getAnioLectivo(),
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
    await auditoriaService.registrarSeguro(req, {
      modulo: "CargaCurricular",
      accion: "CREAR",
      descripcion: `Carga creada: grado ${data.id_grado}, curso ${data.id_curso}, docente ${data.id_personal}`,
      nuevo: resumenCarga(data),
    });
    return response.success(res, 201, "Asignación creada", data);
  } catch (error) {
    return response.error(
      res,
      error.statusCode || 500,
      error.message,
      error.details || null,
    );
  }
};

const actualizar = async (req, res) => {
  try {
    const anterior = await cargaCurricularService.obtener(req.params.id);
    const data = await cargaCurricularService.actualizar(
      req.params.id,
      req.body,
      req.usuario.id_usuario,
    );
    await auditoriaService.registrarSeguro(req, {
      modulo: "CargaCurricular",
      accion: "MODIFICAR",
      descripcion: `Carga actualizada: grado ${data.id_grado}, curso ${data.id_curso}, docente ${data.id_personal}`,
      anterior: resumenCarga(anterior),
      nuevo: {
        ...resumenCarga(data),
        horarios_actualizados: data.horarios_actualizados || 0,
        horarios_eliminados: data.horarios_eliminados || 0,
        advertencia: data.advertencia || null,
      },
    });
    return response.success(res, 200, "Asignación actualizada", data);
  } catch (error) {
    return response.error(
      res,
      error.statusCode || 500,
      error.message,
      error.details || null,
    );
  }
};

const eliminar = async (req, res) => {
  try {
    const anterior = await cargaCurricularService.obtener(req.params.id);
    const data = await cargaCurricularService.eliminar(req.params.id);
    await auditoriaService.registrarSeguro(req, {
      modulo: "CargaCurricular",
      accion: "ELIMINAR",
      descripcion: `Carga eliminada: grado ${anterior.id_grado}, curso ${anterior.id_curso}`,
      anterior: resumenCarga(anterior),
      nuevo: { horarios_eliminados: data.horarios_eliminados || 0 },
    });
    return response.success(res, 200, "Asignación eliminada", data);
  } catch (error) {
    return response.error(
      res,
      error.statusCode || 500,
      error.message,
      error.details || null,
    );
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
