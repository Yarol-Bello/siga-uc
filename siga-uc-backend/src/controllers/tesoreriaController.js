/**
 * Controlador de Tesorería
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const tesoreriaService = require("../services/tesoreriaService");
const response = require("../utils/response");

const listarConceptos = async (req, res) => {
  try {
    const { anio } = req.query;
    const data = await tesoreriaService.listarConceptos(
      anio ? parseInt(anio) : 2026,
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
    const filtros = {
      id_alumno: req.query.id_alumno ? parseInt(req.query.id_alumno) : null,
      desde: req.query.desde || null,
      hasta: req.query.hasta || null,
    };
    const data = await tesoreriaService.listarPagos(filtros);
    return response.success(res, 200, `${data.length} pagos encontrados`, data);
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

const registrarPago = async (req, res) => {
  try {
    const data = await tesoreriaService.registrarPago({
      ...req.body,
      id_usuario_cobrador: req.usuario.id_usuario,
    });
    return response.success(res, 201, "Pago registrado y boleta emitida", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarPensionesAlumno = async (req, res) => {
  try {
    const { anio } = req.query;
    const data = await tesoreriaService.listarPensionesAlumno(
      req.params.id_alumno,
      anio ? parseInt(anio) : 2026,
    );
    return response.success(res, 200, "Pensiones del alumno", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const generarPensionesMes = async (req, res) => {
  try {
    const { anio, mes, monto_base } = req.body;
    const data = await tesoreriaService.generarPensionesMes(
      anio || 2026,
      mes,
      monto_base || 250.0,
    );
    return response.success(
      res,
      201,
      `Pensiones generadas: ${data.total_generados}`,
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarBecas = async (req, res) => {
  try {
    const filtros = {
      activo:
        req.query.activo !== undefined
          ? req.query.activo === "true"
          : undefined,
    };
    const data = await tesoreriaService.listarBecas(filtros);
    return response.success(res, 200, `${data.length} becas encontradas`, data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const aplicarBeca = async (req, res) => {
  try {
    const data = await tesoreriaService.aplicarBeca(req.body);
    return response.success(res, 201, "Beca aplicada", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getEstadisticas = async (req, res) => {
  try {
    const anio = req.query.anio
      ? parseInt(req.query.anio)
      : new Date().getFullYear();
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
  obtenerPago,
  registrarPago,
  listarPensionesAlumno,
  generarPensionesMes,
  listarBecas,
  aplicarBeca,
  getEstadisticas,
};
