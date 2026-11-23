/**
 * Servicio de becas y tipos de beca (Fase 5 / H78)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const becaDao = require("../dao/becaDao");
const alumnoDao = require("../dao/alumnoDao");
const becaCalculator = require("./becaCalculator");
const auditoriaService = require("./auditoriaService");
const { getClient } = require("../config/database");

const MIN_MOTIVO = 10;
const MAX_MOTIVO = 500;

const crearError = (mensaje, statusCode = 400, details = null) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

const esNoAplicada = (error) =>
  error?.code === "42P01" || error?.code === "42703";

const errorNoAplicada = () =>
  crearError(
    "El módulo de becas no está aplicado. Ejecute H78.",
    503,
    { codigo: "BECAS_NO_APLICADAS" },
  );

const validarMotivo = (motivo) => {
  const texto = String(motivo || "").trim();
  if (texto.length < MIN_MOTIVO) {
    throw crearError("El motivo debe tener al menos 10 caracteres.", 400, {
      codigo: "MOTIVO_REQUERIDO",
    });
  }
  if (texto.length > MAX_MOTIVO) {
    throw crearError("El motivo no puede superar 500 caracteres.");
  }
  return texto;
};

const parseFecha = (valor, campo, obligatorio = false) => {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") {
    if (obligatorio) throw crearError(`El campo ${campo} es obligatorio.`);
    return null;
  }
  const texto = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw crearError(`El campo ${campo} debe tener formato YYYY-MM-DD.`);
  }
  return texto;
};

const parseMonto = (valor, campo, obligatorio = false) => {
  if (valor === undefined || valor === null || valor === "") {
    if (obligatorio) throw crearError(`El campo ${campo} es obligatorio.`);
    return null;
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw crearError(`El campo ${campo} no puede ser negativo.`);
  }
  return Math.round(numero * 100) / 100;
};

const parseEntero = (valor, campo, min, max, defecto = null) => {
  if (valor === undefined || valor === null || valor === "") return defecto;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    throw crearError(`El campo ${campo} debe ser un entero entre ${min} y ${max}.`);
  }
  return numero;
};

const traducirErrorBd = (error) => {
  if (error?.statusCode) return error;
  if (error?.code === "23505") {
    return crearError("Ya existe un registro con ese código.", 409, {
      codigo: "BECA_DUPLICADA",
    });
  }
  if (error?.code === "23503") {
    return crearError("El registro está en uso y no puede eliminarse.", 409, {
      codigo: "BECA_EN_USO",
    });
  }
  if (esNoAplicada(error)) return errorNoAplicada();
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

const auditar = async (
  client,
  usuario,
  accion,
  descripcion,
  anterior,
  nuevo,
  motivo,
  ip,
) => {
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

/**
 * Aplica las becas vigentes a cargos pendientes del alumno. Nunca toca
 * cargos pagados ni anulados: un cambio de beca no repreziza lo cobrado.
 */
const aplicarCobrosPendientes = async (client, idAlumno, idUsuario = null) => {
  await becaCalculator.aplicarPensionesAlumno(client, idAlumno, idUsuario);

  const pretickets = await becaDao.listarPreticketsMatriculaPendientes(
    idAlumno,
    client,
  );
  for (const preticket of pretickets) {
    const base =
      Number(preticket.monto || 0) + Number(preticket.descuento || 0);
    const aplicacion = await becaCalculator.aplicarPreticket(client, {
      idPreticket: preticket.id_preticket,
      idAlumno,
      base,
      idUsuario,
    });
    if (aplicacion.exonerado) {
      await client.query(
        `UPDATE alumnos SET estado_matricula = 'Matriculado' WHERE id_alumno = $1`,
        [idAlumno],
      );
    }
  }
};

/**
 * Recalcula cargos pendientes y reactiva la matrícula cuando una beca
 * exonerada se anula y vuelve a quedar saldo por pagar.
 */
