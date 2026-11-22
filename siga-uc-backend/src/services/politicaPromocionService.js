/**
 * Servicio de políticas de promoción (H73 / Fase 6.3)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * La política es descriptiva y configurable. El sistema no codifica la
 * norma peruana: solo aplica los umbrales que el ADMIN configure.
 */

const politicaPromocionDao = require("../dao/politicaPromocionDao");

const CRITERIO_DEFECTO = {
  modo: "manual",
  modo_repitencia: "DESACTIVADA",
  notas_bimestres: [4],
  bimestres_requeridos: [1, 2, 3, 4],
  transiciones: [],
  observacion: "",
};

const crearError = (mensaje, statusCode = 400, details = null) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

const normalizarBooleano = (valor, defecto = false) => {
  if (valor === undefined || valor === null) return defecto;
  return valor === true || valor === "true" || valor === 1 || valor === "1";
};

const parseAnio = (valor, campo = "año lectivo") => {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 2000 || numero > 2100) {
    throw crearError(`El ${campo} debe estar entre 2000 y 2100.`, 400, {
      codigo: "ANIO_INVALIDO",
    });
  }
  return numero;
};

const traducirError = (error) => {
  if (error?.statusCode) return error;
  if (error?.code === "42P01") {
    const mensaje = String(error.message || "");
    if (mensaje.includes("anios_lectivos")) {
      return crearError(
        "La base no tiene aplicada la migración H49 (anios_lectivos). Aplique H49 y reinicie el backend.",
        503,
        { codigo: "H49_NO_APLICADO" },
      );
    }
    return crearError(
      "La base no tiene aplicadas las tablas de promoción (H73). Aplique la migración y reinicie el backend.",
      503,
      { codigo: "PROMOCIONES_NO_APLICADAS" },
    );
  }
  if (error?.code === "23505") {
    return crearError(
      "Ya existe una política con el mismo año y nombre.",
      409,
      { codigo: "POLITICA_DUPLICADA" },
    );
  }
  if (error?.code === "23503") {
    return crearError(
      "La política hace referencia a un usuario o año inexistente.",
      409,
      { codigo: "REGISTRO_RELACIONADO" },
    );
  }
  if (error?.code === "23514") {
    return crearError(
      "Los datos de la política no cumplen las validaciones.",
      400,
      { codigo: "POLITICA_INVALIDA" },
    );
  }
  return error;
};

