/**
 * Controlador de gestión de alumnos
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { validationResult } = require("express-validator");
const alumnoService = require("../services/alumnoService");
const auditoriaService = require("../services/auditoriaService");
const { getAnioLectivo } = require("../config/academico");
const response = require("../utils/response");

/**
 * GET /api/alumnos
 */
const listar = async (req, res) => {
  try {
    const filtros = {
      id_grado: req.query.id_grado ? parseInt(req.query.id_grado) : null,
      estado_matricula: req.query.estado_matricula || null,
      search: req.query.search || req.query.q || null,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : null,
      solo_activos:
        req.query.solo_activos === "1" ||
        req.query.solo_activos === "true" ||
        req.query.solo_activos === true,
      anio_lectivo: req.query.anio
        ? parseInt(req.query.anio)
        : getAnioLectivo(),
    };

    const pageSolicitada = parseInt(req.query.page, 10);
    const pageSizeSolicitada = parseInt(req.query.pageSize, 10);

    if (Number.isInteger(pageSolicitada) && pageSolicitada > 0) {
      const pageSize = Math.min(
        Math.max(Number.isInteger(pageSizeSolicitada) ? pageSizeSolicitada : 20, 1),
        100,
      );

      const total = await alumnoService.contar(filtros);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(pageSolicitada, totalPages);

      const alumnos = await alumnoService.listar({
        ...filtros,
        page,
        pageSize,
      });

      return response.success(
        res,
        200,
        `${alumnos.length} de ${total} alumnos`,
        alumnos,
        { total, page, pageSize, totalPages },
      );
    }

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
    if (
      req.query.anio &&
      Number(alumno.anio_lectivo) !== Number.parseInt(req.query.anio, 10)
    ) {
      return response.error(
        res,
        404,
        "La matrícula no pertenece al año solicitado.",
        { codigo: "MATRICULA_NO_ENCONTRADA_EN_ANIO" },
      );
    }
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
    const anioLectivo = req.query.anio
      ? Number.parseInt(req.query.anio, 10)
      : getAnioLectivo();
    const alumno = await alumnoService.buscarPorDni(
      req.params.dni,
      anioLectivo,
    );
    return response.success(res, 200, "Alumno encontrado", alumno);
  } catch (error) {
    console.error("❌ Error al buscar por DNI:", error);
    return response.error(
      res,
      error.statusCode || 500,
      error.message,
      error.details || null,
    );
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

    const result = await alumnoService.crear({
      ...req.body,
      id_usuario_emite: req.usuario.id_usuario,
    });

    await auditoriaService.registrarSeguro(req, {
      modulo: "Alumnos",
      accion: "CREAR",
      descripcion: `Alta de alumno DNI ${result.dni} - ${result.nombre_completo} - grado ${req.body.id_grado}`,
      nuevo: {
        id_alumno: result.id_alumno,
        dni: result.dni,
        nombre_completo: result.nombre_completo,
        grado: Number(req.body.id_grado) || null,
      },
    });

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
    const anterior = await alumnoService.obtener(req.params.id);
    const alumno = await alumnoService.actualizar(req.params.id, req.body);

    const anteriorCambios = {};
    const nuevoCambios = {};

    const comparar = (clave, viejo, nuevo) => {
      if (String(viejo ?? "") !== String(nuevo ?? "")) {
        anteriorCambios[clave] = viejo;
        nuevoCambios[clave] = nuevo;
      }
    };

    comparar("nombres", anterior.nombres, alumno.nombres);
    comparar("apellidos", anterior.apellidos, alumno.apellidos);
    comparar(
      "grado",
      Number(anterior.id_grado) || null,
      Number(alumno.id_grado) || null,
    );
    comparar(
      "estado_matricula",
      anterior.estado_matricula,
      alumno.estado_matricula,
    );
    comparar(
      "correo_personal",
      anterior.correo_personal || null,
      req.body.correo_personal !== undefined
        ? req.body.correo_personal || null
        : anterior.correo_personal || null,
    );

    if (Object.keys(nuevoCambios).length > 0) {
      await auditoriaService.registrarSeguro(req, {
        modulo: "Alumnos",
        accion: "MODIFICAR",
        descripcion: `Edición de alumno DNI ${anterior.dni}`,
        anterior: anteriorCambios,
        nuevo: nuevoCambios,
      });
    }

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
    const anterior = await alumnoService.obtener(req.params.id);
    const {
      alumno,
      pensiones_anuladas = 0,
      pretickets_anulados = 0,
    } = await alumnoService.retirar(req.params.id, req.body);

    await auditoriaService.registrarSeguro(req, {
      modulo: "Alumnos",
      accion: "RETIRAR",
      descripcion: `Retiro de alumno DNI ${anterior.dni} - motivo: ${req.body.motivo_retiro}`,
      anterior: {
        estado_matricula: anterior.estado_matricula,
      },
      nuevo: {
        estado_matricula: "Retirado",
        motivo: req.body.motivo_retiro,
        destino: req.body.colegio_destino || null,
        pensiones_anuladas,
        pretickets_anulados,
      },
    });

    return response.success(
      res,
      200,
      "Retiro registrado. Expediente congelado.",
      {
        ...alumno,
        pensiones_anuladas,
        pretickets_anulados,
      },
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
