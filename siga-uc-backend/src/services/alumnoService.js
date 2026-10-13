/**
 * Servicio de gestión de alumnos
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const alumnoDao = require("../dao/alumnoDao");

/**
 * Listar alumnos con filtros
 */
const listar = async (filtros) => {
  return await alumnoDao.listar(filtros);
};

/**
 * Obtener alumno por ID
 */
const obtener = async (id) => {
  const alumno = await alumnoDao.findById(id);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return alumno;
};

/**
 * Buscar alumno por DNI
 */
const buscarPorDni = async (dni) => {
  const alumno = await alumnoDao.findByDni(dni);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return alumno;
};

/**
 * Registrar nueva matrícula
 */
const crear = async (data) => {
  // Validaciones de negocio
  if (
    !data.dni ||
    !data.nombres ||
    !data.apellidos ||
    !data.fecha_nacimiento ||
    !data.id_grado
  ) {
    const error = new Error(
      "Faltan campos obligatorios: dni, nombres, apellidos, fecha_nacimiento, id_grado",
    );
    error.statusCode = 400;
    throw error;
  }

  // Verificar que el DNI no exista
  const existente = await alumnoDao.findByDni(data.dni);
  if (existente) {
    const error = new Error("Ya existe un alumno con ese DNI");
    error.statusCode = 409;
    throw error;
  }

  return await alumnoDao.crear(data);
};

/**
 * Actualizar alumno
 */
const actualizar = async (id, data) => {
  const alumno = await alumnoDao.findById(id);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return await alumnoDao.actualizar(id, data);
};

/**
 * Registrar retiro
 */
const retirar = async (id, data) => {
  const alumno = await alumnoDao.findById(id);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }
  if (alumno.estado_matricula === "Retirado") {
    const error = new Error("El alumno ya está retirado");
    error.statusCode = 400;
    throw error;
  }
  return await alumnoDao.retirar(id, data);
};

module.exports = {
  listar,
  obtener,
  buscarPorDni,
  crear,
  actualizar,
  retirar,
};
