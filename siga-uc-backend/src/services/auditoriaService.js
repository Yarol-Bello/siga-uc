/**
 * Servicio de Auditoría y Actas
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const auditoriaDao = require("../dao/auditoriaDao");
const gradoDao = require("../dao/gradoDao");

const PERIODOS_CANONICOS = {
  1: "1er Bimestre",
  2: "2do Bimestre",
  3: "3er Bimestre",
  4: "4to Bimestre",
};

/**
 * Registrar un evento de auditoría.
 *
 * Se invoca SIEMPRE fuera de las transacciones de negocio (después del COMMIT):
 * un fallo al escribir la bitácora no debe revertir un pago ni una operación.
 * Esta función nunca lanza; solo registra el error en consola.
 */
const registrar = async (evento) => {
  try {
    return await auditoriaDao.registrarEvento(evento);
  } catch (error) {
    console.error(
      "❌ No se pudo registrar el evento de auditoría:",
      error.message,
    );
    return null;
  }
};

/**
 * Variante para controllers: toma el usuario autenticado y la IP de la request.
 * Permite sobrescribir id_usuario/ip para eventos públicos (login, recuperación).
 */
const registrarSeguro = async (req, evento) => {
  return registrar({
    ...evento,
    id_usuario: evento.id_usuario ?? req.usuario?.id_usuario ?? null,
    ip: evento.ip ?? req.ip,
  });
};

/**
 * Registra auditoría dentro de la transacción del llamador.
 * Si la escritura falla, la transacción completa debe revertirse: se usa para
 * cambios de configuración, donde no se admite un cambio sin bitácora.
 */
const registrarEnTransaccion = async (client, evento) => {
  return await auditoriaDao.registrarEvento(evento, client);
};

const listarBitacora = async (filtros) => {
  return await auditoriaDao.listarBitacora(filtros);
};

/**
 * Contar bitácora con los mismos filtros del listado
 */
const contarBitacora = async (filtros) => {
  return await auditoriaDao.contarBitacora(filtros);
};

const obtenerBitacora = async (id) => {
  const bitacora = await auditoriaDao.findBitacoraById(id);
  if (!bitacora) {
    const error = new Error("Registro de auditoría no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return bitacora;
};

const listarModulos = async () => {
  return await auditoriaDao.listarModulos();
};

const listarActas = async () => {
  return await auditoriaDao.listarActas();
};

const obtenerActa = async (id_acta) => {
  const acta = await auditoriaDao.findActaById(id_acta);
  if (!acta) {
    const error = new Error("Acta no encontrada");
    error.statusCode = 404;
    throw error;
  }

  const matriz = await auditoriaDao.findActaMatriz(
    acta.id_grado,
    acta.periodo,
    acta.anio_lectivo,
  );

  if (matriz.alumnos.length === 0) {
    const error = new Error("El acta no tiene alumnos registrados");
    error.statusCode = 400;
    throw error;
  }

  const tieneNotas = matriz.alumnos.some(
    (alumno) => Object.keys(alumno.notas).length > 0,
  );

  if (!tieneNotas) {
    const error = new Error(
      "El acta no tiene calificaciones registradas para generar el PDF",
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    ...acta,
    cursos: matriz.cursos,
    alumnos: matriz.alumnos,
  };
};

const cerrarActa = async (data) => {
  const bimestre = Number(data.bimestre);
  const anioLectivo = Number(data.anio_lectivo);

  if (!Number.isInteger(bimestre) || bimestre < 1 || bimestre > 4) {
    const error = new Error("Bimestre inválido (1-4)");
    error.statusCode = 400;
    throw error;
  }

  if (
    !Number.isInteger(anioLectivo) ||
    anioLectivo < 2000 ||
    anioLectivo > 2100
  ) {
    const error = new Error("Año lectivo inválido");
    error.statusCode = 400;
    throw error;
  }

  let idGrado = null;
  if (data.id_grado !== undefined && data.id_grado !== null && data.id_grado !== "") {
    idGrado = Number(data.id_grado);
    if (!Number.isInteger(idGrado) || idGrado <= 0) {
      const error = new Error("Grado inválido");
      error.statusCode = 400;
      throw error;
    }
  }

  if (!data.cerrado_por) {
    const error = new Error("Falta el usuario que cierra el acta");
    error.statusCode = 400;
    throw error;
  }

  if (idGrado !== null) {
    const grado = await gradoDao.findById(idGrado);
    if (!grado) {
      const error = new Error("Grado no encontrado");
      error.statusCode = 404;
      throw error;
    }
    if (Number(grado.anio_lectivo) !== anioLectivo) {
      const error = new Error("El grado no pertenece al año lectivo indicado");
      error.statusCode = 400;
      throw error;
    }
  }

  const periodo = PERIODOS_CANONICOS[bimestre];
  const anterior = await auditoriaDao.findActaPorClave(
    anioLectivo,
    bimestre,
    idGrado,
  );

  if (anterior?.estado === "CERRADO") {
    const error = new Error("El acta ya está cerrada.");
    error.statusCode = 409;
    throw error;
  }

  const acta = await auditoriaDao.cerrarActa({
    periodo,
    anio_lectivo: anioLectivo,
    bimestre,
    id_grado: idGrado,
    cerrado_por: data.cerrado_por,
  });

  if (!acta) {
    const error = new Error("El acta ya está cerrada.");
    error.statusCode = 409;
    throw error;
  }

  return {
    ...acta,
    estado_anterior: anterior?.estado || "NO_EXISTIA",
  };
};

const reabrirActa = async (id_acta, data) => {
  const id = Number(id_acta);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Acta inválida");
    error.statusCode = 400;
    throw error;
  }

  const motivo = String(data?.motivo || "").trim();
  if (motivo.length < 10) {
    const error = new Error(
      "El motivo de reapertura debe tener al menos 10 caracteres.",
    );
    error.statusCode = 400;
    throw error;
  }
  if (motivo.length > 250) {
    const error = new Error(
      "El motivo de reapertura no puede superar los 250 caracteres.",
    );
    error.statusCode = 400;
    throw error;
  }
  if (!data?.id_usuario) {
    const error = new Error("Falta el usuario que reabre el acta");
    error.statusCode = 400;
    throw error;
  }

  const acta = await auditoriaDao.findActaById(id);
  if (!acta) {
    const error = new Error("Acta no encontrada");
    error.statusCode = 404;
    throw error;
  }
  if (acta.estado !== "CERRADO") {
    const error = new Error("El acta no está cerrada.");
    error.statusCode = 409;
    throw error;
  }

  const reabierta = await auditoriaDao.reabrirActa(id, {
    motivo,
    id_usuario: data.id_usuario,
  });

  if (!reabierta) {
    const error = new Error("El acta no está cerrada.");
    error.statusCode = 409;
    throw error;
  }

  return {
    ...reabierta,
    estado_anterior: "CERRADO",
  };
};

const getEstadisticas = async () => {
  return await auditoriaDao.getEstadisticas();
};

module.exports = {
  registrar,
  registrarSeguro,
  registrarEnTransaccion,
  listarBitacora,
  contarBitacora,
  obtenerBitacora,
  listarModulos,
  listarActas,
  obtenerActa,
  cerrarActa,
  reabrirActa,
  getEstadisticas,
};
