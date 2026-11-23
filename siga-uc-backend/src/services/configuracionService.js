/**
 * Servicio de Configuración del Sistema (Fase 1 / H74)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const configuracionDao = require("../dao/configuracionDao");
const auditoriaService = require("./auditoriaService");
const { getClient } = require("../config/database");
const { getAnioLectivo } = require("../config/academico");

const MAX_TEXTO = 4000;
let advertioFaltaH74 = false;

const crearError = (mensaje, statusCode = 400, details = null) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

const esTablaNoAplicada = (error) =>
  error?.code === "42P01" || error?.code === "42703";

const errorNoAplicada = () =>
  crearError(
    "El módulo de configuración no está aplicado. Ejecute la migración H74.",
    503,
    { codigo: "CONFIG_NO_APLICADA" },
  );

const aTexto = (valor, campo, max = 200, obligatorio = false) => {
  if (valor === undefined) return undefined;
  if (valor === null) {
    if (obligatorio) {
      throw crearError(`El campo ${campo} es obligatorio.`);
    }
    return null;
  }
  const texto = String(valor).trim();
  if (!texto) {
    if (obligatorio) {
      throw crearError(`El campo ${campo} es obligatorio.`);
    }
    return null;
  }
  if (texto.length > max) {
    throw crearError(`El campo ${campo} no puede superar ${max} caracteres.`);
  }
  return texto;
};

const aEntero = (valor, campo, min, max) => {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    throw crearError(`El campo ${campo} debe ser un entero entre ${min} y ${max}.`);
  }
  return numero;
};

const validarCorreo = (correo) => {
  if (!correo) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw crearError("El correo de contacto no tiene un formato válido.");
  }
  return correo;
};

const validarUrl = (url, campo) => {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw crearError(`El campo ${campo} debe ser una URL http(s) válida.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw crearError(`El campo ${campo} debe usar http o https.`);
  }
  return url;
};

const validarZonaHoraria = (zona) => {
  try {
    new Intl.DateTimeFormat("es-PE", { timeZone: zona }).format(new Date());
    return zona;
  } catch {
    throw crearError("La zona horaria no es válida.");
  }
};

const resolverTexto = (
  data,
  campo,
  actual,
  max = 200,
  obligatorio = false,
) => {
  if (data[campo] === undefined) return actual;
  return aTexto(data[campo], campo, max, obligatorio);
};

const resolverEntero = (data, campo, actual, min, max) => {
  if (data[campo] === undefined) return actual;
  return aEntero(data[campo], campo, min, max);
};

const normalizarInstitucion = (data, actual) => {
  const nombreInstitucion = resolverTexto(
    data,
    "nombre_institucion",
    actual.nombre_institucion,
    200,
    true,
  );
  const nombreCorto = resolverTexto(
    data,
    "nombre_corto",
    actual.nombre_corto,
    100,
  );
  const ruc = resolverTexto(data, "ruc", actual.ruc, 11);
  if (ruc && !/^\d{11}$/.test(ruc)) {
    throw crearError("El RUC debe tener 11 dígitos.");
  }

  const direccion = resolverTexto(data, "direccion", actual.direccion, 250);
  const distrito = resolverTexto(data, "distrito", actual.distrito, 100);
  const provincia = resolverTexto(data, "provincia", actual.provincia, 100);
  const departamento = resolverTexto(
    data,
    "departamento",
    actual.departamento,
    100,
  );
  const pais = resolverTexto(data, "pais", actual.pais ?? "Perú", 100);
  const telefono = resolverTexto(data, "telefono", actual.telefono, 30);
  const correoContacto = validarCorreo(
    resolverTexto(
      data,
      "correo_contacto",
      actual.correo_contacto,
      150,
    ),
  );
  const sitioWeb = validarUrl(
    resolverTexto(data, "sitio_web", actual.sitio_web, 200),
    "sitio web",
  );
  const logoUrl = validarUrl(
    resolverTexto(data, "logo_url", actual.logo_url, 1000),
    "logo",
  );

  const moneda = (
    resolverTexto(data, "moneda", actual.moneda ?? "PEN", 3, true) || "PEN"
  ).toUpperCase();
  if (!/^[A-Z]{3}$/.test(moneda)) {
    throw crearError("La moneda debe tener 3 letras (por ejemplo PEN).");
  }

  const simboloMoneda = resolverTexto(
    data,
    "simbolo_moneda",
    actual.simbolo_moneda,
    5,
    true,
  );
  const zonaHoraria = validarZonaHoraria(
    resolverTexto(
      data,
      "zona_horaria",
      actual.zona_horaria,
      50,
      true,
    ),
  );
  const locale = (
    resolverTexto(data, "locale", actual.locale ?? "es-PE", 10, true) ||
    "es-PE"
  ).trim();
  if (!/^[a-z]{2}-[A-Z]{2}$/.test(locale)) {
    throw crearError("El locale debe tener el formato es-PE.");
  }

  const nombreRemitente = resolverTexto(
    data,
    "nombre_remitente",
    actual.nombre_remitente,
    150,
  );
  const textoBoleta = resolverTexto(
    data,
    "texto_boleta",
    actual.texto_boleta,
    MAX_TEXTO,
  );
  const textoLibreta = resolverTexto(
    data,
    "texto_libreta",
    actual.texto_libreta,
    MAX_TEXTO,
  );
  const textoActa = resolverTexto(
    data,
    "texto_acta",
    actual.texto_acta,
    MAX_TEXTO,
  );
  const textoPie = resolverTexto(
    data,
    "texto_pie",
    actual.texto_pie,
    MAX_TEXTO,
  );

  const serieBoleta = (
    resolverTexto(data, "serie_boleta", actual.serie_boleta, 10) || null
  )?.toUpperCase();
  if (serieBoleta && !/^[A-Z0-9]{1,10}$/.test(serieBoleta)) {
    throw crearError("La serie de boleta solo admite letras y números (máx. 10).");
  }

  const numeroBoletaInicial = resolverEntero(
    data,
    "numero_boleta_inicial",
    actual.numero_boleta_inicial,
    0,
    999999,
  );

  return {
    nombre_institucion: nombreInstitucion,
    nombre_corto: nombreCorto,
    ruc: ruc || null,
    direccion: direccion || null,
    distrito: distrito || null,
    provincia: provincia || null,
    departamento: departamento || null,
    pais: pais || null,
    telefono: telefono || null,
    correo_contacto: correoContacto || null,
    sitio_web: sitioWeb || null,
    logo_url: logoUrl || null,
    moneda,
    simbolo_moneda: simboloMoneda,
    zona_horaria: zonaHoraria,
    locale,
    nombre_remitente: nombreRemitente || null,
    texto_boleta: textoBoleta || null,
    texto_libreta: textoLibreta || null,
    texto_acta: textoActa || null,
    texto_pie: textoPie || null,
    serie_boleta: serieBoleta,
    numero_boleta_inicial: numeroBoletaInicial,
  };
};

const CAMPOS_COMPARABLES = [
  "nombre_institucion",
  "nombre_corto",
  "ruc",
  "direccion",
  "distrito",
  "provincia",
  "departamento",
  "pais",
  "telefono",
  "correo_contacto",
  "sitio_web",
  "logo_url",
  "moneda",
  "simbolo_moneda",
  "zona_horaria",
  "locale",
  "nombre_remitente",
  "texto_boleta",
  "texto_libreta",
  "texto_acta",
  "texto_pie",
  "serie_boleta",
  "numero_boleta_inicial",
];

const sinCambios = (actual, nuevo) =>
  CAMPOS_COMPARABLES.every((campo) => {
    const a = actual[campo] ?? null;
    const b = nuevo[campo] ?? null;
    return String(a) === String(b);
  });

const institucionPublica = (fila) => ({
  nombre_institucion: fila.nombre_institucion,
  nombre_corto: fila.nombre_corto,
  logo_url: fila.logo_url,
  moneda: fila.moneda,
  simbolo_moneda: fila.simbolo_moneda,
  zona_horaria: fila.zona_horaria,
  locale: fila.locale,
});

/**
 * Configuración pública que consume el frontend.
 * Si H74 no está aplicada, mantiene el año y devuelve institución nula.
 * @returns {Promise<{anio_lectivo: number, institucion: object|null}>}
 */
