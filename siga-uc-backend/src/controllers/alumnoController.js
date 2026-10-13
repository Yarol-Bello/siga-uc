/**
 * Controlador de gestión de alumnos
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { validationResult } = require("express-validator");
const alumnoService = require("../services/alumnoService");
const response = require("../utils/response");

/**
 * GET /api/alumnos
 */
const listar = async (req, res) => {
  try {
    const filtros = {
      id_grado: req.query.id_grado ? parseInt(req.query.id_grado) : null,
      estado_matricula: req.query.estado_matricula || null,
      search: req.query.search || null,
      anio_lectivo: req.query.anio ? parseInt(req.query.anio) : 2026,
    };
    const alumnos = await alumnoService.listar(filtros);
    return response.success(
      res,
      200,
      `Se encontraron ${alumnos.length} alumnos`,
      alumnos,
    );
  } catch (error) {
    console.error("❌ Error al listar alumnos:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/alumnos/:id
 */
const obtener = async (req, res) => {
  try {
    const alumno = await alumnoService.obtener(req.params.id);
    return response.success(res, 200, "Alumno obtenido", alumno);
  } catch (error) {
    console.error("❌ Error al obtener alumno:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/alumnos/dni/:dni
 */
const buscarPorDni = async (req, res) => {
  try {
    const alumno = await alumnoService.buscarPorDni(req.params.dni);
    return response.success(res, 200, "Alumno encontrado", alumno);
  } catch (error) {
    console.error("❌ Error al buscar por DNI:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * POST /api/alumnos
 */
const crear = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return response.validationError(
        res,
        errors.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
      );
    }

    const result = await alumnoService.crear(req.body);
    return response.success(
      res,
      201,
      "Matrícula registrada. El alumno está en estado PendientePago.",
      result,
    );
  } catch (error) {
    console.error("❌ Error al crear alumno:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * PUT /api/alumnos/:id
 */
const actualizar = async (req, res) => {
  try {
    const alumno = await alumnoService.actualizar(req.params.id, req.body);
    return response.success(res, 200, "Alumno actualizado", alumno);
  } catch (error) {
    console.error("❌ Error al actualizar alumno:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * PUT /api/alumnos/:id/retirar
 */
const retirar = async (req, res) => {
  try {
    const alumno = await alumnoService.retirar(req.params.id, req.body);
    return response.success(
      res,
      200,
      "Retiro registrado. Expediente congelado.",
      alumno,
    );
  } catch (error) {
    console.error("❌ Error al retirar alumno:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  listar,
  obtener,
  buscarPorDni,
  crear,
  actualizar,
  retirar,
};
