/**
 * Servicio de Auditoría y Actas
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const auditoriaDao = require("../dao/auditoriaDao");

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
  if (!data.periodo || !data.anio_lectivo) {
    const error = new Error("Faltan campos: periodo, anio_lectivo");
    error.statusCode = 400;
    throw error;
  }
  if (!data.cerrado_por) {
    const error = new Error("Falta el usuario que cierra el acta");
    error.statusCode = 400;
    throw error;
  }
  return await auditoriaDao.cerrarActa(data);
};

const getEstadisticas = async () => {
  return await auditoriaDao.getEstadisticas();
};

module.exports = {
  registrar,
  registrarSeguro,
  listarBitacora,
  contarBitacora,
  obtenerBitacora,
  listarModulos,
  listarActas,
  obtenerActa,
  cerrarActa,
  getEstadisticas,
};