const normalizarCriterio = (criterio) => {
  let valor = criterio;

  if (valor === undefined || valor === null || valor === "") {
    valor = {};
  } else if (typeof valor === "string") {
    try {
      valor = JSON.parse(valor);
    } catch {
      throw crearError(
        "El criterio académico debe ser un JSON válido.",
        400,
        { codigo: "CRITERIO_INVALIDO" },
      );
    }
  }

  if (typeof valor !== "object" || Array.isArray(valor)) {
    throw crearError(
      "El criterio académico debe ser un objeto JSON.",
      400,
      { codigo: "CRITERIO_INVALIDO" },
    );
  }

  const resultado = {
    ...CRITERIO_DEFECTO,
    ...valor,
  };

  resultado.modo = String(resultado.modo || "manual");
  resultado.modo_repitencia = String(
    resultado.modo_repitencia || "DESACTIVADA",
  ).toUpperCase();
  if (!["DESACTIVADA", "UMBRAL"].includes(resultado.modo_repitencia)) {
    throw crearError(
      "modo_repitencia debe ser DESACTIVADA o UMBRAL.",
      400,
      { codigo: "CRITERIO_INVALIDO" },
    );
  }

  const bimestresNotasRaw =
    valor.notas_bimestres !== undefined
      ? valor.notas_bimestres
      : valor.notas_bimestre !== undefined
        ? [valor.notas_bimestre]
        : CRITERIO_DEFECTO.notas_bimestres;
  const listaBimestresNotas = Array.isArray(bimestresNotasRaw)
    ? bimestresNotasRaw
    : [bimestresNotasRaw];
  resultado.notas_bimestres = [
    ...new Set(
      listaBimestresNotas
        .map((valorBimestre) => Number(valorBimestre))
        .filter(
          (valorBimestre) =>
            Number.isInteger(valorBimestre) &&
            valorBimestre >= 1 &&
            valorBimestre <= 4,
        ),
    ),
  ].sort((a, b) => a - b);
  delete resultado.notas_bimestre;

  if (resultado.notas_bimestres.length === 0) {
    throw crearError(
      "Debe indicar al menos un bimestre de notas (1-4).",
      400,
      { codigo: "CRITERIO_INVALIDO" },
    );
  }

  const bimestres = Array.isArray(resultado.bimestres_requeridos)
    ? resultado.bimestres_requeridos
    : CRITERIO_DEFECTO.bimestres_requeridos;
  resultado.bimestres_requeridos = [
    ...new Set(
      bimestres
        .map((valorBimestre) => Number(valorBimestre))
        .filter(
          (valorBimestre) =>
            Number.isInteger(valorBimestre) &&
            valorBimestre >= 1 &&
            valorBimestre <= 4,
        ),
    ),
  ].sort((a, b) => a - b);

  if (resultado.bimestres_requeridos.length === 0) {
    throw crearError(
      "Debe indicar al menos un bimestre requerido para las actas.",
      400,
      { codigo: "CRITERIO_INVALIDO" },
    );
  }

  if (!Array.isArray(resultado.transiciones)) {
    throw crearError(
      "transiciones debe ser un arreglo JSON.",
      400,
      { codigo: "CRITERIO_INVALIDO" },
    );
  }

  resultado.transiciones = resultado.transiciones.map((transicion) => {
    if (!transicion || typeof transicion !== "object") {
      throw crearError(
        "Cada transición debe ser un objeto.",
        400,
        { codigo: "CRITERIO_INVALIDO" },
      );
    }
    const normalizada = {
      nivel_origen: String(transicion.nivel_origen || "").trim(),
      orden_origen: Number(transicion.orden_origen),
      nivel_destino: String(transicion.nivel_destino || "").trim(),
      orden_destino: Number(transicion.orden_destino),
    };
    if (transicion.seccion !== undefined && transicion.seccion !== null) {
      normalizada.seccion = String(transicion.seccion).trim();
    }
    if (
      transicion.seccion_destino !== undefined &&
      transicion.seccion_destino !== null
    ) {
      normalizada.seccion_destino = String(
        transicion.seccion_destino,
      ).trim();
    }
    if (
      !normalizada.nivel_origen ||
      !normalizada.nivel_destino ||
      !Number.isInteger(normalizada.orden_origen) ||
      !Number.isInteger(normalizada.orden_destino)
    ) {
      throw crearError(
        "Cada transición requiere nivel/orden de origen y destino.",
        400,
        { codigo: "CRITERIO_INVALIDO" },
      );
    }
    return normalizada;
  });

  if (resultado.modo_repitencia === "UMBRAL") {
    resultado.min_cursos_desaprobados = Number(
      resultado.min_cursos_desaprobados,
    );
    if (
      !Number.isInteger(resultado.min_cursos_desaprobados) ||
      resultado.min_cursos_desaprobados < 1
    ) {
      throw crearError(
        "min_cursos_desaprobados debe ser un entero mayor que cero cuando la repitencia está en UMBRAL.",
        400,
        { codigo: "CRITERIO_INVALIDO" },
      );
    }
    const notas = Array.isArray(resultado.notas_desaprobadas)
      ? resultado.notas_desaprobadas
      : ["C"];
    resultado.notas_desaprobadas = [
      ...new Set(notas.map((nota) => String(nota).toUpperCase())),
    ].filter(Boolean);
    if (resultado.notas_desaprobadas.length === 0) {
      resultado.notas_desaprobadas = ["C"];
    }
  } else {
    delete resultado.min_cursos_desaprobados;
    delete resultado.notas_desaprobadas;
  }

  if (resultado.observacion === undefined || resultado.observacion === null) {
    resultado.observacion = "";
  } else {
    resultado.observacion = String(resultado.observacion);
  }

  return resultado;
};

const normalizarUmbral = (valor) => {
  if (valor === undefined || valor === null || valor === "") return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
    throw crearError(
      "El umbral de asistencia debe estar entre 0 y 100.",
      400,
      { codigo: "UMBRAL_INVALIDO" },
    );
  }
  return Math.round(numero * 100) / 100;
};

const normalizarPolitica = (data, { parcial = false, actual = null } = {}) => {
  const base = actual || {};
  const valor = (campo, defecto) =>
    data[campo] === undefined ? (parcial ? base[campo] : defecto) : data[campo];

  const anioOrigen = parseAnio(
    valor("anio_origen", undefined),
    "año origen",
  );
  let anioDestino = valor("anio_destino", null);
  if (anioDestino === undefined || anioDestino === null || anioDestino === "") {
    anioDestino = null;
  } else {
    anioDestino = parseAnio(anioDestino, "año destino");
    if (anioDestino <= anioOrigen) {
      throw crearError(
        "El año destino debe ser posterior al año origen.",
        400,
        { codigo: "ANIOS_INVALIDOS" },
      );
    }
  }

  const nombre = String(valor("nombre", "")).trim();
  if (nombre.length < 2 || nombre.length > 120) {
    throw crearError(
      "El nombre de la política debe tener entre 2 y 120 caracteres.",
      400,
      { codigo: "NOMBRE_INVALIDO" },
    );
  }

  return {
    anio_origen: anioOrigen,
    anio_destino: anioDestino,
    nombre,
    activo: normalizarBooleano(valor("activo", true), true),
    requiere_actas_cerradas: normalizarBooleano(
      valor("requiere_actas_cerradas", true),
      true,
    ),
    requiere_notas_finales: normalizarBooleano(
      valor("requiere_notas_finales", true),
      true,
    ),
    umbral_asistencia: normalizarUmbral(
      valor("umbral_asistencia", null),
    ),
    criterio_academico: normalizarCriterio(
      valor("criterio_academico", {}),
    ),
    permite_override: normalizarBooleano(
      valor("permite_override", false),
      false,
    ),
  };
};