const revertirCobros = async (client, idAlumno, idUsuario = null) => {
  await becaCalculator.aplicarPensionesAlumno(client, idAlumno, idUsuario);

  const exonerados = await becaDao.listarPreticketsExonerados(
    idAlumno,
    client,
  );
  for (const preticket of exonerados) {
    const base =
      Number(preticket.monto || 0) + Number(preticket.descuento || 0);
    const aplicacion = await becaCalculator.aplicarPreticket(client, {
      idPreticket: preticket.id_preticket,
      idAlumno,
      base,
      idUsuario,
    });
    if (!aplicacion.exonerado) {
      await client.query(
        `UPDATE alumnos SET estado_matricula = 'PendientePago'
         WHERE id_alumno = $1 AND estado_matricula = 'Matriculado'`,
        [idAlumno],
      );
    }
  }
};

const listarTipos = async (incluirInactivos = false) => {
  try {
    return await becaDao.listarTipos(incluirInactivos);
  } catch (error) {
    if (esNoAplicada(error)) throw errorNoAplicada();
    throw error;
  }
};

const normalizarTipo = (data, actual = null) => {
  const codigo = String(data.codigo ?? actual?.codigo ?? "")
    .trim()
    .toUpperCase();
  if (!codigo || !/^[A-Z0-9_]{2,50}$/.test(codigo)) {
    throw crearError("El código debe tener entre 2 y 50 letras, números o guiones bajos.");
  }
  const nombre = String(data.nombre ?? actual?.nombre ?? "").trim();
  if (!nombre || nombre.length > 150) {
    throw crearError("El nombre es obligatorio y no puede superar 150 caracteres.");
  }
  const alcance = String(data.alcance ?? actual?.alcance ?? "PENSION").toUpperCase();
  if (!["MATRICULA", "PENSION", "AMBOS"].includes(alcance)) {
    throw crearError("El alcance debe ser MATRICULA, PENSION o AMBOS.");
  }
  const modalidad = String(
    data.modalidad ?? actual?.modalidad ?? "PORCENTAJE",
  ).toUpperCase();
  if (!["PORCENTAJE", "MONTO_FIJO"].includes(modalidad)) {
    throw crearError("La modalidad debe ser PORCENTAJE o MONTO_FIJO.");
  }
  const valorDefault = parseMonto(
    data.valor_default ?? actual?.valor_default ?? 0,
    "valor por defecto",
  );
  if (modalidad === "PORCENTAJE" && valorDefault > 100) {
    throw crearError("El porcentaje no puede superar 100.");
  }
  const tope = parseMonto(data.tope_monto ?? actual?.tope_monto, "tope");
  const prioridad = parseEntero(
    data.prioridad ?? actual?.prioridad ?? 0,
    "prioridad",
    -9999,
    9999,
    0,
  );
  const orden = parseEntero(
    data.orden ?? actual?.orden ?? 0,
    "orden",
    0,
    999999,
    0,
  );

  return {
    codigo,
    nombre,
    descripcion: data.descripcion ?? actual?.descripcion ?? null,
    alcance,
    modalidad,
    valor_default: valorDefault,
    tope_monto: tope,
    permite_combinacion:
      data.permite_combinacion !== undefined
        ? Boolean(data.permite_combinacion)
        : Boolean(actual?.permite_combinacion),
    grupo_exclusividad:
      data.grupo_exclusividad ?? actual?.grupo_exclusividad ?? null,
    prioridad,
    requiere_evidencia:
      data.requiere_evidencia !== undefined
        ? Boolean(data.requiere_evidencia)
        : Boolean(actual?.requiere_evidencia),
    requiere_aprobacion:
      data.requiere_aprobacion !== undefined
        ? Boolean(data.requiere_aprobacion)
        : actual
          ? Boolean(actual.requiere_aprobacion)
          : true,
    activo:
      data.activo !== undefined
        ? Boolean(data.activo)
        : actual
          ? Boolean(actual.activo)
          : true,
    orden,
  };
};