const obtenerConfiguracionPublica = async () => {
  const base = { anio_lectivo: getAnioLectivo(), institucion: null };
  try {
    const institucion = await configuracionDao.obtenerInstitucion();
    if (institucion) {
      base.institucion = institucionPublica(institucion);
    }
  } catch (error) {
    if (esTablaNoAplicada(error)) {
      if (!advertioFaltaH74) {
        advertioFaltaH74 = true;
        console.warn(
          "⚠️ Configuración institucional no disponible; se usa el año activo y valores por defecto. Aplique H74.",
        );
      }
      return base;
    }
    console.warn(
      "⚠️ No se pudo leer la configuración institucional; se usa el año activo.",
      error.message,
    );
    return base;
  }
  return base;
};

/**
 * Configuración completa para ADMIN/SECRETARÍA.
 * @returns {Promise<{institucion: object, anios: Array, anio_lectivo: number}>}
 */
const obtenerConfiguracionAdmin = async () => {
  let aplicada = false;
  try {
    aplicada = await configuracionDao.existeConfiguracionBase();
  } catch (error) {
    if (esTablaNoAplicada(error)) throw errorNoAplicada();
    throw error;
  }
  if (!aplicada) throw errorNoAplicada();

  const [institucion, anios] = await Promise.all([
    configuracionDao.obtenerInstitucion(),
    configuracionDao.listarAnios(),
  ]);

  if (!institucion) {
    throw crearError(
      "No existe la fila de configuración institucional. Aplique H74.",
      503,
      { codigo: "CONFIG_INSTITUCIONAL_NO_ENCONTRADA" },
    );
  }

  return {
    anio_lectivo: getAnioLectivo(),
    institucion,
    anios,
  };
};

