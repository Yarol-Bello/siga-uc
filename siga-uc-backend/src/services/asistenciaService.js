/**
 * Servicio de Asistencia
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const asistenciaDao = require("../dao/asistenciaDao");
const alumnoDao = require("../dao/alumnoDao");

const obtenerPorCursoFecha = async (id_curso, fecha, id_grado) => {
  if (!id_curso || !fecha || !id_grado) {
    const error = new Error("Faltan parámetros: id_curso, fecha, id_grado");
    error.statusCode = 400;
    throw error;
  }
  return await asistenciaDao.obtenerPorCursoFecha(id_curso, fecha, id_grado);
};

const obtenerPorAlumno = async (id_alumno, filtros) => {
  const alumno = await alumnoDao.findById(id_alumno);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return await asistenciaDao.obtenerPorAlumno(id_alumno, filtros);
};

const obtenerResumenPorAlumno = async (id_alumno) => {
  const alumno = await alumnoDao.findById(id_alumno);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const resumen = await asistenciaDao.obtenerResumenPorAlumno(id_alumno);
  const estadisticas = await asistenciaDao.obtenerEstadisticasAlumno(id_alumno);

  return {
    alumno: {
      id_alumno: alumno.id_alumno,
      nombre_completo: alumno.nombre_completo,
      dni: alumno.dni,
    },
    estadisticas,
    por_curso: resumen,
  };
};

const registrar = async (data) => {
  if (!data.id_alumno || !data.id_curso || !data.fecha || !data.estado) {
    const error = new Error(
      "Faltan campos: id_alumno, id_curso, fecha, estado",
    );
    error.statusCode = 400;
    throw error;
  }
  if (!["P", "T", "F"].includes(data.estado)) {
    const error = new Error("Estado inválido. Debe ser P, T o F");
    error.statusCode = 400;
    throw error;
  }
  return await asistenciaDao.registrar(data);
};

const registrarMasivo = async (registros) => {
  if (!Array.isArray(registros) || registros.length === 0) {
    const error = new Error("Debe enviar al menos un registro");
    error.statusCode = 400;
    throw error;
  }
  return await asistenciaDao.registrarMasivo(registros);
};

// ============================================================
// ASISTENCIA DE PERSONAL
// ============================================================

const listarAsistenciaPersonal = async (fecha) => {
  if (!fecha) {
    const error = new Error("La fecha es obligatoria");
    error.statusCode = 400;
    throw error;
  }
  return await asistenciaDao.listarAsistenciaPersonal(fecha);
};

const buscarPersonalPorDni = async (dni) => {
  const personal = await asistenciaDao.buscarPersonalPorDni(dni);
  if (!personal) {
    const error = new Error("Personal no encontrado con ese DNI");
    error.statusCode = 404;
    throw error;
  }
  if (personal.estado !== "ACTIVO") {
    const error = new Error("El personal no está activo en el sistema");
    error.statusCode = 400;
    throw error;
  }
  return personal;
};

const registrarAsistenciaPersonal = async (data) => {
  if (!data.id_personal || !data.fecha) {
    const error = new Error("Faltan campos: id_personal, fecha");
    error.statusCode = 400;
    throw error;
  }
  if (!["Puntual", "Tardanza", "Falta"].includes(data.estado || "Puntual")) {
    const error = new Error(
      "Estado inválido. Debe ser: Puntual, Tardanza o Falta",
    );
    error.statusCode = 400;
    throw error;
  }
  return await asistenciaDao.registrarAsistenciaPersonal(data);
};

const obtenerResumenAsistenciaPersonal = async (fecha) => {
  if (!fecha) {
    const error = new Error("La fecha es obligatoria");
    error.statusCode = 400;
    throw error;
  }
  return await asistenciaDao.obtenerResumenAsistenciaPersonal(fecha);
};

module.exports = {
  obtenerPorCursoFecha,
  obtenerPorAlumno,
  obtenerResumenPorAlumno,
  registrar,
  registrarMasivo,
  listarAsistenciaPersonal,
  buscarPersonalPorDni,
  registrarAsistenciaPersonal,
  obtenerResumenAsistenciaPersonal,
};