const crearTipo = async (data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const tipo = normalizarTipo(data);
  return await conTransaccion(async (client) => {
    const creado = await becaDao.crearTipo(
      { ...tipo, id_usuario: usuario?.id_usuario || null },
      client,
    );
    await auditar(
      client,
      usuario,
      "CREAR",
      `Tipo de beca ${creado.nombre}`,
      null,
      creado,
      motivo,
      ip,
    );
    return creado;
  });
};

const actualizarTipo = async (id, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const actual = await becaDao.findTipoById(id);
  if (!actual) throw crearError("Tipo de beca no encontrado.", 404);
  const tipo = normalizarTipo(data, actual);
  return await conTransaccion(async (client) => {
    const actualizado = await becaDao.actualizarTipo(
      id,
      { ...tipo, id_usuario: usuario?.id_usuario || null },
      client,
    );
    await auditar(
      client,
      usuario,
      "MODIFICAR",
      `Tipo de beca ${actualizado.nombre}`,
      actual,
      actualizado,
      motivo,
      ip,
    );
    return actualizado;
  });
};

const listarBecas = async (filtros = {}) => {
  try {
    return await becaDao.listarBecas({
      anio: filtros.anio ? Number(filtros.anio) : null,
      id_alumno: filtros.id_alumno ? Number(filtros.id_alumno) : null,
      id_tipo_beca: filtros.id_tipo_beca
        ? Number(filtros.id_tipo_beca)
        : null,
      estado: filtros.estado ? String(filtros.estado).toUpperCase() : null,
      activo:
        filtros.activo !== undefined
          ? filtros.activo === "1" || filtros.activo === "true"
          : undefined,
      id_grado: filtros.id_grado ? Number(filtros.id_grado) : null,
    });
  } catch (error) {
    if (esNoAplicada(error)) throw errorNoAplicada();
    throw error;
  }
};

const normalizarBeca = (data, tipo, actual = null) => {
  const alcance = String(
    data.alcance ?? actual?.alcance ?? tipo.alcance ?? "PENSION",
  ).toUpperCase();
  if (!["MATRICULA", "PENSION", "AMBOS"].includes(alcance)) {
    throw crearError("El alcance debe ser MATRICULA, PENSION o AMBOS.");
  }
  const modalidad = String(
    data.modalidad ?? actual?.modalidad ?? tipo.modalidad ?? "PORCENTAJE",
  ).toUpperCase();
  if (!["PORCENTAJE", "MONTO_FIJO"].includes(modalidad)) {
    throw crearError("La modalidad debe ser PORCENTAJE o MONTO_FIJO.");
  }
  const valor = parseMonto(
    data.valor ?? actual?.valor ?? tipo.valor_default,
    "valor",
    true,
  );
  if (valor <= 0) {
    throw crearError("El valor de la beca debe ser mayor que cero.");
  }
  if (modalidad === "PORCENTAJE" && valor > 100) {
    throw crearError("El porcentaje no puede superar 100.");
  }
  const fechaInicio = parseFecha(
    data.fecha_inicio ?? actual?.fecha_inicio,
    "fecha de inicio",
    true,
  );
  const fechaFin = parseFecha(
    data.fecha_fin !== undefined ? data.fecha_fin : actual?.fecha_fin,
    "fecha de fin",
  );
  if (fechaFin && fechaFin < fechaInicio) {
    throw crearError("La fecha de fin no puede ser anterior al inicio.");
  }
  const montoMaximo = parseMonto(
    data.monto_maximo ?? actual?.monto_maximo,
    "monto máximo",
  );
  const prioridad = parseEntero(
    data.prioridad ?? actual?.prioridad ?? tipo.prioridad ?? 0,
    "prioridad",
    -9999,
    9999,
    0,
  );
  const porcentaje =
    modalidad === "PORCENTAJE" ? valor : 0;
  const montoFijo = modalidad === "MONTO_FIJO" ? valor : 0;

  return {
    id_tipo_beca: tipo.id_tipo_beca,
    tipo: tipo.codigo,
    porcentaje_descuento: porcentaje,
    monto_descuento: montoFijo,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin || null,
    activo: actual ? Boolean(actual.activo) : true,
    alcance,
    modalidad,
    valor,
    monto_maximo: montoMaximo,
    estado: actual?.estado || "SOLICITADA",
    motivo: data.motivo ?? actual?.motivo ?? null,
    evidencia: data.evidencia ?? actual?.evidencia ?? null,
    aprobado_por: actual?.aprobado_por || null,
    fecha_aprobacion: actual?.fecha_aprobacion || null,
    grupo_exclusividad:
      data.grupo_exclusividad ??
      actual?.grupo_exclusividad ??
      tipo.grupo_exclusividad ??
      null,
    prioridad,
  };
};

