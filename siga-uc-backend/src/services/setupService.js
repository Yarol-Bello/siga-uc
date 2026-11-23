/**
 * Primera configuración del sistema (H79 / Fase 7)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * El asistente solo funciona mientras no exista un ADMIN y la bandera
 * setup_completado sea falsa. El token es de un solo uso lógico: al
 * completar el setup, el endpoint queda bloqueado por la bandera.
 */

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const setupDao = require("../dao/setupDao");
const configuracionDao = require("../dao/configuracionDao");
const configuracionService = require("./configuracionService");
const auditoriaService = require("./auditoriaService");
const { getClient } = require("../config/database");
const { getAnioLectivo, setAnioActivo } = require("../config/academico");

const MIN_PASSWORD = 8;
const MAX_INTENTOS = 8;
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;
const intentos = new Map();
const tokenEnv = String(process.env.SETUP_TOKEN || "").trim();
const tokenGenerado = crypto.randomBytes(24).toString("hex");
const tokenActual = tokenEnv || tokenGenerado;
const tokenDesdeEnv = Boolean(tokenEnv);
let tokenAnunciado = false;

const crearError = (mensaje, statusCode = 400, details = null) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
};

const esMigracionFaltante = (error) =>
  error?.code === "42P01" || error?.code === "42703";

const tokenConfigurado = () =>
  tokenDesdeEnv
    ? tokenActual.length >= 16
    : process.env.NODE_ENV !== "production";

const tokenValido = (recibido) => {
  const esperado = Buffer.from(tokenActual);
  const candidato = Buffer.from(String(recibido || ""));
  return (
    candidato.length === esperado.length &&
    crypto.timingSafeEqual(candidato, esperado)
  );
};

const ipDe = (ip) => String(ip || "local").replace(/^::ffff:/, "");

const verificarLimite = (ip) => {
  const clave = ipDe(ip);
  const ahora = Date.now();
  const registro = intentos.get(clave);
  if (!registro || registro.expira <= ahora) {
    intentos.delete(clave);
    return;
  }
  if (registro.total >= MAX_INTENTOS) {
    throw crearError(
      "Demasiados intentos de configuración. Espere 15 minutos.",
      429,
      { codigo: "SETUP_BLOQUEADO" },
    );
  }
};

const registrarFallo = (ip) => {
  const clave = ipDe(ip);
  const ahora = Date.now();
  const registro = intentos.get(clave);
  if (!registro || registro.expira <= ahora) {
    intentos.set(clave, { total: 1, expira: ahora + VENTANA_INTENTOS_MS });
    return;
  }
  registro.total += 1;
};

const limpiarIntentos = (ip) => {
  intentos.delete(ipDe(ip));
};

const parseEntero = (valor, campo, min, max) => {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    throw crearError(`El campo ${campo} debe estar entre ${min} y ${max}.`);
  }
  return numero;
};

const parseFecha = (valor, campo, defecto) => {
  if (valor === undefined || valor === null || valor === "") return defecto;
  const texto = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw crearError(`El campo ${campo} debe tener formato YYYY-MM-DD.`);
  }
  return texto;
};

const textoObligatorio = (valor, campo, max = 150) => {
  const texto = String(valor || "").trim();
  if (!texto) throw crearError(`El campo ${campo} es obligatorio.`);
  if (texto.length > max) {
    throw crearError(`El campo ${campo} no puede superar ${max} caracteres.`);
  }
  return texto;
};

const textoOpcional = (valor, max = 150) => {
  const texto = String(valor || "").trim();
  if (!texto) return null;
  if (texto.length > max) {
    throw crearError(`El campo no puede superar ${max} caracteres.`);
  }
  return texto;
};

const validarCorreo = (valor) => {
  const correo = String(valor || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw crearError("El correo electrónico no tiene un formato válido.");
  }
  if (correo.length > 150) {
    throw crearError("El correo no puede superar 150 caracteres.");
  }
  return correo;
};