/**
 * Actualiza la configuración institucional y audita dentro de la transacción.
 * @param {object} data
 * @param {object|null} usuario
 * @param {string|null} ip
 * @returns {Promise<{institucion: object, sin_cambios: boolean}>}
 */
const actualizarInstitucion = async (data = {}, usuario = null, ip = null) => {
  const motivo = String(data.motivo || "").trim();
  if (motivo.length < 10) {
    throw crearError(
      "El motivo debe tener al menos 10 caracteres.",
      400,
      { codigo: "MOTIVO_REQUERIDO" },
    );
  }
  if (motivo.length > 500) {
    throw crearError("El motivo no puede superar 500 caracteres.");
  }

  let aplicada = false;
  try {
    aplicada = await configuracionDao.existeConfiguracionBase();
  } catch (error) {
    if (esTablaNoAplicada(error)) throw errorNoAplicada();
    throw error;
  }
  if (!aplicada) throw errorNoAplicada();

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('configuracion:institucional'))",
    );

    const actual = await configuracionDao.obtenerInstitucionParaActualizar(
      client,
    );
    if (!actual) {
      throw crearError(
        "No existe la fila de configuración institucional. Aplique H74.",
        503,
        { codigo: "CONFIG_INSTITUCIONAL_NO_ENCONTRADA" },
      );
    }

    const normalizado = normalizarInstitucion(data, actual);
    if (sinCambios(actual, normalizado)) {
      await client.query("COMMIT");
      return { institucion: actual, sin_cambios: true };
    }

    const actualizado = await configuracionDao.actualizarInstitucion(
      normalizado,
      client,
      usuario?.id_usuario || null,
    );

    await auditoriaService.registrarEnTransaccion(client, {
      id_usuario: usuario?.id_usuario || null,
      modulo: "Configuración",
      accion: "MODIFICAR",
      descripcion: "Configuración institucional",
      anterior: actual,
      nuevo: actualizado,
      motivo,
      ip,
    });

    await client.query("COMMIT");
    return { institucion: actualizado, sin_cambios: false };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "❌ Error al revertir configuración institucional:",
        rollbackError.message,
      );
    }
    if (esTablaNoAplicada(error)) throw errorNoAplicada();
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerConfiguracionPublica,
  obtenerConfiguracionAdmin,
  actualizarInstitucion,
};