const crearBeca = async (data, usuario = null, ip = null) => {
  const tipo = data.id_tipo_beca
    ? await becaDao.findTipoById(data.id_tipo_beca)
    : await becaDao.findTipoByCodigo(data.tipo);
  if (!tipo || !tipo.activo) {
    throw crearError("El tipo de beca no existe o está inactivo.", 404);
  }
  const alumno = await alumnoDao.findById(data.id_alumno);
  if (!alumno) throw crearError("Alumno no encontrado.", 404);

  const normalizada = normalizarBeca(data, tipo);
  const esAdmin = usuario?.rol === "ADMIN";
  const aprobar = esAdmin && Boolean(data.aprobar || data.estado === "APROBADA");
  const estado = aprobar ? "APROBADA" : "SOLICITADA";
  const motivo = data.motivo ? String(data.motivo).trim() : null;
  if (aprobar) {
    validarMotivo(data.motivo || "Aprobación inicial de beca");
    if (tipo.requiere_evidencia && !data.evidencia) {
      throw crearError(
        "Este tipo de beca requiere evidencia para aprobarse.",
        400,
        { codigo: "EVIDENCIA_REQUERIDA" },
      );
    }
  }

  const payload = {
    ...normalizada,
    id_alumno: alumno.id_alumno,
    estado,
    activo: estado === "APROBADA",
    motivo,
    aprobado_por: aprobar ? usuario?.id_usuario || null : null,
    fecha_aprobacion: aprobar ? new Date() : null,
    id_usuario: usuario?.id_usuario || null,
  };

  return await conTransaccion(async (client) => {
    const creada = await becaDao.crearBeca(payload, client);
    if (aprobar) {
      await aplicarCobrosPendientes(
        client,
        alumno.id_alumno,
        usuario?.id_usuario || null,
      );
    }
    await auditar(
      client,
      usuario,
      aprobar ? "APROBAR" : "SOLICITAR",
      `Beca ${tipo.nombre} para ${alumno.nombres} ${alumno.apellidos}`,
      null,
      creada,
      motivo || "Registro de beca",
      ip,
    );
    return creada;
  });
};

