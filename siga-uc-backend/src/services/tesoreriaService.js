/**
 * Servicio de Tesorería
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const tesoreriaDao = require("../dao/tesoreriaDao");
const cajaDao = require("../dao/cajaDao");
const alumnoDao = require("../dao/alumnoDao");
const conceptoPagoDao = require("../dao/conceptoPagoDao");
const becaService = require("./becaService");
const configuracionService = require("./configuracionService");
const { getAnioLectivo } = require("../config/academico");

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

const anularPago = async (id, data) => {
  const motivo = String(data?.motivo || "").trim();

  if (motivo.length < 10) {
    const error = new Error(
      "El motivo de anulación debe tener al menos 10 caracteres.",
    );
    error.statusCode = 400;
    throw error;
  }

  return await tesoreriaDao.anularPago(id, {
    motivo,
    id_usuario: data?.id_usuario,
  });
};

const redondearMonto = (valor) =>
  Math.round((Number(valor) || 0) * 100) / 100;

const formatearMonto = (valor) => redondearMonto(valor).toFixed(2);

const validarMontoEsperado = (
  montoEsperado,
  montoRecibido,
  mensaje,
  simbolo = "S/",
) => {
  if (redondearMonto(montoEsperado) !== redondearMonto(montoRecibido)) {
    const error = new Error(
      `${mensaje} ${simbolo} ${formatearMonto(montoEsperado)}`,
    );
    error.statusCode = 400;
    throw error;
  }
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

  if (typeof data.nro_operacion === "string") {
    data.nro_operacion = data.nro_operacion.trim();
  }

  const institucion = await configuracionService.obtenerInstitucionDocumentos();
  const simbolo = institucion.simbolo_moneda || "S/";

  if (data.forma_pago !== "Efectivo" && !data.nro_operacion) {
    const error = new Error(
      "El número de operación es obligatorio para pagos no efectivos",
    );
    error.statusCode = 400;
    throw error;
  }

  const cajaAbierta = await cajaDao.obtenerCajaAbierta();
  if (!cajaAbierta) {
    const error = new Error(
      "No hay una caja abierta. Aperture una caja antes de registrar pagos.",
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

  if (concepto.tipo !== "PENSION" && !concepto.activo) {
    const error = new Error("El concepto seleccionado está inactivo.");
    error.statusCode = 400;
    throw error;
  }

  if (
    concepto.tipo === "MATRICULA" &&
    Number(concepto.anio_lectivo) !== Number(alumno.anio_lectivo)
  ) {
    const error = new Error(
      "El concepto de matrícula no pertenece al año de la matrícula.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (concepto.tipo === "MATRICULA") {
    const resuelto = await conceptoPagoDao.resolver({
      anio: concepto.anio_lectivo,
      tipo: "MATRICULA",
      mes: null,
      idGrado: alumno.id_grado,
      fecha: new Date().toISOString().slice(0, 10),
    });
    if (
      !resuelto ||
      Number(resuelto.id_concepto) !== Number(concepto.id_concepto)
    ) {
      const error = new Error(
        "El concepto de matrícula no corresponde a la tarifa vigente del alumno.",
      );
      error.statusCode = 400;
      error.details = { codigo: "CONCEPTO_NO_CORRESPONDE_AL_ALUMNO" };
      throw error;
    }
  }

  if (
    concepto.tipo === "OTROS" &&
    Number(concepto.anio_lectivo) !== Number(alumno.anio_lectivo)
  ) {
    const error = new Error(
      "El concepto no pertenece al año lectivo de la matrícula.",
    );
    error.statusCode = 400;
    throw error;
  }

  // Resolver la pensión vinculada al pago (si corresponde)
  let pension = null;

  if (data.id_pension) {
    const idPension = Number(data.id_pension);
    if (!Number.isInteger(idPension) || idPension <= 0) {
      const error = new Error("La pensión indicada no existe.");
      error.statusCode = 400;
      throw error;
    }

    pension = await tesoreriaDao.findPensionById(idPension);
    if (!pension) {
      const error = new Error("La pensión indicada no existe.");
      error.statusCode = 400;
      throw error;
    }
  } else if (concepto.tipo === "PENSION") {
    if (!concepto.mes) {
      const error = new Error(
        "El concepto de pensión no tiene un mes configurado.",
      );
      error.statusCode = 400;
      throw error;
    }

    pension = await tesoreriaDao.findPensionPorAlumnoMes(
      data.id_alumno,
      concepto.anio_lectivo,
      concepto.mes,
    );

    if (!pension) {
      const error = new Error(
        "No se encontró la pensión del alumno para ese mes.",
      );
      error.statusCode = 400;
      throw error;
    }

    // Vincular el pago a la pensión resuelta (mismo campo que ya usa el DAO).
    data.id_pension = pension.id_pension;
  }

  if (pension) {
    if (concepto.tipo === "PENSION") {
      const mismoMes = Number(pension.mes) === Number(concepto.mes);
      const mismoAnio =
        Number(pension.anio_lectivo) === Number(concepto.anio_lectivo);

      if (!mismoMes || !mismoAnio) {
        const error = new Error(
          "El concepto no corresponde al mes de la pensión.",
        );
        error.statusCode = 400;
        throw error;
      }

      if (
        pension.id_concepto &&
        Number(pension.id_concepto) !== Number(concepto.id_concepto)
      ) {
        const error = new Error(
          "El concepto no corresponde a la tarifa con la que se generó la pensión.",
        );
        error.statusCode = 400;
        error.details = { codigo: "CONCEPTO_NO_CORRESPONDE_A_PENSION" };
        throw error;
      }
    }

    if (Number(pension.id_alumno) !== Number(data.id_alumno)) {
      const error = new Error("La pensión no pertenece al alumno.");
      error.statusCode = 400;
      throw error;
    }

    if (pension.estado !== "PENDIENTE") {
      let mensaje = "La pensión no está disponible para pago.";

      if (pension.estado === "PAGADO") {
        mensaje = "La pensión ya está pagada.";
      } else if (pension.estado === "ANULADO") {
        mensaje = "La pensión está anulada.";
      }

      const error = new Error(mensaje);
      error.statusCode = 400;
      throw error;
    }

    validarMontoEsperado(
      pension.monto_final,
      data.monto,
      "El monto de la pensión es",
      simbolo,
    );
  } else {
    const preticket =
      data.id_preticket ||
      (
        await tesoreriaDao.findPreTicketPendiente(
          data.id_alumno,
          data.id_concepto,
        )
      )?.id_preticket;

    const preticketPendiente = preticket
      ? await tesoreriaDao.findPreTicketById(preticket)
      : null;

    validarMontoEsperado(
      preticketPendiente?.monto ?? concepto.monto_base,
      data.monto,
      "El monto del concepto es",
      simbolo,
    );
  }

  data.tipo_concepto = concepto.tipo;

  return await tesoreriaDao.registrarPago(data);
};

const listarPadronPensiones = async (filtros) => {
  return await tesoreriaDao.listarPadronPensiones(filtros);
};

const listarPensionesAlumno = async (id_alumno, anioLectivo) => {
  const alumno = await alumnoDao.findById(id_alumno);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    error.details = { codigo: "MATRICULA_NO_ENCONTRADA_EN_ANIO" };
    throw error;
  }
  if (Number(alumno.anio_lectivo) !== Number(anioLectivo)) {
    const error = new Error(
      "La matrícula no pertenece al año lectivo solicitado.",
    );
    error.statusCode = 404;
    error.details = { codigo: "MATRICULA_NO_ENCONTRADA_EN_ANIO" };
    throw error;
  }
  return await tesoreriaDao.listarPensionesAlumno(id_alumno, anioLectivo);
};

/**
 * Generar manualmente el cronograma de pensiones de un alumno matriculado.
 * No crea meses anteriores al mes de creación; es idempotente.
 */