const validarAdmin = (admin = {}) => {
  const dni = String(admin.dni || "").trim();
  if (!/^\d{8}$/.test(dni)) {
    throw crearError("El DNI del administrador debe tener 8 dígitos.");
  }
  const nombres = textoObligatorio(admin.nombres, "nombres", 100);
  const apellidos = textoObligatorio(admin.apellidos, "apellidos", 100);
  const correo = validarCorreo(admin.correo);
  const password = String(admin.password || "");
  if (password.length < MIN_PASSWORD) {
    throw crearError(
      `La contraseña del administrador debe tener al menos ${MIN_PASSWORD} caracteres.`,
    );
  }
  if (
    admin.confirmar_password !== undefined &&
    String(admin.confirmar_password) !== password
  ) {
    throw crearError("La confirmación de contraseña no coincide.");
  }
  return {
    dni,
    nombres,
    apellidos,
    correo,
    password,
    telefono: textoOpcional(admin.telefono, 15),
  };
};

const NIVELES = {
  INICIAL: [
    { nombre: "3 años", orden: 1 },
    { nombre: "4 años", orden: 2 },
    { nombre: "5 años", orden: 3 },
  ],
  PRIMARIA: [
    { nombre: "1ro de Primaria", orden: 1 },
    { nombre: "2do de Primaria", orden: 2 },
    { nombre: "3ro de Primaria", orden: 3 },
    { nombre: "4to de Primaria", orden: 4 },
    { nombre: "5to de Primaria", orden: 5 },
    { nombre: "6to de Primaria", orden: 6 },
  ],
  SECUNDARIA: [
    { nombre: "1ro de Secundaria", orden: 1 },
    { nombre: "2do de Secundaria", orden: 2 },
    { nombre: "3ro de Secundaria", orden: 3 },
    { nombre: "4to de Secundaria", orden: 4 },
    { nombre: "5to de Secundaria", orden: 5 },
  ],
};

const validarNiveles = (niveles) => {
  const lista = Array.isArray(niveles)
    ? [...new Set(niveles.map((n) => String(n).toUpperCase()))]
    : [];
  if (lista.length === 0) {
    throw crearError("Seleccione al menos un nivel para crear los grados.");
  }
  for (const nivel of lista) {
    if (!NIVELES[nivel]) {
      throw crearError(`Nivel inválido: ${nivel}.`);
    }
  }
  return lista;
};

const estadoPublico = async () => {
  try {
    const fila = await setupDao.obtenerEstado();
    if (!fila) {
      return {
        requiere_setup: false,
        setup_disponible: false,
        setup_completado: false,
        token_configurado: tokenConfigurado(),
        mensaje: "Falta la configuración institucional base (H74).",
      };
    }
    const admins = Number(fila.admins || 0);
    const completado = Boolean(fila.setup_completado) || admins > 0;
    return {
      requiere_setup: !completado,
      setup_disponible: true,
      setup_completado: completado,
      token_configurado: tokenConfigurado(),
      anio_lectivo_sugerido: getAnioLectivo(),
    };
  } catch (error) {
    if (esMigracionFaltante(error)) {
      return {
        requiere_setup: false,
        setup_disponible: false,
        setup_completado: false,
        token_configurado: tokenConfigurado(),
        mensaje: "Aplique la migración H79 para habilitar la primera configuración.",
      };
    }
    console.warn("⚠️ No se pudo consultar el estado de setup:", error.message);
    return {
      requiere_setup: false,
      setup_disponible: false,
      setup_completado: false,
      token_configurado: tokenConfigurado(),
      mensaje: "No se pudo consultar el estado de configuración.",
    };
  }
};

const anunciarTokenSiPendiente = async () => {
  if (tokenAnunciado) return;
  const estado = await estadoPublico();
  if (!estado.requiere_setup || !estado.setup_disponible) return;
  tokenAnunciado = true;

  if (!estado.token_configurado) {
    console.warn(
      "⚠️ Configuración inicial pendiente, pero falta SETUP_TOKEN. Defina SETUP_TOKEN (mínimo 16 caracteres) para habilitar /setup.",
    );
    return;
  }

  if (tokenDesdeEnv) {
    console.log(
      "🔐 Configuración inicial pendiente. Use el token definido en SETUP_TOKEN.",
    );
    return;
  }

  console.log("🔐 Configuración inicial pendiente.");
  console.log(`   Token de un solo uso: ${tokenActual}`);
  console.log("   Consérvelo y no lo comparta. Se imprimirá solo una vez.\n");
};