const cambiarEstadoBeca = async (
  id,
  estado,
  data,
  usuario = null,
  ip = null,
) => {
  const motivo = validarMotivo(data.motivo);
  const actual = await becaDao.findBecaById(id);
  if (!actual) throw crearError("Beca no encontrada.", 404);

  const transiciones = {
    APROBADA: ["SOLICITADA"],
    RECHAZADA: ["SOLICITADA"],
    ANULADA: ["APROBADA"],
  };
  if (!transiciones[estado]?.includes(actual.estado)) {
    throw crearError(
      `No se puede pasar de ${actual.estado} a ${estado}.`,
      409,
      { codigo: "TRANSICION_INVALIDA" },
    );
  }

  if (estado === "APROBADA") {
    const tipo = await becaDao.findTipoById(actual.id_tipo_beca);
    if (tipo?.requiere_evidencia && !actual.evidencia && !data.evidencia) {
      throw crearError(
        "Este tipo de beca requiere evidencia para aprobarse.",
        400,
        { codigo: "EVIDENCIA_REQUERIDA" },
      );
    }
  }

  const payload = {
    activo: estado === "APROBADA",
    motivo,
    aprobado_por: usuario?.id_usuario || null,
    fecha_aprobacion: estado === "APROBADA" ? new Date() : actual.fecha_aprobacion,
  };

  return await conTransaccion(async (client) => {
    const actualizada = await becaDao.cambiarEstado(
      id,
      estado,
      payload,
      client,
    );
    if (estado === "APROBADA") {
      await aplicarCobrosPendientes(
        client,
        actual.id_alumno,
        usuario?.id_usuario || null,
      );
    } else if (estado === "ANULADA") {
      await revertirCobros(
        client,
        actual.id_alumno,
        usuario?.id_usuario || null,
      );
    }
    await auditar(
      client,
      usuario,
      { APROBADA: "APROBAR", RECHAZADA: "RECHAZAR", ANULADA: "ANULAR" }[
        estado
      ] || estado,
      `Beca ${actual.tipo} de ${actual.alumno_nombre}: ${estado}`,
      {
        estado: actual.estado,
        activo: actual.activo,
      },
      actualizada,
      motivo,
      ip,
    );
    return actualizada;
  });
};

const aprobarBeca = (id, data, usuario, ip) =>
  cambiarEstadoBeca(id, "APROBADA", data, usuario, ip);
const rechazarBeca = (id, data, usuario, ip) =>
  cambiarEstadoBeca(id, "RECHAZADA", data, usuario, ip);
const anularBeca = (id, data, usuario, ip) =>
  cambiarEstadoBeca(id, "ANULADA", data, usuario, ip);

const actualizarBeca = async (id, data, usuario = null, ip = null) => {
  const motivo = validarMotivo(data.motivo);
  const actual = await becaDao.findBecaById(id);
  if (!actual) throw crearError("Beca no encontrada.", 404);
  const aplicaciones = await becaDao.contarAplicacionesBeca(id);
  if (aplicaciones > 0) {
    throw crearError(
      "La beca ya tiene aplicaciones. Anúlela y cree una nueva para cambiar sus reglas.",
      409,
      { codigo: "BECA_CON_APLICACIONES", aplicaciones },
    );
  }
  const tipo = await becaDao.findTipoById(actual.id_tipo_beca);
  if (!tipo) throw crearError("Tipo de beca no encontrado.", 404);
  const normalizada = normalizarBeca(data, tipo, actual);

  return await conTransaccion(async (client) => {
    const actualizada = await becaDao.actualizarBeca(
      id,
      { ...normalizada, id_usuario: usuario?.id_usuario || null },
      client,
    );
    await auditar(
      client,
      usuario,
      "MODIFICAR",
      `Beca ${actual.tipo} de ${actual.alumno_nombre}`,
      actual,
      actualizada,
      motivo,
      ip,
    );
    return actualizada;
  });
};

const previewBeca = async (data) => {
  const alumno = await alumnoDao.findById(data.id_alumno);
  if (!alumno) throw crearError("Alumno no encontrado.", 404);
  const base = parseMonto(data.base, "monto base", true);
  const alcance = String(data.alcance || "PENSION").toUpperCase();
  if (!["MATRICULA", "PENSION"].includes(alcance)) {
    throw crearError("El alcance de la previsualización debe ser MATRICULA o PENSION.");
  }
  const client = await getClient();
  try {
    return await becaCalculator.calcular(
      {
        idAlumno: alumno.id_alumno,
        alcance,
        base,
        fecha: data.fecha || new Date().toISOString().slice(0, 10),
      },
      client,
    );
  } finally {
    client.release();
  }
};

module.exports = {
  listarTipos,
  crearTipo,
  actualizarTipo,
  listarBecas,
  crearBeca,
  actualizarBeca,
  aprobarBeca,
  rechazarBeca,
  anularBeca,
  previewBeca,
};
