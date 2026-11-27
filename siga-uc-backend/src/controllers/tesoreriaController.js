/**
 * Controlador de Tesorería
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const tesoreriaService = require("../services/tesoreriaService");
const boletaPdfService = require("../services/boletaPdfService");
const auditoriaService = require("../services/auditoriaService");
const { getAnioLectivo } = require("../config/academico");
const response = require("../utils/response");

const listarConceptos = async (req, res) => {
  try {
    const { anio } = req.query;
    const data = await tesoreriaService.listarConceptos(
      anio ? parseInt(anio) : getAnioLectivo(),
    );
    return response.success(res, 200, "Conceptos obtenidos", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarPreTickets = async (req, res) => {
  try {
    const filtros = {
      estado: req.query.estado || null,
      id_alumno: req.query.id_alumno ? parseInt(req.query.id_alumno) : null,
      anio_lectivo: req.query.anio
        ? parseInt(req.query.anio, 10)
        : getAnioLectivo(),
    };
    const data = await tesoreriaService.listarPreTickets(filtros);
    return response.success(
      res,
      200,
      `${data.length} pre-tickets encontrados`,
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtenerPreTicket = async (req, res) => {
  try {
    const data = await tesoreriaService.obtenerPreTicket(req.params.id);
    return response.success(res, 200, "Pre-ticket obtenido", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const crearPreTicket = async (req, res) => {
  try {
    const data = await tesoreriaService.crearPreTicket({
      ...req.body,
      id_usuario_emite: req.usuario.id_usuario,
    });
    return response.success(res, 201, "Pre-ticket creado", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarPagos = async (req, res) => {
  try {
    const anioParam = String(req.query.anio || "").trim().toLowerCase();
    const todosLosAnios = anioParam === "todos" || anioParam === "all";
    const anioSolicitado = Number.parseInt(anioParam, 10);
    const anioValido =
      Number.isInteger(anioSolicitado) &&
      anioSolicitado >= 2000 &&
      anioSolicitado <= 2100;

    const filtros = {
      id_alumno: req.query.id_alumno ? parseInt(req.query.id_alumno) : null,
      desde: req.query.desde || null,
      hasta: req.query.hasta || null,
      anio_lectivo: todosLosAnios
        ? null
        : anioValido
          ? anioSolicitado
          : getAnioLectivo(),
      page: req.query.page ? parseInt(req.query.page, 10) : 1,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize, 10)
        : req.query.limit
          ? parseInt(req.query.limit, 10)
          : 25,
      search: req.query.search || req.query.q || null,
      estado: req.query.estado || null,
    };

    const data = await tesoreriaService.listarPagos(filtros);
    return response.success(
      res,
      200,
      `${data.paginacion.total} pagos encontrados`,
      data.pagos,
      data.paginacion,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtenerPago = async (req, res) => {
  try {
    const data = await tesoreriaService.obtenerPago(req.params.id);
    return response.success(res, 200, "Pago obtenido", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const anularPago = async (req, res) => {
  try {
    const data = await tesoreriaService.anularPago(req.params.id, {
      motivo: req.body?.motivo,
      id_usuario: req.usuario.id_usuario,
    });

    await auditoriaService.registrarSeguro(req, {
      modulo: "Tesorería",
      accion: "ANULAR",
      descripcion: `Pago anulado: ${data.pago.id_pago}`,
      anterior: {
        id_pago: data.pago.id_pago,
        estado: "PAGADO",
        monto: Number(data.pago.monto) || 0,
        forma_pago: data.pago.forma_pago,
      },
      nuevo: {
        id_pago: data.pago.id_pago,
        estado: "ANULADO",
        motivo: data.pago.motivo_anulacion,
      },
    });

    return response.success(res, 200, "Pago anulado correctamente", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/tesoreria/boletas/:id_pago/pdf
 * Genera y descarga la boleta de pago en PDF.
 */
