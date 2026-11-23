/**
 * Servicio de períodos de clase (H47)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const periodoClaseDao = require("../dao/periodoClaseDao");
const configuracionAnioService = require("./configuracionAnioService");
const { TIPOS_PERIODO } = require("../config/horarios");

const crearError = (mensaje, statusCode = 400, details = null) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

const parseEntero = (valor) => {
  const numero = Number.parseInt(valor, 10);
  return Number.isInteger(numero) ? numero : null;
};

const validarAnio = (valor) => {
  const anio = parseEntero(valor);
  if (!anio || anio < 2000 || anio > 2100) {
    throw crearError("El año lectivo debe estar entre 2000 y 2100.");
  }
  return anio;
};

const normalizarHora = (valor, campo) => {
  const hora = String(valor || "").trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) {
    throw crearError(`La ${campo} debe tener formato HH:MM.`);
  }
  return hora.length === 5 ? `${hora}:00` : hora;
};

const normalizarDatos = (data) => {
  const anio_lectivo = validarAnio(data.anio_lectivo ?? data.anio);
  const nombre = String(data.nombre || "").trim();
  if (!nombre) {
    throw crearError("El nombre del período es obligatorio.");
  }
  if (nombre.length > 30) {
    throw crearError("El nombre del período no puede superar los 30 caracteres.");
  }

  const orden = parseEntero(data.orden);
  if (!orden || orden <= 0) {
    throw crearError("El orden del período debe ser un entero mayor que cero.");
  }

  const hora_inicio = normalizarHora(data.hora_inicio, "hora de inicio");
  const hora_fin = normalizarHora(data.hora_fin, "hora de fin");
  if (hora_fin <= hora_inicio) {
    throw crearError("La hora de fin debe ser mayor que la hora de inicio.");
  }

  const tipo = String(data.tipo || "").trim().toUpperCase();
  if (!TIPOS_PERIODO.includes(tipo)) {
    throw crearError("El tipo debe ser CLASE, RECREO o ALMUERZO.");
  }

  const activo =
    data.activo === undefined
      ? true
      : data.activo === true ||
        data.activo === "true" ||
        data.activo === 1 ||
        data.activo === "1";

  return {
    anio_lectivo,
    nombre,
    orden,
    hora_inicio,
    hora_fin,
    tipo,
    activo,
  };
};

const listar = async (anio) => {
  return await periodoClaseDao.listarPorAnio(validarAnio(anio));
};

const obtener = async (id) => {
  const periodo = await periodoClaseDao.findById(id);
  if (!periodo) {
    throw crearError("Período de clase no encontrado.", 404);
  }
  return periodo;
};

const validarJornada = async (datos) => {
  const configuracion = await configuracionAnioService.obtenerEfectiva(
    datos.anio_lectivo,
  );
  if (
    datos.hora_inicio < configuracion.hora_inicio_jornada ||
    datos.hora_fin > configuracion.hora_fin_jornada
  ) {
    throw crearError(
      `El período debe estar dentro de la jornada ${configuracion.hora_inicio_jornada.substring(0, 5)}–${configuracion.hora_fin_jornada.substring(0, 5)}.`,
      400,
      { codigo: "PERIODO_FUERA_JORNADA" },
    );
  }
  if (datos.tipo === "CLASE") {
    const inicio = datos.hora_inicio.split(":").map(Number);
    const fin = datos.hora_fin.split(":").map(Number);
    const minutos =
      fin[0] * 60 + fin[1] - (inicio[0] * 60 + inicio[1]);
    if (minutos < configuracion.duracion_min_bloque) {
      throw crearError(
        `El bloque de clase debe durar al menos ${configuracion.duracion_min_bloque} minutos.`,
        400,
        { codigo: "DURACION_MINIMA", minimo: configuracion.duracion_min_bloque },
      );
    }
  }
};

const crear = async (data) => {
  const datos = normalizarDatos(data);
  await validarJornada(datos);

  const ordenExistente = await periodoClaseDao.findByOrden(
    datos.anio_lectivo,
    datos.orden,
  );
  if (ordenExistente) {
    throw crearError(
      `Ya existe el período "${ordenExistente.nombre}" con el orden ${datos.orden} en ${datos.anio_lectivo}.`,
      409,
    );
  }

  const solape = await periodoClaseDao.existeSolape(
    datos.anio_lectivo,
    datos.hora_inicio,
    datos.hora_fin,
  );
  if (solape) {
    throw crearError(
      `El período se solapa con "${solape.nombre}" (${solape.hora_inicio}–${solape.hora_fin}).`,
      409,
    );
  }

  try {
    return await periodoClaseDao.crear(datos);
  } catch (error) {
    if (error.code === "23505") {
      throw crearError(
        "Ya existe un período con ese orden en el año lectivo.",
        409,
      );
    }
    if (error.code === "23514") {
      throw crearError(
        error.message || "El período no cumple las reglas de la malla.",
        409,
      );
    }
    throw error;
  }
};

const actualizar = async (id, data) => {
  const actual = await obtener(id);
  const datos = normalizarDatos({
    anio_lectivo: data.anio_lectivo ?? actual.anio_lectivo,
    nombre: data.nombre ?? actual.nombre,
    orden: data.orden ?? actual.orden,
    hora_inicio: data.hora_inicio ?? actual.hora_inicio,
    hora_fin: data.hora_fin ?? actual.hora_fin,
    tipo: data.tipo ?? actual.tipo,
    activo: data.activo ?? actual.activo,
  });

  await validarJornada(datos);
  const enUso = await periodoClaseDao.contarHorarios(id);
  const cambiaEstructura =
    datos.anio_lectivo !== actual.anio_lectivo ||
    datos.hora_inicio !== actual.hora_inicio ||
    datos.hora_fin !== actual.hora_fin ||
    datos.tipo !== actual.tipo;

  if (enUso > 0 && cambiaEstructura) {
    throw crearError(
      "El período ya tiene bloques asignados. Solo puede cambiar su nombre, orden o estado activo.",
      409,
    );
  }

  const ordenExistente = await periodoClaseDao.findByOrden(
    datos.anio_lectivo,
    datos.orden,
    id,
  );
  if (ordenExistente) {
    throw crearError(
      `Ya existe el período "${ordenExistente.nombre}" con el orden ${datos.orden} en ${datos.anio_lectivo}.`,
      409,
    );
  }

  const solape = await periodoClaseDao.existeSolape(
    datos.anio_lectivo,
    datos.hora_inicio,
    datos.hora_fin,
    id,
  );
  if (solape) {
    throw crearError(
      `El período se solapa con "${solape.nombre}" (${solape.hora_inicio}–${solape.hora_fin}).`,
      409,
    );
  }

  try {
    const actualizado = await periodoClaseDao.actualizar(id, datos);
    if (!actualizado) {
      throw crearError("Período de clase no encontrado.", 404);
    }
    return actualizado;
  } catch (error) {
    if (error.code === "23505") {
      throw crearError(
        "Ya existe un período con ese orden en el año lectivo.",
        409,
      );
    }
    if (error.code === "23514") {
      throw crearError(
        error.message || "El período no cumple las reglas de la malla.",
        409,
      );
    }
    throw error;
  }
};

const eliminar = async (id) => {
  const periodo = await obtener(id);
  const enUso = await periodoClaseDao.contarHorarios(id);
  if (enUso > 0) {
    throw crearError(
      `No se puede eliminar "${periodo.nombre}": tiene ${enUso} bloque(s) asignado(s).`,
      409,
    );
  }
  const eliminado = await periodoClaseDao.eliminar(id);
  if (!eliminado) {
    throw crearError("Período de clase no encontrado.", 404);
  }
  return eliminado;
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
};