const inicializar = async (data = {}, ip = null) => {
  verificarLimite(ip);

  if (!tokenConfigurado()) {
    throw crearError(
      "La configuración inicial no está habilitada. Defina SETUP_TOKEN en el servidor.",
      503,
      { codigo: "SETUP_TOKEN_NO_CONFIGURADO" },
    );
  }

  if (!tokenValido(data.token)) {
    registrarFallo(ip);
    throw crearError(
      "Token de configuración inválido.",
      401,
      { codigo: "SETUP_TOKEN_INVALIDO" },
    );
  }

  const adminData = validarAdmin(data.admin || {});
  const niveles = validarNiveles(data.niveles);
  const anio = parseEntero(data.anio_lectivo, "año lectivo", 2000, 2100);
  const fechaInicio = parseFecha(
    data.fecha_inicio,
    "fecha de inicio",
    `${anio}-01-01`,
  );
  const fechaFin = parseFecha(
    data.fecha_fin,
    "fecha de fin",
    `${anio}-12-31`,
  );
  if (fechaFin < fechaInicio) {
    throw crearError("La fecha de fin no puede ser anterior al inicio.");
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('setup:inicial'))",
    );

    const config = await setupDao.obtenerConfiguracionParaSetup(client);
    if (!config) {
      throw crearError(
        "Falta la configuración institucional base (H74).",
        503,
        { codigo: "CONFIG_NO_APLICADA" },
      );
    }
    if (config.setup_completado) {
      throw crearError(
        "El sistema ya fue configurado inicialmente.",
        409,
        { codigo: "SETUP_YA_COMPLETADO" },
      );
    }

    const admins = await setupDao.contarAdmins(client);
    if (admins > 0) {
      throw crearError(
        "El sistema ya tiene un administrador. La configuración inicial está cerrada.",
        409,
        { codigo: "SETUP_YA_COMPLETADO" },
      );
    }

    await setupDao.asegurarRoles(client);
    await setupDao.asegurarEscala(client);
    const rolAdmin = await setupDao.obtenerRolAdmin(client);
    if (!rolAdmin) {
      throw crearError(
        "No se pudo preparar el rol ADMIN.",
        500,
        { codigo: "ROL_ADMIN_NO_DISPONIBLE" },
      );
    }

    const passwordHash = await bcrypt.hash(adminData.password, 10);
    const admin = await setupDao.crearAdmin(client, {
      ...adminData,
      id_rol: rolAdmin.id_rol,
      password_hash: passwordHash,
    });
    await setupDao.crearPersonalAdmin(client, admin.id_usuario);

    const institucion = configuracionService.normalizarInstitucion(
      data.institucion || {},
      config,
    );
    await configuracionDao.actualizarInstitucion(
      institucion,
      client,
      admin.id_usuario,
    );

    await setupDao.activarAnio(client, {
      anio,
      fechaInicio,
      fechaFin,
      idUsuario: admin.id_usuario,
    });

    for (const nivel of niveles) {
      for (const grado of NIVELES[nivel]) {
        await setupDao.crearGrado(client, {
          nombre: grado.nombre,
          nivel,
          seccion: "Única",
          anio,
          orden: grado.orden,
        });
      }
    }

    await setupDao.crearCajaPrincipal(client, admin.id_usuario);
    await setupDao.marcarCompletado(client, admin.id_usuario);

    await auditoriaService.registrarEnTransaccion(client, {
      id_usuario: admin.id_usuario,
      modulo: "Configuración",
      accion: "CONFIGURACION_INICIAL",
      descripcion: "Primera configuración del sistema",
      nuevo: {
        id_usuario: admin.id_usuario,
        dni: admin.dni,
        anio_lectivo: anio,
        niveles,
        institucion: institucion.nombre_institucion,
      },
      motivo: "Configuración inicial del sistema",
      ip,
    });

    await client.query("COMMIT");
    setAnioActivo(anio);
    limpiarIntentos(ip);

    return {
      setup_completado: true,
      admin: {
        id_usuario: admin.id_usuario,
        dni: admin.dni,
        nombre_completo: `${admin.nombres} ${admin.apellidos}`,
      },
      anio_lectivo: anio,
      institucion: institucion.nombre_institucion,
      niveles,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "23505") {
      throw crearError(
        "El DNI o correo del administrador ya está registrado.",
        409,
        { codigo: "ADMIN_DUPLICADO" },
      );
    }
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  estadoPublico,
  anunciarTokenSiPendiente,
  inicializar,
};
