/**
 * Servicio de gestión de alumnos
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const alumnoDao = require("../dao/alumnoDao");
const { getAnioLectivo } = require("../config/academico");

/**
 * Listar alumnos con filtros
 */
const listar = async (filtros) => {
  return await alumnoDao.listar(filtros);
};

/**
 * Contar alumnos con los mismos filtros del listado
 */
const contar = async (filtros) => {
  return await alumnoDao.contar(filtros);
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
const buscarPorDni = async (dni, anioLectivo = getAnioLectivo()) => {
  const alumno = await alumnoDao.findByDni(dni, anioLectivo);
  if (!alumno) {
    const error = new Error(
      `No se encontró matrícula del DNI ${dni} en el año lectivo ${anioLectivo}.`,
    );
    error.statusCode = 404;
    error.details = { codigo: "MATRICULA_NO_ENCONTRADA_EN_ANIO" };
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

  // El alta es solo para primera matrícula. Si la persona ya existe en
  // cualquier año, debe usarse el flujo de continuidad (6.3).
  const existentes = await alumnoDao.findByDniGlobal(data.dni);
  if (existentes.length > 0) {
    const error = new Error(
      "Ya existe una persona con ese DNI; para un nuevo año use el flujo de continuidad (6.3).",
    );
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
  contar,
  obtener,
  buscarPorDni,
  crear,
  actualizar,
  retirar,
};
