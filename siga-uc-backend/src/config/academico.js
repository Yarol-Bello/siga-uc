/**
 * Configuración académica centralizada
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * `getAnioLectivo()` se mantiene SÍNCRONA porque se usa en muchas consultas.
 * El valor se inicializa desde `ANIO_LECTIVO` y, al arrancar, se refresca
 * desde `anios_lectivos`. Si la tabla no existe o no tiene un único ACTIVO,
 * se conserva el valor de entorno y se emite una advertencia.
 */

const env = require("./env");

let anioActivo = env.ANIO_LECTIVO;
let fuenteAnioActivo = "env";

/**
 * Año lectivo activo en memoria.
 * @returns {number}
 */
const getAnioLectivo = () => anioActivo;

/**
 * Origen del año activo: 'env' o 'tabla'.
 * @returns {'env'|'tabla'}
 */
const getFuenteAnioLectivo = () => fuenteAnioActivo;

/**
 * Actualiza la caché. La usará 6.2 después de una activación auditada.
 * No escribe en base de datos.
 * @param {number} anio
 */
const setAnioActivo = (anio) => {
  const numero = Number(anio);
  if (!Number.isInteger(numero) || numero < 2000 || numero > 2100) {
    throw new Error("El año lectivo debe estar entre 2000 y 2100.");
  }
  anioActivo = numero;
  fuenteAnioActivo = "tabla";
};

/**
 * Carga el año ACTIVO desde `anios_lectivos`. No lanza excepción: si algo
 * falla, mantiene el valor de entorno para que la API pueda arrancar.
 * @returns {Promise<{ anio: number, fuente: 'env'|'tabla' }>}
 */
const cargarAnioActivo = async () => {
  let query;
  try {
    ({ query } = require("./database"));
  } catch (error) {
    console.warn(
      "⚠️ No se pudo cargar el año activo (módulo de base de datos no disponible); se usa ANIO_LECTIVO.",
      error.message,
    );
    fuenteAnioActivo = "env";
    anioActivo = env.ANIO_LECTIVO;
    return { anio: anioActivo, fuente: fuenteAnioActivo };
  }

  try {
    const result = await query(
      `SELECT anio
       FROM public.anios_lectivos
       WHERE estado = 'ACTIVO'
       ORDER BY anio
       LIMIT 2`,
    );

    if (result.rows.length === 1) {
      const anioTabla = Number(result.rows[0].anio);
      if (
        Number.isInteger(anioTabla) &&
        anioTabla >= 2000 &&
        anioTabla <= 2100
      ) {
        anioActivo = anioTabla;
        fuenteAnioActivo = "tabla";

        if (env.ANIO_LECTIVO !== anioTabla) {
          console.warn(
            `⚠️ ANIO_LECTIVO=${env.ANIO_LECTIVO} pero anios_lectivos ACTIVO=${anioTabla}; se usa el de la tabla.`,
          );
        }
        return { anio: anioActivo, fuente: fuenteAnioActivo };
      }
    }

    if (result.rows.length === 0) {
      console.warn(
        "⚠️ anios_lectivos no tiene un año ACTIVO; se usa ANIO_LECTIVO como respaldo.",
      );
    } else {
      console.warn(
        "⚠️ anios_lectivos tiene más de un año ACTIVO; se usa ANIO_LECTIVO como respaldo.",
      );
    }
  } catch (error) {
    if (error.code === "42P01") {
      console.warn(
        "⚠️ La tabla anios_lectivos no existe; se usa ANIO_LECTIVO como respaldo. Aplique la migración H49/6.1.",
      );
    } else {
      console.warn(
        "⚠️ No se pudo leer el año ACTIVO de anios_lectivos; se usa ANIO_LECTIVO como respaldo.",
        error.message,
      );
    }
  }

  anioActivo = env.ANIO_LECTIVO;
  fuenteAnioActivo = "env";
  return { anio: anioActivo, fuente: fuenteAnioActivo };
};

/**
 * Alias explícito para 6.2/6.4: vuelve a leer la tabla sin reiniciar.
 * @returns {Promise<{ anio: number, fuente: 'env'|'tabla' }>}
 */
const refrescarAnioActivo = async () => cargarAnioActivo();

module.exports = {
  getAnioLectivo,
  getFuenteAnioLectivo,
  setAnioActivo,
  cargarAnioActivo,
  refrescarAnioActivo,
};
