/**
 * Servicio de Tesorería
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const tesoreriaDao = require("../dao/tesoreriaDao");
const alumnoDao = require("../dao/alumnoDao");

const listarConceptos = async (anioLectivo) => {
  return await tesoreriaDao.listarConceptos(anioLectivo);
};

const listarPreTickets = async (filtros) => {
  return await tesoreriaDao.listarPreTickets(filtros);
};

const obtenerPreTicket = async (id) => {
  const pt = await tesoreriaDao.findPreTicketById(id);
  if (!pt) {
    const error = new Error("Pre-ticket no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return pt;
};

const crearPreTicket = async (data) => {
  if (!data.id_alumno || !data.id_concepto || !data.monto) {
    const error = new Error("Faltan campos obligatorios");
    error.statusCode = 400;
    throw error;
  }
  return await tesoreriaDao.crearPreTicket(data);
};

const listarPagos = async (filtros) => {
  return await tesoreriaDao.listarPagos(filtros);
};

const obtenerPago = async (id) => {
  const pago = await tesoreriaDao.findPagoById(id);
  if (!pago) {
    const error = new Error("Pago no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return pago;
};

const registrarPago = async (data) => {
  // Validaciones
  if (!data.id_alumno || !data.id_concepto || !data.monto || !data.forma_pago) {
    const error = new Error(
      "Faltan campos: id_alumno, id_concepto, monto, forma_pago",
    );
    error.statusCode = 400;
    throw error;
  }

  // Verificar alumno
  const alumno = await alumnoDao.findById(data.id_alumno);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }

  // Obtener concepto para tipo
  const concepto = await tesoreriaDao.findConceptoById(data.id_concepto);
  if (!concepto) {
    const error = new Error("Concepto no encontrado");
    error.statusCode = 404;
    throw error;
  }

  data.tipo_concepto = concepto.tipo;

  return await tesoreriaDao.registrarPago(data);
};

const listarPensionesAlumno = async (id_alumno, anioLectivo) => {
  const alumno = await alumnoDao.findById(id_alumno);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return await tesoreriaDao.listarPensionesAlumno(id_alumno, anioLectivo);
};

const generarPensionesMes = async (anioLectivo, mes, montoBase) => {
  if (!mes || mes < 1 || mes > 12) {
    const error = new Error("Mes inválido (1-12)");
    error.statusCode = 400;
    throw error;
  }
  const total = await tesoreriaDao.generarPensionesMensuales(
    anioLectivo,
    mes,
    montoBase,
  );
  return { total_generados: total, mes, anio_lectivo: anioLectivo };
};

const listarBecas = async (filtros) => {
  return await tesoreriaDao.listarBecas(filtros);
};

const aplicarBeca = async (data) => {
  if (
    !data.id_alumno ||
    !data.tipo ||
    !data.porcentaje_descuento ||
    !data.fecha_inicio
  ) {
    const error = new Error(
      "Faltan campos: id_alumno, tipo, porcentaje_descuento, fecha_inicio",
    );
    error.statusCode = 400;
    throw error;
  }
  return await tesoreriaDao.crearBeca(data);
};

const getEstadisticas = async (anioLectivo, mes) => {
  const recaudacion = await tesoreriaDao.getEstadisticasMes(anioLectivo, mes);
  const pendientes = await tesoreriaDao.getPendientesCobro(anioLectivo);

  return {
    mes,
    anio_lectivo: anioLectivo,
    recaudado: {
      total: parseFloat(recaudacion.total_recaudado),
      total_pagos: parseInt(recaudacion.total_pagos),
      pagos_efectivo: parseInt(recaudacion.pagos_efectivo),
      pagos_digital: parseInt(recaudacion.pagos_digital),
    },
    pendiente: {
      total_pretickets: parseInt(pendientes.total_pendientes),
      monto_pendiente: parseFloat(pendientes.monto_pendiente),
    },
  };
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
