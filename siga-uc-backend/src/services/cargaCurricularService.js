/**
 * Servicio de Carga Curricular
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const cargaCurricularDao = require("../dao/cargaCurricularDao");
const horarioDao = require("../dao/horarioDao");
const { getClient } = require("../config/database");
const { getAnioLectivo } = require("../config/academico");

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

const normalizarBooleano = (valor) =>
  valor === true || valor === "true" || valor === 1 || valor === "1";

const traducirError = (error) => {
  if (error?.statusCode) return error;
  if (error?.code === "23505") {
    return crearError(
      "Ya existe una carga para ese grado, curso y año lectivo.",
      409,
    );
  }
  if (error?.code === "23503") {
    return crearError(
      "El grado, curso o docente ya no existe; no se pudo actualizar la carga.",
      409,
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
      console.error(
        "❌ Error al revertir transacción de carga curricular:",
        rollbackError.message,
      );
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

const listar = async (filtros) => {
  return await cargaCurricularDao.listar(filtros);
};

const obtener = async (id) => {
  const carga = await cargaCurricularDao.findById(id);
  if (!carga) {
    throw crearError("Carga curricular no encontrada.", 404);
  }
  return carga;
};

const listarPorGrado = async (id_grado) => {
  return await cargaCurricularDao.listarPorGrado(id_grado);
};

const listarPorDocente = async (id_personal, anioLectivo) => {
  return await cargaCurricularDao.listarPorDocente(id_personal, anioLectivo);
};

const getTutor = async (id_grado, anioLectivo) => {
  return await cargaCurricularDao.getTutor(id_grado, anioLectivo);
};

const crear = async (data) => {
  const id_grado = parseEntero(data.id_grado);
  const id_curso = parseEntero(data.id_curso);
  const id_personal = parseEntero(data.id_personal);
  const anio_lectivo = parseEntero(data.anio_lectivo) || getAnioLectivo();

  if (!id_grado || !id_curso || !id_personal) {
    throw crearError(
      "Faltan campos obligatorios: id_grado, id_curso, id_personal.",
    );
  }

  if (anio_lectivo !== getAnioLectivo()) {
    throw crearError("Solo se puede crear carga del año lectivo activo.");
  }

  const destino = await cargaCurricularDao.validarDestino({
    id_grado,
    id_curso,
    anio_lectivo,
  });
  if (!destino) {
    throw crearError("El grado y el curso no corresponden al año lectivo.");
  }

  const personal = await cargaCurricularDao.existePersonal(id_personal);
  if (!personal) {
    throw crearError("El docente seleccionado no existe.");
  }

  let horas_asignadas = null;
  if (data.horas_asignadas !== undefined && data.horas_asignadas !== null) {
    horas_asignadas = parseEntero(data.horas_asignadas);
    if (!horas_asignadas) {
      throw crearError("Las horas semanales deben ser un entero mayor que cero.");
    }
  }

  try {
    return await cargaCurricularDao.crear({
      id_grado,
      id_curso,
      id_personal,
      anio_lectivo,
      horas_asignadas,
    });
  } catch (error) {
    throw traducirError(error);
  }
};

const actualizar = async (id, data, idUsuario = null) => {
  const actual = await obtener(id);

  const target = {
    id_grado:
      data.id_grado !== undefined
        ? parseEntero(data.id_grado)
        : actual.id_grado,
    id_curso:
      data.id_curso !== undefined
        ? parseEntero(data.id_curso)
        : actual.id_curso,
    id_personal:
      data.id_personal !== undefined
        ? parseEntero(data.id_personal)
        : actual.id_personal,
    anio_lectivo:
      data.anio_lectivo !== undefined
        ? parseEntero(data.anio_lectivo)
        : actual.anio_lectivo,
    horas_asignadas:
      data.horas_asignadas !== undefined && data.horas_asignadas !== null
        ? parseEntero(data.horas_asignadas)
        : actual.horas_asignadas,
  };

  if (
    !target.id_grado ||
    !target.id_curso ||
    !target.id_personal ||
    !target.anio_lectivo
  ) {
    throw crearError("Grado, curso, docente y año son obligatorios.");
  }

  if (
    data.horas_asignadas !== undefined &&
    data.horas_asignadas !== null &&
    !target.horas_asignadas
  ) {
    throw crearError("Las horas semanales deben ser un entero mayor que cero.");
  }

  const cambiaEstructura =
    Number(target.id_grado) !== Number(actual.id_grado) ||
    Number(target.id_curso) !== Number(actual.id_curso) ||
    Number(target.anio_lectivo) !== Number(actual.anio_lectivo);
  const cambiaDocente =
    Number(target.id_personal) !== Number(actual.id_personal);
  const cambiaHoras =
    Number(target.horas_asignadas || 0) !==
    Number(actual.horas_asignadas || 0);

  if (!cambiaEstructura && !cambiaDocente && !cambiaHoras) {
    return actual;
  }

  if (Number(actual.anio_lectivo) !== getAnioLectivo()) {
    throw crearError("Solo se puede modificar carga del año lectivo activo.");
  }
  if (Number(target.anio_lectivo) !== getAnioLectivo()) {
    throw crearError("La carga debe pertenecer al año lectivo activo.");
  }

  const destino = await cargaCurricularDao.validarDestino(target);
  if (!destino) {
    throw crearError("El grado y el curso no corresponden al año lectivo.");
  }

  const personal = await cargaCurricularDao.existePersonal(target.id_personal);
  if (!personal) {
    throw crearError("El docente seleccionado no existe.");
  }

  const confirmar = normalizarBooleano(data.confirmar);

  return await conTransaccion(async (client) => {
    await bloquearAnio(client, actual.anio_lectivo);
    if (Number(target.anio_lectivo) !== Number(actual.anio_lectivo)) {
      await bloquearAnio(client, target.anio_lectivo);
    }

    const bloqueada = await cargaCurricularDao.findByIdForUpdate(id, client);
    if (!bloqueada) {
      throw crearError("Carga curricular no encontrada.", 404);
    }

    const horarios = await horarioDao.contarPorCarga(id, client);

    if (cambiaEstructura && horarios.publicados > 0) {
      throw crearError(
        "Despublique el horario antes de cambiar el grado, curso o año de la carga.",
        409,
        { codigo: "HORARIO_PUBLICADO", publicados: horarios.publicados },
      );
    }

    if (cambiaEstructura && horarios.borradores > 0 && !confirmar) {
      throw crearError(
        `Cambiar grado, curso o año eliminará ${horarios.borradores} bloque(s) en borrador. Envíe confirmar=true para continuar.`,
        409,
        {
          codigo: "HORARIOS_BORRADOR",
          bloques: horarios.borradores,
        },
      );
    }

    if (cambiaDocente && !cambiaEstructura && horarios.publicados > 0) {
      throw crearError(
        "Despublique el horario antes de cambiar el docente.",
        409,
        { codigo: "HORARIO_PUBLICADO", publicados: horarios.publicados },
      );
    }

    if (cambiaDocente && !cambiaEstructura && horarios.borradores > 0) {
      const conflicto = await horarioDao.findConflictoReasignacion(
        client,
        id,
        target.id_personal,
      );
      if (conflicto) {
        throw crearError(
          `El nuevo docente ya tiene ${conflicto.nombre_grado} ${conflicto.seccion} en ${conflicto.dia_semana}, ${conflicto.periodo_nombre}.`,
          409,
          { codigo: "CONFLICTO_REASIGNACION", ...conflicto },
        );
      }
    }

    let horariosEliminados = 0;
    if (cambiaEstructura && horarios.borradores > 0) {
      horariosEliminados = await horarioDao.eliminarPorCarga(client, id);
    }

    const actualizada = await cargaCurricularDao.actualizar(id, target, client);
    if (!actualizada) {
      throw crearError("Carga curricular no encontrada.", 404);
    }

    let horariosActualizados = 0;
    if (cambiaDocente && !cambiaEstructura && horarios.borradores > 0) {
      horariosActualizados = await horarioDao.actualizarDocentePorCarga(
        client,
        {
          idCarga: id,
          idPersonal: target.id_personal,
          idUsuario: idUsuario || null,
        },
      );
    }

    let advertencia = null;
    if (
      cambiaHoras &&
      horarios.total > 0 &&
      Number(horarios.total) !== Number(target.horas_asignadas)
    ) {
      advertencia = `La carga tiene ${horarios.total} bloque(s) y ahora declara ${target.horas_asignadas} hora(s). Ajuste el horario antes de publicar.`;
    }

    return {
      ...actualizada,
      horarios_actualizados: horariosActualizados,
      horarios_eliminados: horariosEliminados,
      advertencia,
    };
  });
};

const eliminar = async (id) => {
  const actual = await obtener(id);

  if (Number(actual.anio_lectivo) !== getAnioLectivo()) {
    throw crearError("Solo se puede eliminar carga del año lectivo activo.");
  }

  return await conTransaccion(async (client) => {
    await bloquearAnio(client, actual.anio_lectivo);

    const bloqueada = await cargaCurricularDao.findByIdForUpdate(id, client);
    if (!bloqueada) {
      throw crearError("Carga curricular no encontrada.", 404);
    }

    const horarios = await horarioDao.contarPorCarga(id, client);
    if (horarios.publicados > 0) {
      throw crearError(
        "Despublique el horario antes de eliminar la carga.",
        409,
        { codigo: "HORARIO_PUBLICADO", publicados: horarios.publicados },
      );
    }

    let horariosEliminados = 0;
    if (horarios.borradores > 0) {
      horariosEliminados = await horarioDao.eliminarPorCarga(client, id);
    }

    const eliminada = await cargaCurricularDao.eliminar(id, client);
    if (!eliminada) {
      throw crearError("Carga curricular no encontrada.", 404);
    }

    return { ...eliminada, horarios_eliminados: horariosEliminados };
  });
};

const asignarTutor = async (data) => {
  if (!data.id_grado || !data.id_personal) {
    throw crearError("Faltan campos obligatorios: id_grado, id_personal.");
  }
  return await cargaCurricularDao.asignarTutor(data);
};

module.exports = {
  listar,
  obtener,
  listarPorGrado,
  listarPorDocente,
  getTutor,
  crear,
  actualizar,
  eliminar,
  asignarTutor,
};
