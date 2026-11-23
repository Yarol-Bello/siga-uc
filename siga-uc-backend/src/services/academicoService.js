/**
 * Servicio de gestión académica (grados, cursos, competencias)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const gradoDao = require("../dao/gradoDao");
const cursoDao = require("../dao/cursoDao");
const auditoriaService = require("./auditoriaService");
const { getClient } = require("../config/database");

/**
 * Listar todos los grados
 */
const listarGrados = async (anioLectivo) => {
  return await gradoDao.listar(anioLectivo);
};

/**
 * Obtener detalle de un grado (con tutor)
 */
const obtenerGrado = async (id_grado) => {
  const grado = await gradoDao.findById(id_grado);

  if (!grado) {
    const error = new Error("Grado no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const tutor = await gradoDao.getTutor(id_grado);

  return {
    ...grado,
    tutor,
  };
};

/**
 * Listar todos los cursos
 */
const listarCursos = async () => {
  return await cursoDao.listar();
};

/**
 * Obtener detalle de un curso (con competencias)
 */
const obtenerCurso = async (id_curso) => {
  const curso = await cursoDao.findById(id_curso);

  if (!curso) {
    const error = new Error("Curso no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const competencias = await cursoDao.listarCompetencias(id_curso);

  return {
    ...curso,
    competencias,
  };
};

/**
 * Listar competencias de un curso
 */
const listarCompetencias = async (id_curso) => {
  const curso = await cursoDao.findById(id_curso);
  if (!curso) {
    const error = new Error("Curso no encontrado");
    error.statusCode = 404;
    throw error;
  }

  return await cursoDao.listarCompetencias(id_curso);
};

/**
 * Listar escala de calificación
 */
const listarEscalaCalificacion = async () => {
  return await cursoDao.listarEscalaCalificacion();
};

const crearError = (mensaje, statusCode = 400, details = null) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

const parseEntero = (valor, campo, min, max, obligatorio = false) => {
  if (valor === undefined || valor === null || valor === "") {
    if (obligatorio) throw crearError(`El campo ${campo} es obligatorio.`);
    return null;
  }
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    throw crearError(`El campo ${campo} debe ser un entero entre ${min} y ${max}.`);
  }
  return numero;
};

const parseTexto = (valor, campo, max, obligatorio = false) => {
  if (valor === undefined) return undefined;
  if (valor === null) {
    if (obligatorio) throw crearError(`El campo ${campo} es obligatorio.`);
    return null;
  }
  const texto = String(valor).trim();
  if (!texto) {
    if (obligatorio) throw crearError(`El campo ${campo} es obligatorio.`);
    return null;
  }
  if (texto.length > max) {
    throw crearError(`El campo ${campo} no puede superar ${max} caracteres.`);
  }
  return texto;
};

const aBooleano = (valor, defecto = true) => {
  if (valor === undefined) return defecto;
  return valor === true || valor === "true" || valor === 1 || valor === "1";
};

const validarMotivo = (motivo) => {
  const texto = String(motivo || "").trim();
  if (texto.length < 10) {
    throw crearError("El motivo debe tener al menos 10 caracteres.", 400, {
      codigo: "MOTIVO_REQUERIDO",
    });
  }
  if (texto.length > 500) {
    throw crearError("El motivo no puede superar 500 caracteres.");
  }
  return texto;
};

const traducirErrorBd = (error) => {
  if (error?.statusCode) return error;
  if (error?.code === "23505") {
    return crearError(
      "Ya existe un registro con ese nombre u orden.",
      409,
      { codigo: "ACADEMICO_DUPLICADO" },
    );
  }
  if (error?.code === "23503") {
    return crearError(
      "El registro está en uso y no puede eliminarse.",
      409,
      { codigo: "ACADEMICO_EN_USO" },
    );
  }
  return error;
};

const conTransaccion = async (fn) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const resultado = await fn(client);
    await client.query("COMMIT");
    return resultado;
  } catch (error) {
    await client.query("ROLLBACK");
    throw traducirErrorBd(error);
  } finally {
    client.release();
  }
};

const auditar = async (client, usuario, accion, descripcion, anterior, nuevo, motivo, ip) => {
  await auditoriaService.registrarEnTransaccion(client, {
    id_usuario: usuario?.id_usuario || null,
    modulo: "Configuración",
    accion,
    descripcion,
    anterior,
    nuevo,
    motivo,
    ip,
  });
};

const listarAreas = async (incluirInactivas = false) =>
  await cursoDao.listarAreas(incluirInactivas);

const crearArea = async (data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const nombre = parseTexto(data.nombre, "nombre", 50, true);
  const orden = parseEntero(data.orden ?? 0, "orden", 0, 999999) ?? 0;
  const activo = aBooleano(data.activo, true);

  return await conTransaccion(async (client) => {
    const creada = await cursoDao.crearArea({
      nombre,
      orden,
      activo,
      id_usuario: usuario?.id_usuario || null,
    });
    await auditar(
      client,
      usuario,
      "CREAR",
      `Área académica ${creada.nombre}`,
      null,
      creada,
      motivo,
      ip,
    );
    return creada;
  });
};

const actualizarArea = async (id, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const actual = await cursoDao.findAreaById(id);
  if (!actual) throw crearError("Área académica no encontrada.", 404);

  const nombre = parseTexto(
    data.nombre !== undefined ? data.nombre : actual.nombre,
    "nombre",
    50,
    true,
  );
  const orden = parseEntero(
    data.orden !== undefined ? data.orden : actual.orden,
    "orden",
    0,
    999999,
  );
  const activo = aBooleano(
    data.activo !== undefined ? data.activo : actual.activo,
    actual.activo,
  );

  if (nombre !== actual.nombre) {
    const enUso = await cursoDao.contarCursosPorArea(actual.nombre);
    if (enUso > 0) {
      throw crearError(
        `El área "${actual.nombre}" tiene ${enUso} curso(s). No se puede renombrar; cree otra área y reasigne los cursos.`,
        409,
        { codigo: "AREA_CON_CURSOS", cursos: enUso },
      );
    }
  }

  return await conTransaccion(async (client) => {
    const actualizada = await cursoDao.actualizarArea(id, {
      nombre,
      orden,
      activo,
      id_usuario: usuario?.id_usuario || null,
    });
    await auditar(
      client,
      usuario,
      "MODIFICAR",
      `Área académica ${actualizada.nombre}`,
      actual,
      actualizada,
      motivo,
      ip,
    );
    return actualizada;
  });
};

const eliminarArea = async (id, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const actual = await cursoDao.findAreaById(id);
  if (!actual) throw crearError("Área académica no encontrada.", 404);
  const enUso = await cursoDao.contarCursosPorArea(actual.nombre);
  if (enUso > 0) {
    throw crearError(
      `El área "${actual.nombre}" tiene ${enUso} curso(s) y no se puede eliminar.`,
      409,
      { codigo: "AREA_CON_CURSOS", cursos: enUso },
    );
  }

  return await conTransaccion(async (client) => {
    const eliminada = await cursoDao.eliminarArea(id);
    await auditar(
      client,
      usuario,
      "ELIMINAR",
      `Área académica ${actual.nombre}`,
      actual,
      null,
      motivo,
      ip,
    );
    return eliminada;
  });
};

const listarCursosAdmin = async (incluirInactivos = true) =>
  await cursoDao.listarAdmin(incluirInactivos);

const crearCurso = async (data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const nombre = parseTexto(data.nombre_curso, "nombre del curso", 100, true);
  const area = parseTexto(data.area_academica, "área académica", 50, true);
  const horas = parseEntero(
    data.horas_semanales,
    "horas semanales",
    1,
    99,
    false,
  );
  const orden = parseEntero(data.orden ?? 0, "orden", 0, 999999) ?? 0;
  const activo = aBooleano(data.activo, true);
  const descripcion = parseTexto(data.descripcion, "descripción", 250);

  const areas = await cursoDao.listarAreas(true);
  if (!areas.some((item) => item.nombre === area)) {
    throw crearError(`El área "${area}" no existe en el catálogo.`);
  }

  return await conTransaccion(async (client) => {
    const creado = await cursoDao.crearCurso({
      nombre_curso: nombre,
      area_academica: area,
      horas_semanales: horas,
      activo,
      orden,
      descripcion,
      id_usuario: usuario?.id_usuario || null,
    });
    await auditar(
      client,
      usuario,
      "CREAR",
      `Curso ${creado.nombre_curso}`,
      null,
      creado,
      motivo,
      ip,
    );
    return creado;
  });
};

const actualizarCurso = async (id, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const actual = await cursoDao.findById(id);
  if (!actual) throw crearError("Curso no encontrado.", 404);

  const nombre = parseTexto(
    data.nombre_curso !== undefined ? data.nombre_curso : actual.nombre_curso,
    "nombre del curso",
    100,
    true,
  );
  const area = parseTexto(
    data.area_academica !== undefined ? data.area_academica : actual.area_academica,
    "área académica",
    50,
    true,
  );
  const horas = parseEntero(
    data.horas_semanales !== undefined
      ? data.horas_semanales
      : actual.horas_semanales,
    "horas semanales",
    1,
    99,
  );
  const orden = parseEntero(
    data.orden !== undefined ? data.orden : actual.orden,
    "orden",
    0,
    999999,
  );
  const activo = aBooleano(
    data.activo !== undefined ? data.activo : actual.activo,
    actual.activo,
  );
  const descripcion = parseTexto(
    data.descripcion !== undefined ? data.descripcion : actual.descripcion,
    "descripción",
    250,
  );

  const areas = await cursoDao.listarAreas(true);
  if (!areas.some((item) => item.nombre === area)) {
    throw crearError(`El área "${area}" no existe en el catálogo.`);
  }

  const dependencias = await cursoDao.contarDependenciasCurso(id);
  const totalDependencias = Object.values(dependencias).reduce(
    (total, valor) => total + Number(valor || 0),
    0,
  );
  if (
    totalDependencias > 0 &&
    (nombre !== actual.nombre_curso || area !== actual.area_academica)
  ) {
    throw crearError(
      "El curso tiene historial. No se puede renombrar ni cambiar de área; desactívelo y cree uno nuevo.",
      409,
      { codigo: "CURSO_CON_HISTORIAL", ...dependencias },
    );
  }

  return await conTransaccion(async (client) => {
    const actualizado = await cursoDao.actualizarCurso(id, {
      nombre_curso: nombre,
      area_academica: area,
      horas_semanales: horas,
      activo,
      orden,
      descripcion,
      id_usuario: usuario?.id_usuario || null,
    });
    await auditar(
      client,
      usuario,
      "MODIFICAR",
      `Curso ${actualizado.nombre_curso}`,
      actual,
      actualizado,
      motivo,
      ip,
    );
    return actualizado;
  });
};

const eliminarCurso = async (id, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const actual = await cursoDao.findById(id);
  if (!actual) throw crearError("Curso no encontrado.", 404);
  const dependencias = await cursoDao.contarDependenciasCurso(id);
  const total = Object.values(dependencias).reduce(
    (suma, valor) => suma + Number(valor || 0),
    0,
  );
  if (total > 0) {
    throw crearError(
      "El curso tiene carga, horarios, notas, asistencia o competencias asociadas. Desactívelo en lugar de eliminarlo.",
      409,
      { codigo: "CURSO_CON_DEPENDENCIAS", ...dependencias },
    );
  }

  return await conTransaccion(async (client) => {
    const eliminado = await cursoDao.eliminarCurso(id);
    await auditar(
      client,
      usuario,
      "ELIMINAR",
      `Curso ${actual.nombre_curso}`,
      actual,
      null,
      motivo,
      ip,
    );
    return eliminado;
  });
};

const listarCompetenciasAdmin = async (idCurso, incluirInactivas = true) => {
  const curso = await cursoDao.findById(idCurso);
  if (!curso) throw crearError("Curso no encontrado.", 404);
  return await cursoDao.listarCompetencias(idCurso, incluirInactivas);
};

const crearCompetencia = async (idCurso, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const curso = await cursoDao.findById(idCurso);
  if (!curso) throw crearError("Curso no encontrado.", 404);
  const nombre = parseTexto(
    data.nombre_competencia,
    "nombre de la competencia",
    250,
    true,
  );
  const orden = parseEntero(data.orden, "orden", 1, 999999, true);
  const activo = aBooleano(data.activo, true);
  const descripcion = parseTexto(data.descripcion, "descripción", 250);

  return await conTransaccion(async (client) => {
    const creada = await cursoDao.crearCompetencia({
      id_curso: idCurso,
      nombre_competencia: nombre,
      orden,
      activo,
      descripcion,
      id_usuario: usuario?.id_usuario || null,
    });
    await auditar(
      client,
      usuario,
      "CREAR",
      `Competencia ${creada.nombre_competencia} (${curso.nombre_curso})`,
      null,
      creada,
      motivo,
      ip,
    );
    return creada;
  });
};

const actualizarCompetencia = async (id, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const actual = await cursoDao.findCompetenciaById(id);
  if (!actual) throw crearError("Competencia no encontrada.", 404);

  const nombre = parseTexto(
    data.nombre_competencia !== undefined
      ? data.nombre_competencia
      : actual.nombre_competencia,
    "nombre de la competencia",
    250,
    true,
  );
  const orden = parseEntero(
    data.orden !== undefined ? data.orden : actual.orden,
    "orden",
    1,
    999999,
  );
  const activo = aBooleano(
    data.activo !== undefined ? data.activo : actual.activo,
    actual.activo,
  );
  const descripcion = parseTexto(
    data.descripcion !== undefined ? data.descripcion : actual.descripcion,
    "descripción",
    250,
  );

  const calificaciones = await cursoDao.contarCalificacionesCompetencia(id);
  if (calificaciones > 0 && nombre !== actual.nombre_competencia) {
    throw crearError(
      "La competencia tiene calificaciones. No se puede renombrar; desactívela y cree una nueva.",
      409,
      { codigo: "COMPETENCIA_CON_NOTAS", calificaciones },
    );
  }

  return await conTransaccion(async (client) => {
    const actualizada = await cursoDao.actualizarCompetencia(id, {
      nombre_competencia: nombre,
      orden,
      activo,
      descripcion,
      id_usuario: usuario?.id_usuario || null,
    });
    await auditar(
      client,
      usuario,
      "MODIFICAR",
      `Competencia ${actualizada.nombre_competencia}`,
      actual,
      actualizada,
      motivo,
      ip,
    );
    return actualizada;
  });
};

const eliminarCompetencia = async (id, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const actual = await cursoDao.findCompetenciaById(id);
  if (!actual) throw crearError("Competencia no encontrada.", 404);
  const calificaciones = await cursoDao.contarCalificacionesCompetencia(id);
  if (calificaciones > 0) {
    throw crearError(
      "La competencia tiene calificaciones y no se puede eliminar. Desactívela.",
      409,
      { codigo: "COMPETENCIA_CON_NOTAS", calificaciones },
    );
  }

  return await conTransaccion(async (client) => {
    const eliminada = await cursoDao.eliminarCompetencia(id);
    await auditar(
      client,
      usuario,
      "ELIMINAR",
      `Competencia ${actual.nombre_competencia}`,
      actual,
      null,
      motivo,
      ip,
    );
    return eliminada;
  });
};

module.exports = {
  listarGrados,
  obtenerGrado,
  listarCursos,
  obtenerCurso,
  listarCompetencias,
  listarEscalaCalificacion,
  listarAreas,
  crearArea,
  actualizarArea,
  eliminarArea,
  listarCursosAdmin,
  crearCurso,
  actualizarCurso,
  eliminarCurso,
  listarCompetenciasAdmin,
  crearCompetencia,
  actualizarCompetencia,
  eliminarCompetencia,
};