const getBoletaPdf = async (req, res) => {
  try {
    const data = await tesoreriaService.obtenerPago(req.params.id_pago);

    if (!data?.numero_boleta) {
      return response.notFound(res, "Boleta no encontrada para este pago");
    }

    const buffer = await boletaPdfService.generarBoletaPdf(data);

    await auditoriaService.registrarSeguro(req, {
      modulo: "Tesorería",
      accion: "DESCARGAR",
      descripcion: `Descarga de boleta ${data.numero_boleta}`,
      nuevo: {
        id_pago: Number(req.params.id_pago) || null,
        numero_boleta: data.numero_boleta,
      },
    });

    const numero = String(data.numero_boleta).replace(/[^0-9A-Za-z_-]/g, "");
    const fileName = `boleta_${numero || data.id_pago}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");

    return res.send(buffer);
  } catch (error) {
    console.error("❌ Error al generar PDF de boleta:", error.message);
    return response.error(
      res,
      error.statusCode || 500,
      error.statusCode ? error.message : "No se pudo generar la boleta en PDF",
    );
  }
};

const registrarPago = async (req, res) => {
  try {
    const data = await tesoreriaService.registrarPago({
      ...req.body,
      id_usuario_cobrador: req.usuario.id_usuario,
    });

    await auditoriaService.registrarSeguro(req, {
      modulo: "Tesorería",
      accion: "CREAR",
      descripcion: `Pago registrado: ${data.pago.nro_operacion || data.pago.id_pago}`,
      nuevo: {
        id_pago: data.pago.id_pago,
        alumno: data.pago.id_alumno,
        concepto: data.pago.id_concepto,
        monto: Number(data.pago.monto) || 0,
        forma_pago: data.pago.forma_pago,
      },
    });

    return response.success(res, 201, "Pago registrado y boleta emitida", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarPadronPensiones = async (req, res) => {
  try {
    const data = await tesoreriaService.listarPadronPensiones({
      anioLectivo: req.query.anio
        ? parseInt(req.query.anio, 10)
        : getAnioLectivo(),
      page: req.query.page ? parseInt(req.query.page, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize, 10) : 25,
      search: req.query.search || req.query.q || null,
      estado: req.query.estado || null,
    });
    return response.success(
      res,
      200,
      `Padrón de pensiones: ${data.paginacion.total} estudiantes`,
      data,
    );
  } catch (error) {
    return response.error(
      res,
      error.statusCode || 500,
      error.message,
      error.details || null,
    );
  }
};

const listarPensionesAlumno = async (req, res) => {
  try {
    const { anio } = req.query;
    const data = await tesoreriaService.listarPensionesAlumno(
      req.params.id_alumno,
      anio ? parseInt(anio) : getAnioLectivo(),
    );
    return response.success(res, 200, "Pensiones del alumno", data);
  } catch (error) {
    return response.error(
      res,
      error.statusCode || 500,
      error.message,
      error.details || null,
    );
  }
};

const generarPensionesAlumno = async (req, res) => {
  try {
    const { dni, ...data } = await tesoreriaService.generarPensionesAlumno(
      req.params.id_alumno,
    );

    await auditoriaService.registrarSeguro(req, {
      modulo: "Tesorería",
      accion: "CREAR",
      descripcion: `Generación manual de pensiones del alumno ${dni}`,
      nuevo: {
        id_alumno: Number(req.params.id_alumno) || null,
        generadas: data.generadas,
      },
    });

    return response.success(res, 200, "Pensiones generadas", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const generarPensionesMes = async (req, res) => {
  try {
    const { anio, mes, monto_base } = req.body;
    const anioFinal = anio ? parseInt(anio) : getAnioLectivo();
    const montoFinal =
      monto_base !== undefined && monto_base !== null && monto_base !== ""
        ? Number(monto_base)
        : undefined;

    const data = await tesoreriaService.generarPensionesMes(
      anioFinal,
      mes,
      montoFinal,
    );
    return response.success(
      res,
      201,
      `Pensiones generadas: ${data.total_generados}`,
      data,
    );
  } catch (error) {
    return response.error(
      res,
      error.statusCode || 500,
      error.message,
      error.details || null,
    );
  }
};

const listarBecas = async (req, res) => {
  try {
    const filtros = {
      activo:
        req.query.activo !== undefined
          ? req.query.activo === "true"
          : undefined,
      anio_lectivo: req.query.anio
        ? parseInt(req.query.anio, 10)
        : getAnioLectivo(),
    };
    const data = await tesoreriaService.listarBecas(filtros);
    return response.success(res, 200, `${data.length} becas encontradas`, data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const aplicarBeca = async (req, res) => {
  try {
    const data = await tesoreriaService.aplicarBeca(
      req.body,
      req.usuario,
      req.ip,
    );
    return response.success(res, 201, "Beca aplicada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getEstadisticas = async (req, res) => {
  try {
    const anio = req.query.anio
      ? parseInt(req.query.anio)
      : getAnioLectivo();
    const mes = req.query.mes
      ? parseInt(req.query.mes)
      : new Date().getMonth() + 1;
    const data = await tesoreriaService.getEstadisticas(anio, mes);
    return response.success(res, 200, "Estadísticas de tesorería", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  listarConceptos,
  listarPreTickets,
  obtenerPreTicket,
  crearPreTicket,
  listarPagos,
  generarPensionesAlumno,
  obtenerPago,
  anularPago,
  getBoletaPdf,
  registrarPago,
  listarPensionesAlumno,
  listarPadronPensiones,
  generarPensionesMes,
  listarBecas,
  aplicarBeca,
  getEstadisticas,
};