const generarPensionesAlumno = async (id_alumno) => {
  const alumno = await alumnoDao.findById(id_alumno);

  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }

  if (alumno.estado_matricula !== "Matriculado") {
    const error = new Error(
      "El alumno no está matriculado. Registre el pago de matrícula antes de generar pensiones.",
    );
    error.statusCode = 400;
    throw error;
  }

  const generadas = await tesoreriaDao.generarPensionesAlumno(id_alumno);
  const anioLectivo = alumno.anio_lectivo || getAnioLectivo();
  const pensiones = await tesoreriaDao.listarPensionesAlumno(
    id_alumno,
    anioLectivo,
  );

  return {
    generadas,
    total_pensiones: pensiones.length,
    dni: alumno.dni,
  };
};

const generarPensionesMes = async (anioLectivo, mes, montoBase) => {
  if (!mes || Number(mes) < 1 || Number(mes) > 12) {
    const error = new Error("Mes inválido (1-12)");
    error.statusCode = 400;
    throw error;
  }

  if (
    montoBase !== undefined &&
    montoBase !== null &&
    String(montoBase).trim() !== ""
  ) {
    const error = new Error(
      "El monto de la pensión se toma de la configuración de tarifas; no envíe monto_base.",
    );
    error.statusCode = 400;
    error.details = { codigo: "MONTO_NO_CONFIGURABLE" };
    throw error;
  }

  const anio = Number(anioLectivo) || getAnioLectivo();
  const total = await tesoreriaDao.generarPensionesMensuales(
    anio,
    Number(mes),
  );
  return { total_generados: total, mes: Number(mes), anio_lectivo: anio };
};

