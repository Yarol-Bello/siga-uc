/**
 * Servicio de tarifas y conceptos de pago (Fase 2 / H75)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const crypto = require("node:crypto");
const conceptoPagoDao = require("../dao/conceptoPagoDao");
const auditoriaService = require("./auditoriaService");
const { getClient } = require("../config/database");
const { getAnioLectivo } = require("../config/academico");

const TIPOS = new Set(["MATRICULA", "PENSION", "OTROS"]);
const MAX_MOTIVO = 500;
const MIN_MOTIVO = 10;

const crearError = (mensaje, statusCode = 400, details = null) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

const errorNoAplicada = () =>
  crearError(
    "El módulo de tarifas no está aplicado. Ejecute la migración H75.",
    503,
    { codigo: "TARIFAS_NO_APLICADAS" },
  );

const esNoAplicada = (error) =>
  error?.code === "42P01" || error?.code === "42703" || error?.code === "42883";

const parseAnio = (valor, obligatorio = true) => {
  if (valor === undefined || valor === null || valor === "") {
    if (obligatorio) throw crearError("El año lectivo es obligatorio.");
    return null;
  }
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 2000 || numero > 2100) {
    throw crearError("El año lectivo debe estar entre 2000 y 2100.");
  }
  return numero;
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

const parseMonto = (valor, campo = "monto") => {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) {
    throw crearError(`El ${campo} debe ser mayor que cero.`);
  }
  if (Math.round(numero * 100) / 100 !== numero) {
    throw crearError(`El ${campo} admite como máximo dos decimales.`);
  }
  return Math.round(numero * 100) / 100;
};

const aTexto = (valor, campo, max, obligatorio = false) => {
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

const fechaISO = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }
  return String(valor).slice(0, 10);
};

const aFecha = (valor, campo, obligatorio = false) => {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") {
    if (obligatorio) throw crearError(`El campo ${campo} es obligatorio.`);
    return null;
  }
  const texto = fechaISO(valor);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw crearError(`El campo ${campo} debe tener formato YYYY-MM-DD.`);
  }
  const fecha = new Date(`${texto}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    throw crearError(`El campo ${campo} no es una fecha válida.`);
  }
  return texto;
};

const aBooleano = (valor, defecto = true) => {
  if (valor === undefined) return defecto;
  return valor === true || valor === "true" || valor === 1 || valor === "1";
};

const aMontoFijo = (valor) => Number(valor || 0).toFixed(2);

const serializar = (fila) => {
  if (!fila) return null;
  return {
    id_concepto: Number(fila.id_concepto),
    nombre: fila.nombre,
    monto_base: aMontoFijo(fila.monto_base),
    tipo: fila.tipo,
    mes: fila.mes === null || fila.mes === undefined ? null : Number(fila.mes),
    anio_lectivo: Number(fila.anio_lectivo),
    nivel: fila.nivel || null,
    id_grado: fila.id_grado === null || fila.id_grado === undefined ? null : Number(fila.id_grado),
    activo: Boolean(fila.activo),
    descripcion: fila.descripcion || null,
    orden: Number(fila.orden || 0),
    vigente_desde: fila.vigente_desde ? fechaISO(fila.vigente_desde) : null,
    vigente_hasta: fila.vigente_hasta ? fechaISO(fila.vigente_hasta) : null,
    nombre_grado: fila.nombre_grado || null,
    seccion: fila.seccion || null,
    grado_nivel: fila.grado_nivel || null,
    pretickets: Number(fila.pretickets || 0),
    pagos: Number(fila.pagos || 0),
    pensiones: Number(fila.pensiones || 0),
  };
};

const normalizar = (data, actual = null) => {
  const tipo = String(data.tipo ?? actual?.tipo ?? "").trim().toUpperCase();
  if (!TIPOS.has(tipo)) {
    throw crearError("El tipo debe ser MATRICULA, PENSION u OTROS.");
  }

  const anioLectivo = parseAnio(
    data.anio_lectivo ?? actual?.anio_lectivo ?? getAnioLectivo(),
  );

  const mes = (() => {
    if (tipo === "PENSION") {
      return parseEntero(data.mes ?? actual?.mes, "mes", 1, 12, true);
    }
    if (tipo === "MATRICULA") return null;
    return parseEntero(data.mes ?? actual?.mes, "mes", 1, 12, false);
  })();

  const idGrado = parseEntero(
    data.id_grado !== undefined ? data.id_grado : actual?.id_grado,
    "grado",
    1,
    2147483647,
    false,
  );
  const nivel = aTexto(
    data.nivel !== undefined ? data.nivel : actual?.nivel,
    "nivel",
    20,
  );
  if (idGrado && nivel) {
    throw crearError("Elija alcance por grado o por nivel, no ambos.");
  }

  const nombre = aTexto(
    data.nombre !== undefined ? data.nombre : actual?.nombre,
    "nombre",
    100,
    true,
  );
  const montoBase = parseMonto(
    data.monto_base !== undefined ? data.monto_base : actual?.monto_base,
  );
  const descripcion = aTexto(
    data.descripcion !== undefined ? data.descripcion : actual?.descripcion,
    "descripción",
    250,
  );
  const orden = parseEntero(
    data.orden !== undefined ? data.orden : actual?.orden ?? 0,
    "orden",
    0,
    999999,
    false,
  ) ?? 0;

  const fechaDefecto = `${anioLectivo}-01-01`;
  const vigenteDesde =
    aFecha(
      data.vigente_desde !== undefined
        ? data.vigente_desde
        : actual?.vigente_desde ?? fechaDefecto,
      "vigencia inicial",
      true,
    ) || fechaDefecto;
  const vigenteHasta = aFecha(
    data.vigente_hasta !== undefined
      ? data.vigente_hasta
      : actual?.vigente_hasta,
    "vigencia final",
    false,
  );
  if (vigenteHasta && vigenteHasta < vigenteDesde) {
    throw crearError("La vigencia final no puede ser anterior a la inicial.");
  }

  if (tipo === "PENSION" && !mes) {
    throw crearError("La pensión debe tener un mes entre 1 y 12.");
  }
  if (tipo === "MATRICULA" && mes) {
    throw crearError("La matrícula no lleva mes.");
  }

  return {
    nombre,
    monto_base: montoBase,
    tipo,
    mes,
    anio_lectivo: anioLectivo,
    nivel: nivel || null,
    id_grado: idGrado,
    activo: aBooleano(data.activo, actual ? Boolean(actual.activo) : true),
    descripcion: descripcion || null,
    orden,
    vigente_desde: vigenteDesde,
    vigente_hasta: vigenteHasta || null,
  };
};

const validarMotivo = (motivo) => {
  const texto = String(motivo || "").trim();
  if (texto.length < MIN_MOTIVO) {
    throw crearError(
      "El motivo debe tener al menos 10 caracteres.",
      400,
      { codigo: "MOTIVO_REQUERIDO" },
    );
  }
  if (texto.length > MAX_MOTIVO) {
    throw crearError("El motivo no puede superar 500 caracteres.");
  }
  return texto;
};

const crearHash = (payload) =>
  crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

const calcularPreview = async (
  data,
  { id = null, modo = "crear", client = null } = {},
) => {
  const actual = id ? await conceptoPagoDao.findById(id, client) : null;
  if (id && !actual) {
    throw crearError("Concepto de pago no encontrado.", 404);
  }

  const propuesta = normalizar(data, actual);
  const impacto = await conceptoPagoDao.impacto(
    {
      anio: propuesta.anio_lectivo,
      tipo: propuesta.tipo,
      mes: propuesta.mes,
      idGrado: propuesta.id_grado,
      nivel: propuesta.nivel,
      idConcepto: actual?.id_concepto || null,
    },
    client,
  );

  const advertencias = [];
  if (actual) {
    const dependencias =
      Number(actual.pagos || 0) +
      Number(actual.pretickets || 0) +
      Number(actual.pensiones || 0);
    if (dependencias > 0) {
      advertencias.push({
        codigo: "TARIFA_EN_USO",
        mensaje:
          "La tarifa tiene pagos, pre-tickets o pensiones asociados. Para cambiar el monto debe crear una nueva versión; no se reprecian cargos existentes.",
      });
    }
  }
  if (Number(impacto.pensiones_pendientes || 0) > 0) {
    advertencias.push({
      codigo: "PENSIONES_PENDIENTES",
      mensaje: `Hay ${impacto.pensiones_pendientes} pensión(es) PENDIENTE que no se modificarán automáticamente.`,
    });
  }
  if (Number(impacto.pagos_realizados || 0) > 0) {
    advertencias.push({
      codigo: "PAGOS_REALIZADOS",
      mensaje: `Hay ${impacto.pagos_realizados} pago(s) realizado(s) que se mantienen intactos.`,
    });
  }

  const payloadHash = {
    version: 1,
    modo,
    id_concepto: actual?.id_concepto || null,
    actual: actual
      ? {
          nombre: actual.nombre,
          monto_base: aMontoFijo(actual.monto_base),
          tipo: actual.tipo,
          mes: actual.mes,
          anio_lectivo: Number(actual.anio_lectivo),
          nivel: actual.nivel || null,
          id_grado: actual.id_grado || null,
          activo: Boolean(actual.activo),
          vigente_desde: fechaISO(actual.vigente_desde),
          vigente_hasta: fechaISO(actual.vigente_hasta),
        }
      : null,
    propuesta,
    impacto,
  };

  return {
    modo,
    actual: serializar(actual),
    propuesta,
    impacto,
    advertencias,
    preview_hash: crearHash(payloadHash),
  };
};

const preview = async (data, opciones = {}) => {
  try {
    return await calcularPreview(data, opciones);
  } catch (error) {
    if (esNoAplicada(error)) throw errorNoAplicada();
    throw error;
  }
};

const listar = async (filtros) => {
  try {
    const anio = parseAnio(filtros.anio ?? getAnioLectivo());
    const filas = await conceptoPagoDao.listar({
      anio,
      tipo: filtros.tipo ? String(filtros.tipo).toUpperCase() : null,
      idGrado: parseEntero(filtros.id_grado, "grado", 1, 2147483647),
      nivel: filtros.nivel ? String(filtros.nivel).trim() : null,
      incluirInactivos:
        filtros.incluir_inactivos === "1" ||
        filtros.incluir_inactivos === "true",
    });
    return filas.map(serializar);
  } catch (error) {
    if (esNoAplicada(error)) throw errorNoAplicada();
    throw error;
  }
};

const obtener = async (id) => {
  try {
    const fila = await conceptoPagoDao.findById(id);
    if (!fila) throw crearError("Concepto de pago no encontrado.", 404);
    return serializar(fila);
  } catch (error) {
    if (esNoAplicada(error)) throw errorNoAplicada();
    throw error;
  }
};

const traducirErrorBd = (error) => {
  if (error?.code === "23505") {
    return crearError(
      "Ya existe una tarifa abierta para ese año, tipo, mes y alcance.",
      409,
      { codigo: "TARIFA_DUPLICADA" },
    );
  }
  if (error?.code === "23514") {
    return crearError(error.message, 400, { codigo: "TARIFA_INVALIDA" });
  }
  if (esNoAplicada(error)) return errorNoAplicada();
  return error;
};

const crear = async (data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  if (!data.preview_hash) {
    throw crearError("Falta la vista previa de la tarifa.");
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`tarifas:${data.anio_lectivo || ""}`],
    );

    const vista = await calcularPreview(data, {
      modo: "crear",
      client,
    });
    if (vista.preview_hash !== data.preview_hash) {
      throw crearError(
        "La vista previa cambió. Vuelva a previsualizar antes de guardar.",
        409,
        { codigo: "PREVIEW_DESACTUALIZADA" },
      );
    }

    const creado = await conceptoPagoDao.crear(
      {
        ...vista.propuesta,
        id_usuario: usuario?.id_usuario || null,
      },
      client,
    );

    await auditoriaService.registrarEnTransaccion(client, {
      id_usuario: usuario?.id_usuario || null,
      modulo: "Configuración",
      accion: "CREAR",
      descripcion: `Tarifa ${creado.nombre} (${creado.tipo})`,
      anterior: null,
      nuevo: serializar(creado),
      motivo,
      ip,
    });

    await client.query("COMMIT");
    return serializar(creado);
  } catch (error) {
    await client.query("ROLLBACK");
    throw traducirErrorBd(error);
  } finally {
    client.release();
  }
};

const actualizar = async (id, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  if (!data.preview_hash) {
    throw crearError("Falta la vista previa de la tarifa.");
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`tarifas:${id}`],
    );

    const actual = await conceptoPagoDao.findByIdForUpdate(id, client);
    if (!actual) throw crearError("Concepto de pago no encontrado.", 404);

    const dependencias = await conceptoPagoDao.contarDependencias(id, client);
    if (
      Number(dependencias.pagos) +
        Number(dependencias.pretickets) +
        Number(dependencias.pensiones) >
      0
    ) {
      throw crearError(
        "La tarifa está en uso. Cree una nueva versión para cambiar el monto sin alterar el historial.",
        409,
        { codigo: "TARIFA_CON_DEPENDENCIAS", ...dependencias },
      );
    }

    const vista = await calcularPreview(data, {
      id,
      modo: "editar",
      client,
    });
    if (vista.preview_hash !== data.preview_hash) {
      throw crearError(
        "La vista previa cambió. Vuelva a previsualizar antes de guardar.",
        409,
        { codigo: "PREVIEW_DESACTUALIZADA" },
      );
    }

    const actualizado = await conceptoPagoDao.actualizar(
      id,
      {
        ...vista.propuesta,
        id_usuario: usuario?.id_usuario || null,
      },
      client,
    );

    await auditoriaService.registrarEnTransaccion(client, {
      id_usuario: usuario?.id_usuario || null,
      modulo: "Configuración",
      accion: "MODIFICAR",
      descripcion: `Tarifa ${actualizado.nombre} (${actualizado.tipo})`,
      anterior: serializar(actual),
      nuevo: serializar(actualizado),
      motivo,
      ip,
    });

    await client.query("COMMIT");
    return serializar(actualizado);
  } catch (error) {
    await client.query("ROLLBACK");
    throw traducirErrorBd(error);
  } finally {
    client.release();
  }
};

const programarVersion = async (id, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  if (!data.preview_hash) {
    throw crearError("Falta la vista previa de la tarifa.");
  }
  const nuevaFecha = aFecha(data.vigente_desde, "vigencia inicial", true);

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`tarifas:${id}`],
    );

    const actual = await conceptoPagoDao.findByIdForUpdate(id, client);
    if (!actual) throw crearError("Concepto de pago no encontrado.", 404);

    const desdeActual = fechaISO(actual.vigente_desde);
    if (nuevaFecha <= desdeActual) {
      throw crearError(
        "La nueva versión debe empezar después del inicio de la versión actual.",
      );
    }
    if (actual.vigente_hasta && nuevaFecha > fechaISO(actual.vigente_hasta)) {
      throw crearError(
        "La nueva versión debe empezar dentro de la vigencia actual.",
      );
    }

    const vista = await calcularPreview(data, {
      id,
      modo: "version",
      client,
    });
    if (vista.preview_hash !== data.preview_hash) {
      throw crearError(
        "La vista previa cambió. Vuelva a previsualizar antes de guardar.",
        409,
        { codigo: "PREVIEW_DESACTUALIZADA" },
      );
    }

    const hastaAnterior = new Date(`${nuevaFecha}T00:00:00`);
    hastaAnterior.setDate(hastaAnterior.getDate() - 1);
    const hastaAnteriorTexto = hastaAnterior.toISOString().slice(0, 10);

    const cerrada = await conceptoPagoDao.cerrarVigencia(
      id,
      hastaAnteriorTexto,
      usuario?.id_usuario || null,
      client,
    );

    const nueva = await conceptoPagoDao.crear(
      {
        ...vista.propuesta,
        vigente_desde: nuevaFecha,
        vigente_hasta: data.vigente_hasta ?? null,
        id_usuario: usuario?.id_usuario || null,
      },
      client,
    );

    await auditoriaService.registrarEnTransaccion(client, {
      id_usuario: usuario?.id_usuario || null,
      modulo: "Configuración",
      accion: "PROGRAMAR",
      descripcion: `Nueva versión de tarifa ${nueva.nombre} desde ${nuevaFecha}`,
      anterior: serializar(cerrada),
      nuevo: serializar(nueva),
      motivo,
      ip,
    });

    await client.query("COMMIT");
    return {
      anterior: serializar(cerrada),
      nueva: serializar(nueva),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw traducirErrorBd(error);
  } finally {
    client.release();
  }
};

const desactivar = async (id, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`tarifas:${id}`],
    );

    const actual = await conceptoPagoDao.findByIdForUpdate(id, client);
    if (!actual) throw crearError("Concepto de pago no encontrado.", 404);
    if (!actual.activo) {
      throw crearError("La tarifa ya está desactivada.", 409);
    }

    const desactivada = await conceptoPagoDao.desactivar(
      id,
      usuario?.id_usuario || null,
      client,
    );

    await auditoriaService.registrarEnTransaccion(client, {
      id_usuario: usuario?.id_usuario || null,
      modulo: "Configuración",
      accion: "DESACTIVAR",
      descripcion: `Tarifa ${actual.nombre} desactivada`,
      anterior: serializar(actual),
      nuevo: serializar(desactivada),
      motivo,
      ip,
    });

    await client.query("COMMIT");
    return serializar(desactivada);
  } catch (error) {
    await client.query("ROLLBACK");
    throw traducirErrorBd(error);
  } finally {
    client.release();
  }
};

module.exports = {
  listar,
  obtener,
  preview,
  crear,
  actualizar,
  programarVersion,
  desactivar,
  resolver: conceptoPagoDao.resolver,
};
