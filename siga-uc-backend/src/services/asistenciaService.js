/**
 * Servicio de Asistencia
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const asistenciaDao = require("../dao/asistenciaDao");
const alumnoDao = require("../dao/alumnoDao");
const { getAnioLectivo } = require("../config/academico");

const parseAnioLectivo = (valor) => {
  if (valor === undefined || valor === null || valor === "") {
    return getAnioLectivo();
  }

  const anio = Number(valor);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    const error = new Error("El año lectivo debe estar entre 2000 y 2100.");
    error.statusCode = 400;
    throw error;
  }
  return anio;
};

const obtenerPorCursoFecha = async (
  id_curso,
  fecha,
  id_grado,
  idPersonal = null,
) => {
  if (!id_curso || !fecha || !id_grado) {
    const error = new Error("Faltan parámetros: id_curso, fecha, id_grado");
    error.statusCode = 400;
    throw error;
  }
  return await asistenciaDao.obtenerPorCursoFecha(
    id_curso,
    fecha,
    id_grado,
    idPersonal,
  );
};

const obtenerPorAlumno = async (id_alumno, filtros = {}, idPersonal = null) => {
  const anioLectivo = parseAnioLectivo(filtros.anio);
  await alumnoDao.validarMatriculaAnual(id_alumno, anioLectivo);

  return await asistenciaDao.obtenerPorAlumno(
    id_alumno,
    { ...filtros, anio: anioLectivo },
    idPersonal,
  );
};

const obtenerResumenPorAlumno = async (
  id_alumno,
  anioLectivo,
  idPersonal = null,
) => {
  const anio = parseAnioLectivo(anioLectivo);
  const alumno = await alumnoDao.validarMatriculaAnual(id_alumno, anio);

  const resumen = await asistenciaDao.obtenerResumenPorAlumno(
    id_alumno,
    anio,
    idPersonal,
  );
  const estadisticas = await asistenciaDao.obtenerEstadisticasAlumno(
    id_alumno,
    anio,
    idPersonal,
  );

  return {
    alumno: {
      id_alumno: alumno.id_alumno,
      nombre_completo: alumno.nombre_completo,
      dni: alumno.dni,
    },
    anio_lectivo: anio,
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