const listarBecas = async (filtros) => {
  return await tesoreriaDao.listarBecas(filtros);
};

const aplicarBeca = async (data, usuario = null, ip = null) => {
  if (!data.id_alumno || !data.tipo || !data.fecha_inicio) {
    const error = new Error(
      "Faltan campos: id_alumno, tipo, fecha_inicio",
    );
    error.statusCode = 400;
    throw error;
  }

  const montoFijo = Number(data.monto_descuento || 0);
  const porcentaje = Number(data.porcentaje_descuento || 0);
  const modalidad = montoFijo > 0 ? "MONTO_FIJO" : "PORCENTAJE";
  const valor = montoFijo > 0 ? montoFijo : porcentaje;
  if (valor <= 0) {
    const error = new Error(
      "Debe indicar porcentaje_descuento o monto_descuento mayor que cero.",
    );
    error.statusCode = 400;
    throw error;
  }

  return await becaService.crearBeca(
    {
      id_alumno: data.id_alumno,
      tipo: data.tipo,
      fecha_inicio: data.fecha_inicio,
      fecha_fin: data.fecha_fin || null,
      alcance: data.alcance || "PENSION",
      modalidad,
      valor,
      monto_maximo: data.monto_maximo || null,
      evidencia: data.evidencia || null,
      aprobar: Boolean(data.aprobar),
      motivo: data.motivo || "Registro de beca desde tesorería",
    },
    usuario,
    ip,
  );
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
      total_pretickets: parseInt(pendientes.total_pretickets, 10),
      monto_pretickets: parseFloat(pendientes.monto_pretickets),
      total_pensiones: parseInt(pendientes.total_pensiones, 10),
      monto_pensiones: parseFloat(pendientes.monto_pensiones),
      alumnos_con_deuda: parseInt(pendientes.alumnos_con_deuda, 10),
      total_pendientes: parseInt(pendientes.total_pendientes, 10),
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
  anularPago,
  registrarPago,
  listarPensionesAlumno,
  listarPadronPensiones,
  generarPensionesAlumno,
  generarPensionesMes,
  listarBecas,
  aplicarBeca,
  getEstadisticas,
};