const listar = async (filtros = {}) => {
  try {
    return await politicaPromocionDao.listar(filtros);
  } catch (error) {
    throw traducirError(error);
  }
};

const obtener = async (id) => {
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw crearError("Política inválida.", 400, {
      codigo: "POLITICA_INVALIDA",
    });
  }
  try {
    const politica = await politicaPromocionDao.findById(numero);
    if (!politica) {
      throw crearError("Política de promoción no encontrada.", 404, {
        codigo: "POLITICA_NO_ENCONTRADA",
      });
    }
    return {
      ...politica,
      criterio_academico: normalizarCriterio(politica.criterio_academico),
      umbral_asistencia:
        politica.umbral_asistencia === null
          ? null
          : Number(politica.umbral_asistencia),
    };
  } catch (error) {
    throw traducirError(error);
  }
};

const crear = async (data, idUsuario = null) => {
  const normalizada = normalizarPolitica(data);
  try {
    return await politicaPromocionDao.crear({
      ...normalizada,
      creado_por: idUsuario,
    });
  } catch (error) {
    throw traducirError(error);
  }
};

const actualizar = async (id, data) => {
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw crearError("Política inválida.", 400, {
      codigo: "POLITICA_INVALIDA",
    });
  }

  try {
    const actual = await politicaPromocionDao.findById(numero);
    if (!actual) {
      throw crearError("Política de promoción no encontrada.", 404, {
        codigo: "POLITICA_NO_ENCONTRADA",
      });
    }
    const normalizada = normalizarPolitica(data, { parcial: true, actual });
    const actualizada = await politicaPromocionDao.actualizar(
      numero,
      normalizada,
    );
    return actualizada;
  } catch (error) {
    throw traducirError(error);
  }
};

/**
 * Resuelve la política por id o, si no se envía, la más específica activa.
 */
const resolverPolitica = async (idPolitica, anioOrigen, anioDestino) => {
  try {
    let politica;
    if (idPolitica !== undefined && idPolitica !== null && idPolitica !== "") {
      politica = await politicaPromocionDao.findById(Number(idPolitica));
      if (!politica) {
        throw crearError("Política de promoción no encontrada.", 404, {
          codigo: "POLITICA_NO_ENCONTRADA",
        });
      }
    } else {
      politica = await politicaPromocionDao.findVigente(
        anioOrigen,
        anioDestino,
      );
      if (!politica) {
        throw crearError(
          `No hay una política de promoción activa para ${anioOrigen} → ${anioDestino}. Cree una política primero.`,
          422,
          { codigo: "POLITICA_NO_ENCONTRADA" },
        );
      }
    }

    if (!politica.activo) {
      throw crearError(
        "La política de promoción está inactiva.",
        422,
        { codigo: "POLITICA_INACTIVA", id_politica: politica.id_politica },
      );
    }

    if (Number(politica.anio_origen) !== Number(anioOrigen)) {
      throw crearError(
        `La política pertenece al año ${politica.anio_origen}, no a ${anioOrigen}.`,
        422,
        { codigo: "POLITICA_ANIO_INVALIDO" },
      );
    }

    if (
      politica.anio_destino !== null &&
      Number(politica.anio_destino) !== Number(anioDestino)
    ) {
      throw crearError(
        `La política pertenece al destino ${politica.anio_destino}, no a ${anioDestino}.`,
        422,
        { codigo: "POLITICA_ANIO_INVALIDO" },
      );
    }

    return {
      ...politica,
      umbral_asistencia:
        politica.umbral_asistencia === null
          ? null
          : Number(politica.umbral_asistencia),
      criterio_academico: normalizarCriterio(politica.criterio_academico),
    };
  } catch (error) {
    throw traducirError(error);
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  resolverPolitica,
  normalizarCriterio,
  normalizarPolitica,
  parseAnio,
  crearError,
  traducirError,
  CRITERIO_DEFECTO,
};
