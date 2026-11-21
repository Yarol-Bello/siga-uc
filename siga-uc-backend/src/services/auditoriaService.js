/**
 * Servicio de Auditoría y Actas
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const auditoriaDao = require("../dao/auditoriaDao");

const listarBitacora = async (filtros) => {
  return await auditoriaDao.listarBitacora(filtros);
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
  listarBitacora,
  obtenerBitacora,
  listarModulos,
  listarActas,
  obtenerActa,
  cerrarActa,
  getEstadisticas,
};
