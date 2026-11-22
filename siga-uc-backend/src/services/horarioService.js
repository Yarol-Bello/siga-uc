/**
 * Servicio de horarios (H47)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { getClient } = require("../config/database");
const { getAnioLectivo } = require("../config/academico");
const horarioDao = require("../dao/horarioDao");
const periodoClaseDao = require("../dao/periodoClaseDao");
const {
  DIAS_SEMANA,
  ESTADOS_HORARIO,
  HORAS_DEFAULT_CARGA,
  MAX_BLOQUES_CURSO_DIA,
} = require("../config/horarios");

const crearError = (mensaje, statusCode = 400, details = null) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

const parseEntero = (valor) => {
  const numero = Number.parseInt(valor, 10);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
};

const parseFiltro = (valor, nombre) => {
  if (valor === undefined || valor === null || valor === "") return null;
  const numero = parseEntero(valor);
  if (!numero) {
    throw crearError(`El filtro ${nombre} debe ser un entero mayor que cero.`);
  }
  return numero;
};

const validarAnio = (valor = getAnioLectivo()) => {
  const anio = parseEntero(valor);
  if (!anio || anio < 2000 || anio > 2100) {
    throw crearError("El año lectivo debe estar entre 2000 y 2100.");
  }
  return anio;
};

const normalizarAula = (valor) => {
  if (valor === undefined || valor === null) return null;
  const aula = String(valor).trim();
  if (!aula) return null;
  if (aula.length > 50) {
    throw crearError("El aula no puede superar los 50 caracteres.");
  }
  return aula;
};

const normalizarBooleano = (valor) =>
  valor === true || valor === "true" || valor === 1 || valor === "1";

const traducirError = (error) => {
  if (error?.statusCode) return error;
  if (error?.code === "23505") {
    return crearError(
      "Ya existe un bloque para ese grado, docente o aula en ese día y período.",
      409,
      { codigo: "CONFLICTO_HORARIO" },
    );
  }
  if (error?.code === "23514") {
    return crearError(
      error.message || "El bloque no cumple las reglas del horario.",
      409,
      { codigo: "REGLA_HORARIO" },
    );
  }
  if (error?.code === "23503") {
    return crearError(
      "La carga, el período o el usuario ya no existe.",
      409,
      { codigo: "REFERENCIA_INVALIDA" },
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
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("❌ Error al revertir transacción de horarios:", rollbackError.message);
    }
    throw traducirError(error);
  } finally {
    client.release();
  }
};

const bloquearAnio = async (client, anio) => {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `horarios:${anio}`,
  ]);
};

const listar = async (filtros = {}) => {
  const anio = validarAnio(filtros.anio);
  const idGrado = parseFiltro(filtros.id_grado, "id_grado");
  const idPersonal = parseFiltro(filtros.id_personal, "id_personal");

  let estado = null;
  if (filtros.estado) {
    estado = String(filtros.estado).trim().toUpperCase();
    if (!ESTADOS_HORARIO.includes(estado)) {
      throw crearError("El estado debe ser BORRADOR o PUBLICADO.");
    }
  }

  const bloques = await horarioDao.listar({
    anio,
    id_grado: idGrado,
    id_personal: idPersonal,
    estado,
  });
  const periodos = await periodoClaseDao.listarPorAnio(anio);

  return {
    anio,
    periodos,
    bloques,
    resumen: {
      total: bloques.length,
      publicados: bloques.filter((b) => b.estado === "PUBLICADO").length,
      borradores: bloques.filter((b) => b.estado === "BORRADOR").length,
    },
  };
};

const obtener = async (id) => {
  const bloque = await horarioDao.findById(id);
  if (!bloque) {
    throw crearError("Bloque de horario no encontrado.", 404);
  }
  return bloque;
};

const miHorario = async (usuario) => {
  if (!usuario?.rol) {
    throw crearError("Usuario no autenticado.", 401);
  }

  if (usuario.rol === "ADMIN" || usuario.rol === "SECRETARIA") {
    throw crearError(
      "El horario personal es solo para docentes y estudiantes. Use el listado administrativo.",
      400,
    );
  }

  if (usuario.rol === "DOCENTE") {
    if (!usuario.id_personal) {
      throw crearError("El usuario docente no tiene ficha de personal.", 403);
    }

    const anio = getAnioLectivo();
    const bloques = await horarioDao.listar({
      anio,
      id_personal: usuario.id_personal,
      estado: "PUBLICADO",
    });
    const periodos = await periodoClaseDao.listarPorAnio(anio);

    return {
      anio,
      alcance: "DOCENTE",
      id_personal: usuario.id_personal,
      docente: usuario.nombre_completo || null,
      publicado: bloques.length > 0,
      periodos,
      bloques,
    };
  }

  if (usuario.rol === "ESTUDIANTE") {
    const alumno = await horarioDao.getAlumnoGrado(usuario.id_usuario);
    if (!alumno || !alumno.id_grado) {
      throw crearError("El estudiante no tiene un grado asignado.", 404);
    }

    const anio = Number(alumno.anio_lectivo) || getAnioLectivo();
    const bloques = await horarioDao.listar({
      anio,
      id_grado: alumno.id_grado,
      estado: "PUBLICADO",
    });
    const periodos = await periodoClaseDao.listarPorAnio(anio);

    return {
      anio,
      alcance: "ESTUDIANTE",
      id_alumno: alumno.id_alumno,
      id_grado: alumno.id_grado,
      grado: alumno.nombre_grado,
      seccion: alumno.seccion,
      nivel: alumno.nivel,
      publicado: bloques.length > 0,
      periodos,
      bloques,
    };
  }

  throw crearError("Rol no autorizado para consultar un horario personal.", 403);
};

const prepararBloque = async (
  data,
  { actualizar = false, periodoActualId = null } = {},
) => {
  const idCarga = parseEntero(data.id_carga);
  if (!idCarga) {
    throw crearError("Debe seleccionar una carga curricular válida.");
  }

  const carga = await horarioDao.getCarga(idCarga);
  if (!carga) {
    throw crearError("Carga curricular no encontrada.", 404);
  }

  const anio = Number(carga.anio_lectivo);
  if (anio !== getAnioLectivo()) {
    throw crearError("Solo se puede programar el año lectivo activo.");
  }
  if (Number(carga.grado_anio) !== anio) {
    throw crearError("El grado de la carga no corresponde al año lectivo.");
  }

  const diaSemana = String(data.dia_semana || "").trim();
  if (!DIAS_SEMANA.includes(diaSemana)) {
    throw crearError(
      `El día debe ser uno de: ${DIAS_SEMANA.join(", ")}.`,
    );
  }

  const idPeriodo = parseEntero(data.id_periodo);
  if (!idPeriodo) {
    throw crearError("Debe seleccionar un período de clase válido.");
  }

  const periodo = await horarioDao.getPeriodo(idPeriodo);
  if (!periodo) {
    throw crearError("Período de clase no encontrado.", 404);
  }
  if (Number(periodo.anio_lectivo) !== anio) {
    throw crearError("El período no corresponde al año lectivo de la carga.");
  }
  if (periodo.tipo !== "CLASE") {
    throw crearError("El período seleccionado no es de clase.");
  }

  const mismoPeriodo = Number(periodoActualId) === Number(idPeriodo);
  if (!periodo.activo && !(actualizar && mismoPeriodo)) {
    throw crearError("El período seleccionado está inactivo.");
  }

  return {
    id_carga: carga.id_carga,
    id_grado: carga.id_grado,
    id_curso: carga.id_curso,
    id_personal: carga.id_personal,
    anio_lectivo: anio,
    dia_semana: diaSemana,
    id_periodo: periodo.id_periodo,
    periodo_nombre: periodo.nombre,
    nombre_curso: carga.nombre_curso,
    nombre_grado: carga.nombre_grado,
    seccion: carga.seccion,
    docente_nombre: carga.docente_nombre,
    aula: normalizarAula(data.aula),
  };
};

const validarConflictos = async (client, bloque, excluirId = null) => {
  const conflictoGrado = await horarioDao.findConflictoGrado(client, {
    anio: bloque.anio_lectivo,
    idGrado: bloque.id_grado,
    diaSemana: bloque.dia_semana,
    idPeriodo: bloque.id_periodo,
    excluirId,
  });
  if (conflictoGrado) {
    throw crearError(
      `El ${conflictoGrado.nombre_grado} ${conflictoGrado.seccion} ya tiene un bloque en ${bloque.dia_semana}, ${conflictoGrado.periodo_nombre}.`,
      409,
      { codigo: "CONFLICTO_GRADO", tipo: "GRADO", ...conflictoGrado },
    );
  }

  const conflictoDocente = await horarioDao.findConflictoDocente(client, {
    anio: bloque.anio_lectivo,
    idPersonal: bloque.id_personal,
    diaSemana: bloque.dia_semana,
    idPeriodo: bloque.id_periodo,
    excluirId,
  });
  if (conflictoDocente) {
    throw crearError(
      `El docente ${conflictoDocente.docente_nombre} ya tiene ${conflictoDocente.nombre_grado} ${conflictoDocente.seccion} en ${bloque.dia_semana}, ${conflictoDocente.periodo_nombre}.`,
      409,
      { codigo: "CONFLICTO_DOCENTE", tipo: "DOCENTE", ...conflictoDocente },
    );
  }

  if (bloque.aula) {
    const conflictoAula = await horarioDao.findConflictoAula(client, {
      anio: bloque.anio_lectivo,
      aula: bloque.aula,
      diaSemana: bloque.dia_semana,
      idPeriodo: bloque.id_periodo,
      excluirId,
    });
    if (conflictoAula) {
      throw crearError(
        `El aula ${bloque.aula} ya está ocupada en ${bloque.dia_semana}, ${conflictoAula.periodo_nombre}.`,
        409,
        { codigo: "CONFLICTO_AULA", tipo: "AULA", ...conflictoAula },
      );
    }
  }

  const bloquesCursoDia = await horarioDao.contarCursoDia(client, {
    anio: bloque.anio_lectivo,
    idGrado: bloque.id_grado,
    idCurso: bloque.id_curso,
    diaSemana: bloque.dia_semana,
    excluirId,
  });
  if (bloquesCursoDia >= MAX_BLOQUES_CURSO_DIA) {
    throw crearError(
      `El curso ${bloque.nombre_curso} ya tiene ${MAX_BLOQUES_CURSO_DIA} bloques el ${bloque.dia_semana}.`,
      409,
      {
        codigo: "MAX_CURSO_DIA",
        tipo: "MAX_CURSO_DIA",
        maximo: MAX_BLOQUES_CURSO_DIA,
        programados: bloquesCursoDia,
      },
    );
  }
};

const crear = async (data, usuario) => {
  const bloque = await prepararBloque(data);
  const confirmar = normalizarBooleano(data.confirmar);

  return await conTransaccion(async (client) => {
    await bloquearAnio(client, bloque.anio_lectivo);

    const alcance = await horarioDao.contarPorAlcance(
      bloque.anio_lectivo,
      bloque.id_grado,
      client,
    );
    if (alcance.publicados > 0) {
      if (!confirmar) {
        throw crearError(
          `El horario de ${bloque.nombre_grado} ${bloque.seccion} está publicado. Confirma para volverlo a borrador y agregar el bloque.`,
          409,
          {
            codigo: "HORARIO_PUBLICADO",
            publicados: alcance.publicados,
          },
        );
      }
      await horarioDao.cambiarEstadoAlcance(client, {
        anio: bloque.anio_lectivo,
        idGrado: bloque.id_grado,
        estado: "BORRADOR",
        idUsuario: usuario.id_usuario,
      });
    }

    await validarConflictos(client, bloque);
    const { id_horario } = await horarioDao.insertar(client, {
      ...bloque,
      id_usuario: usuario.id_usuario,
    });
    return await horarioDao.findById(id_horario, client);
  });
};

const actualizar = async (id, data, usuario) => {
  const actual = await obtener(id);

  if (Number(actual.anio_lectivo) !== getAnioLectivo()) {
    throw crearError("Solo se puede editar el año lectivo activo.");
  }

  const idCarga =
    data.id_carga !== undefined ? parseEntero(data.id_carga) : actual.id_carga;
  if (!idCarga) {
    throw crearError("Debe seleccionar una carga curricular válida.");
  }

  const bloque = await prepararBloque(
    {
      id_carga: idCarga,
      dia_semana: data.dia_semana ?? actual.dia_semana,
      id_periodo: data.id_periodo ?? actual.id_periodo,
      aula: data.aula !== undefined ? data.aula : actual.aula,
    },
    { actualizar: true, periodoActualId: actual.id_periodo },
  );

  if (Number(bloque.id_grado) !== Number(actual.id_grado)) {
    throw crearError(
      "Para mover un bloque a otro grado, elimínelo y créelo de nuevo en el grado destino.",
    );
  }

  const confirmar = normalizarBooleano(data.confirmar);

  return await conTransaccion(async (client) => {
    await bloquearAnio(client, actual.anio_lectivo);

    const alcance = await horarioDao.contarPorAlcance(
      actual.anio_lectivo,
      actual.id_grado,
      client,
    );
    if (alcance.publicados > 0) {
      if (!confirmar) {
        throw crearError(
          `El horario de ${actual.nombre_grado} ${actual.seccion} está publicado. Confirma para volverlo a borrador antes de editarlo.`,
          409,
          {
            codigo: "HORARIO_PUBLICADO",
            publicados: alcance.publicados,
          },
        );
      }
      await horarioDao.cambiarEstadoAlcance(client, {
        anio: actual.anio_lectivo,
        idGrado: actual.id_grado,
        estado: "BORRADOR",
        idUsuario: usuario.id_usuario,
      });
    }

    await validarConflictos(client, bloque, actual.id_horario);
    const actualizado = await horarioDao.actualizar(client, id, {
      ...bloque,
      id_usuario: usuario.id_usuario,
    });
    if (!actualizado) {
      throw crearError("Bloque de horario no encontrado.", 404);
    }
    return await horarioDao.findById(id, client);
  });
};

const eliminar = async (id, data, usuario) => {
  const actual = await obtener(id);

  if (Number(actual.anio_lectivo) !== getAnioLectivo()) {
    throw crearError("Solo se puede editar el año lectivo activo.");
  }

  const confirmar = normalizarBooleano(data?.confirmar);

  return await conTransaccion(async (client) => {
    await bloquearAnio(client, actual.anio_lectivo);

    const alcance = await horarioDao.contarPorAlcance(
      actual.anio_lectivo,
      actual.id_grado,
      client,
    );
    if (alcance.publicados > 0) {
      if (!confirmar) {
        throw crearError(
          `El horario de ${actual.nombre_grado} ${actual.seccion} está publicado. Confirma para volverlo a borrador antes de eliminar el bloque.`,
          409,
          {
            codigo: "HORARIO_PUBLICADO",
            publicados: alcance.publicados,
          },
        );
      }
      await horarioDao.cambiarEstadoAlcance(client, {
        anio: actual.anio_lectivo,
        idGrado: actual.id_grado,
        estado: "BORRADOR",
        idUsuario: usuario.id_usuario,
      });
    }

    const eliminado = await horarioDao.eliminar(client, id);
    if (!eliminado) {
      throw crearError("Bloque de horario no encontrado.", 404);
    }
    return actual;
  });
};

const publicar = async (data, usuario) => {
  const anio = validarAnio(data.anio);
  if (anio !== getAnioLectivo()) {
    throw crearError("Solo se puede publicar el año lectivo activo.");
  }
  const idGrado = parseFiltro(data.id_grado, "id_grado");
  const permitirParcial = normalizarBooleano(data.permitir_parcial);

  return await conTransaccion(async (client) => {
    await bloquearAnio(client, anio);

    const alcance = await horarioDao.contarPorAlcance(anio, idGrado, client);
    if (alcance.total === 0) {
      throw crearError("No hay bloques de horario para publicar.");
    }

    const faltantes = await horarioDao.faltantesPublicacion(client, {
      anio,
      idGrado,
      horasDefault: HORAS_DEFAULT_CARGA,
    });

    if (faltantes.length > 0 && !permitirParcial) {
      throw crearError(
        "El horario está incompleto. Completa las horas o confirma la publicación parcial.",
        409,
        {
          codigo: "HORARIO_INCOMPLETO",
          faltantes,
        },
      );
    }

    const publicados = await horarioDao.cambiarEstadoAlcance(client, {
      anio,
      idGrado,
      estado: "PUBLICADO",
      idUsuario: usuario.id_usuario,
    });

    return {
      anio,
      id_grado: idGrado,
      publicados,
      parcial: faltantes.length > 0,
      faltantes,
    };
  });
};

const despublicar = async (data, usuario) => {
  const anio = validarAnio(data.anio);
  if (anio !== getAnioLectivo()) {
    throw crearError("Solo se puede despublicar el año lectivo activo.");
  }
  const idGrado = parseFiltro(data.id_grado, "id_grado");

  return await conTransaccion(async (client) => {
    await bloquearAnio(client, anio);

    const despublicados = await horarioDao.cambiarEstadoAlcance(client, {
      anio,
      idGrado,
      estado: "BORRADOR",
      idUsuario: usuario.id_usuario,
    });
    if (despublicados === 0) {
      throw crearError("No hay bloques de horario para despublicar.");
    }

    return { anio, id_grado: idGrado, despublicados };
  });
};

module.exports = {
  listar,
  obtener,
  miHorario,
  crear,
  actualizar,
  eliminar,
  publicar,
  despublicar,
};
