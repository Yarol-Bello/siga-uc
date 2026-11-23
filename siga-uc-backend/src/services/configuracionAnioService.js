/**
 * Servicio de configuración por año / jornada (Fase 4 / H77)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const configuracionAnioDao = require("../dao/configuracionAnioDao");
const auditoriaService = require("./auditoriaService");
const { getClient } = require("../config/database");
const {
  DIAS_SEMANA,
  HORAS_DEFAULT_CARGA,
  MAX_BLOQUES_CURSO_DIA,
} = require("../config/horarios");

const DIAS_VALIDOS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const crearError = (mensaje, statusCode = 400, details = null) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

const esNoAplicada = (error) =>
  error?.code === "42P01" || error?.code === "42703" || error?.code === "42883";

const errorNoAplicada = () =>
  crearError(
    "La configuración de jornada no está aplicada. Ejecute H77.",
    503,
    { codigo: "CONFIG_HORARIO_NO_APLICADA" },
  );

const parseAnio = (valor) => {
  const anio = Number(valor);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    throw crearError("El año lectivo debe estar entre 2000 y 2100.");
  }
  return anio;
};

const parseEntero = (valor, campo, min, max) => {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    throw crearError(`El campo ${campo} debe ser un entero entre ${min} y ${max}.`);
  }
  return numero;
};

const normalizarHora = (valor, campo) => {
  const texto = String(valor || "").trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(texto)) {
    throw crearError(`La ${campo} debe tener formato HH:MM.`);
  }
  return texto.length === 5 ? `${texto}:00` : texto;
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

const normalizarDias = (valor, defecto = DIAS_SEMANA) => {
  const lista = Array.isArray(valor)
    ? valor
    : String(valor || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const dias = [...new Set(lista.map((item) => String(item).trim()))];
  if (dias.length === 0) {
    throw crearError("Seleccione al menos un día de clase.");
  }
  const invalidos = dias.filter((dia) => !DIAS_VALIDOS.includes(dia));
  if (invalidos.length > 0) {
    throw crearError(`Días inválidos: ${invalidos.join(", ")}.`);
  }
  return dias;
};

const efectiva = (fila, anio) => ({
  anio: Number(anio),
  estado: fila?.estado || null,
  dias_clase:
    fila?.dias_clase?.length > 0 ? fila.dias_clase : [...DIAS_SEMANA],
  hora_inicio_jornada: fila?.hora_inicio_jornada || "07:30:00",
  hora_fin_jornada: fila?.hora_fin_jornada || "14:30:00",
  duracion_min_bloque: Number(fila?.duracion_min_bloque || 45),
  max_bloques_curso_dia: Number(
    fila?.max_bloques_curso_dia || MAX_BLOQUES_CURSO_DIA,
  ),
  horas_default_carga: Number(
    fila?.horas_default_carga || HORAS_DEFAULT_CARGA,
  ),
  politica_inicio_pension: fila?.politica_inicio_pension || "MES_MATRICULA",
  mes_inicio_pension: fila?.mes_inicio_pension ?? null,
  version: Number(fila?.version || 0),
  actualizado_en: fila?.actualizado_en || null,
});

const obtenerEfectiva = async (anio) => {
  const numero = parseAnio(anio);
  try {
    const fila = await configuracionAnioDao.obtener(numero);
    return efectiva(fila, numero);
  } catch (error) {
    if (esNoAplicada(error)) return efectiva(null, numero);
    throw error;
  }
};

const obtener = async (anio) => {
  const numero = parseAnio(anio);
  try {
    const fila = await configuracionAnioDao.obtener(numero);
    if (!fila) {
      throw crearError(
        `No hay configuración para el año ${numero}.`,
        404,
        { codigo: "CONFIG_ANIO_NO_ENCONTRADA" },
      );
    }
    return efectiva(fila, numero);
  } catch (error) {
    if (esNoAplicada(error)) throw errorNoAplicada();
    throw error;
  }
};

const actualizar = async (anio, data, usuario = null, ip = null) => {
  const numero = parseAnio(anio);
  const motivo = validarMotivo(data.motivo);
  const dias = normalizarDias(data.dias_clase);
  const horaInicio = normalizarHora(
    data.hora_inicio_jornada,
    "hora de inicio",
  );
  const horaFin = normalizarHora(data.hora_fin_jornada, "hora de fin");
  if (horaFin <= horaInicio) {
    throw crearError("La hora de fin debe ser mayor que la hora de inicio.");
  }
  const duracion = parseEntero(
    data.duracion_min_bloque,
    "duración mínima",
    1,
    240,
  );
  const maxBloques = parseEntero(
    data.max_bloques_curso_dia,
    "máximo por curso/día",
    1,
    20,
  );
  const horasDefault = parseEntero(
    data.horas_default_carga,
    "horas default de carga",
    1,
    20,
  );

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`horarios:${numero}`],
    );

    const actual = await configuracionAnioDao.obtenerParaActualizar(
      numero,
      client,
    );
    if (!actual) {
      throw crearError(
        `No hay configuración para el año ${numero}.`,
        404,
        { codigo: "CONFIG_ANIO_NO_ENCONTRADA" },
      );
    }

    const publicados = await configuracionAnioDao.contarHorariosPublicados(
      numero,
      client,
    );
    if (publicados > 0) {
      throw crearError(
        "El año tiene horarios publicados. Despublique antes de cambiar días, jornada o límites.",
        409,
        { codigo: "HORARIO_PUBLICADO", publicados },
      );
    }

    const fueraDia = await configuracionAnioDao.contarHorariosPorDiaFuera(
      numero,
      dias,
      client,
    );
    if (fueraDia.length > 0) {
      throw crearError(
        `Hay bloques en días que se quieren quitar: ${fueraDia
          .map((item) => `${item.dia_semana} (${item.total})`)
          .join(", ")}.`,
        409,
        { codigo: "DIA_CON_BLOQUES", dias: fueraDia },
      );
    }

    const maxActual = await configuracionAnioDao.maxBloquesCursoDia(
      numero,
      client,
    );
    if (maxActual > maxBloques) {
      throw crearError(
        `Hay cursos con ${maxActual} bloques en un día; el nuevo máximo es ${maxBloques}. Ajuste el horario antes de guardar.`,
        409,
        { codigo: "MAX_BLOQUES_INCOMPATIBLE", max_actual: maxActual },
      );
    }

    const periodosFuera =
      await configuracionAnioDao.contarPeriodosFueraJornada(
        numero,
        horaInicio,
        horaFin,
        client,
      );
    if (periodosFuera > 0) {
      throw crearError(
        `Hay ${periodosFuera} período(s) activo(s) fuera de la nueva jornada.`,
        409,
        { codigo: "PERIODOS_FUERA_JORNADA", periodos: periodosFuera },
      );
    }

    const actualizado = await configuracionAnioDao.actualizar(
      numero,
      {
        dias_clase: dias,
        hora_inicio_jornada: horaInicio,
        hora_fin_jornada: horaFin,
        duracion_min_bloque: duracion,
        max_bloques_curso_dia: maxBloques,
        horas_default_carga: horasDefault,
      },
      usuario?.id_usuario || null,
      client,
    );

    await auditoriaService.registrarEnTransaccion(client, {
      id_usuario: usuario?.id_usuario || null,
      modulo: "Configuración",
      accion: "MODIFICAR",
      descripcion: `Jornada y límites del año ${numero}`,
      anterior: efectiva(actual, numero),
      nuevo: efectiva(actualizado, numero),
      motivo,
      ip,
    });

    await client.query("COMMIT");
    return efectiva(actualizado, numero);
  } catch (error) {
    await client.query("ROLLBACK");
    if (esNoAplicada(error)) throw errorNoAplicada();
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  obtener,
  obtenerEfectiva,
  actualizar,
  DIAS_VALIDOS,
};
