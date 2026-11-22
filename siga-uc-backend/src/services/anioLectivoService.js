/**
 * Servicio del catálogo de años lectivos y activación auditada (H49 / 6.2)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const anioLectivoDao = require("../dao/anioLectivoDao");
const { getClient } = require("../config/database");
const { setAnioActivo } = require("../config/academico");

const crearError = (mensaje, statusCode = 400, details = null) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
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

const normalizarBooleano = (valor) =>
  valor === true || valor === "true" || valor === 1 || valor === "1";

/**
 * Traduce el error de tabla ausente (H49) a un 503 claro y controlado.
 */
const traducirError = (error) => {
  if (error?.statusCode) return error;
  if (error?.code === "42P01") {
    return crearError(
      "La base de datos no tiene aplicada la migración H49 (anios_lectivos). Aplique la migración y reinicie el backend.",
      503,
      { codigo: "H49_NO_APLICADO" },
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
        "❌ Error al revertir transacción de años lectivos:",
        rollbackError.message,
      );
    }
    throw traducirError(error);
  } finally {
    client.release();
  }
};

const listar = async () => {
  try {
    return await anioLectivoDao.listar();
  } catch (error) {
    throw traducirError(error);
  }
};

/**
 * Activa un año PLANIFICADO. El año ACTIVO anterior pasa a CERRADO.
 * Solo después del COMMIT se actualiza la caché en memoria.
 *
 * No reactiva años CERRADOS en 6.2.
 */
const activar = async ({ anio, confirmar, idUsuario = null }) => {
  const anioDestino = parseAnio(anio, "año a activar");
  if (!normalizarBooleano(confirmar)) {
    throw crearError(
      "Debe enviar confirmar=true para activar el año lectivo.",
      400,
      { codigo: "CONFIRMAR_REQUERIDO" },
    );
  }

  let resultado;
  try {
    resultado = await conTransaccion(async (client) => {
      await anioLectivoDao.bloquearActivacion(client);

      const actual = await anioLectivoDao.findByAnioForUpdate(
        anioDestino,
        client,
      );
      if (!actual) {
        throw crearError(
          `El año lectivo ${anioDestino} no existe en el catálogo.`,
          404,
          { codigo: "ANIO_NO_ENCONTRADO", anio: anioDestino },
        );
      }

      if (actual.estado === "ACTIVO") {
        throw crearError(
          `El año lectivo ${anioDestino} ya está activo.`,
          409,
          { codigo: "ANIO_YA_ACTIVO", anio: anioDestino },
        );
      }

      if (actual.estado !== "PLANIFICADO") {
        throw crearError(
          `Solo se puede activar un año PLANIFICADO. El año ${anioDestino} está ${actual.estado}.`,
          409,
          {
            codigo: "ANIO_NO_PLANIFICADO",
            anio: anioDestino,
            estado: actual.estado,
          },
        );
      }

      const oferta = await anioLectivoDao.contarOfertaMinima(
        anioDestino,
        client,
      );
      if (Number(oferta.grados) < 1) {
        throw crearError(
          `No se puede activar ${anioDestino}: el año no tiene grados. Ejecute el rollover primero.`,
          422,
          { codigo: "ANIO_SIN_GRADOS", anio: anioDestino, oferta },
        );
      }
      if (Number(oferta.matricula) < 1) {
        throw crearError(
          `No se puede activar ${anioDestino}: falta un concepto de pago MATRICULA.`,
          422,
          { codigo: "ANIO_SIN_MATRICULA", anio: anioDestino, oferta },
        );
      }

      const anteriores = await anioLectivoDao.buscarActivosForUpdate(
        anioDestino,
        client,
      );

      const cerrados = [];
      for (const anterior of anteriores) {
        const cerrado = await anioLectivoDao.cerrar(
          { anio: anterior.anio, cerradoPor: idUsuario },
          client,
        );
        if (cerrado) cerrados.push(cerrado.anio);
      }

      const activado = await anioLectivoDao.activar(anioDestino, client);
      if (!activado) {
        throw crearError(
          `El año lectivo ${anioDestino} no pudo activarse; puede haber cambiado de estado.`,
          409,
          { codigo: "ACTIVACION_CONFLICTO", anio: anioDestino },
        );
      }

      return {
        anio: anioDestino,
        estado: activado.estado,
        anios_cerrados: cerrados,
        anterior: anteriores.length > 0 ? anteriores[0].anio : null,
      };
    });
  } catch (error) {
    throw traducirError(error);
  }

  // Fuera de la transacción: la caché debe reflejar el COMMIT.
  setAnioActivo(resultado.anio);

  return resultado;
};

module.exports = {
  listar,
  activar,
  parseAnio,
  normalizarBooleano,
  crearError,
  traducirError,
};
