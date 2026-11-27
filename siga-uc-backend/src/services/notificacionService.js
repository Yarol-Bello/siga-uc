/**
 * Servicio de Notificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const notificacionDao = require("../dao/notificacionDao");
const usuarioDao = require("../dao/usuarioDao");
const emailService = require("./emailService");
const { getAnioLectivo } = require("../config/academico");

const listar = async (id_usuario, filtros) => {
  return await notificacionDao.listarPorUsuario(id_usuario, filtros);
};

const obtener = async (id, id_usuario) => {
  const notif = await notificacionDao.findById(id, id_usuario);
  if (!notif) {
    const error = new Error("Notificación no encontrada");
    error.statusCode = 404;
    throw error;
  }
  return notif;
};

const contarNoLeidas = async (id_usuario) => {
  const total = await notificacionDao.contarNoLeidas(id_usuario);
  return { no_leidas: total };
};

const crear = async (data) => {
  if (!data.id_usuario_destino || !data.asunto || !data.cuerpo) {
    const error = new Error(
      "Faltan campos: id_usuario_destino, asunto, cuerpo",
    );
    error.statusCode = 400;
    throw error;
  }

  // 1. Guardar la notificación en la BD
  const notificacion = await notificacionDao.crear(data);

  // 2. Enviar el correo real (no bloquea si falla)
  try {
    const usuarioDao = require("../dao/usuarioDao");
    const emailService = require("./emailService");

    // Obtener el email del destinatario y el nombre del remitente
    const destinatario = await usuarioDao.findById(data.id_usuario_destino);
    const remitente = data.id_usuario_remitente
      ? await usuarioDao.findById(data.id_usuario_remitente)
      : null;

    if (destinatario) {
      // 👇 Elegir el correo personal si existe, sino el institucional
      const correoDestino =
        destinatario.correo_personal || destinatario.correo_institucional;

      if (correoDestino) {
        await emailService.enviarNotificacion({
          to: correoDestino,
          destinatario: `${destinatario.nombres} ${destinatario.apellidos}`,
          asunto: data.asunto,
          cuerpo: data.cuerpo,
          remitente: remitente
            ? `${remitente.nombres} ${remitente.apellidos}`
            : "SIGA-UC",
        });
      }
    }
  } catch (emailError) {
    console.error(
      "⚠️  No se pudo enviar el correo, pero la notificación fue guardada:",
      emailError.message,
    );
  }

  return notificacion;
};

const TIPOS_DESTINATARIO = new Set([
  "TODOS",
  "GRADO",
  "ALUMNO",
  "PERSONAL",
  "ROL",
]);

const crearMasivo = async (data) => {
  const asunto = String(data.asunto || "").trim();
  const cuerpo = String(data.cuerpo || "").trim();

  if (!asunto || !cuerpo) {
    const error = new Error("El asunto y el cuerpo son obligatorios");
    error.statusCode = 400;
    throw error;
  }

  if (asunto.length > 200) {
    const error = new Error("El asunto no puede superar los 200 caracteres");
    error.statusCode = 400;
    throw error;
  }

  let destinatarios = [];
  let tipoDestinatario = "USUARIOS";
  let rolNombre = null;

  if (data.destinatarios && data.destinatarios.tipo) {
    const tipo = String(data.destinatarios.tipo).toUpperCase();

    if (!TIPOS_DESTINATARIO.has(tipo)) {
      const error = new Error("Tipo de destinatario inválido");
      error.statusCode = 400;
      throw error;
    }

    const id = data.destinatarios.id ? Number(data.destinatarios.id) : null;
    const requiereId = ["GRADO", "ALUMNO", "ROL"].includes(tipo);

    if (
      requiereId &&
      (!id || !Number.isInteger(id) || id <= 0)
    ) {
      const error = new Error(`Debe indicar un ${tipo.toLowerCase()} válido`);
      error.statusCode = 400;
      throw error;
    }

    if (tipo === "ROL") {
      const rol = await notificacionDao.findRolById(id);

      if (!rol) {
        const error = new Error(
          `El rol ${id} no existe. Para estudiantes use TODOS, GRADO o ALUMNO.`,
        );
        error.statusCode = 400;
        throw error;
      }

      if (![1, 2, 3].includes(Number(rol.id_rol))) {
        const error = new Error(
          "Para estudiantes use TODOS, GRADO o ALUMNO.",
        );
        error.statusCode = 400;
        throw error;
      }

      rolNombre = rol.nombre_rol;
    }

    tipoDestinatario = tipo;
    destinatarios = await notificacionDao.listarDestinatarios({
      tipo,
      id,
      anioLectivo: getAnioLectivo(),
    });
  } else if (Array.isArray(data.destinos)) {
    const ids = data.destinos
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id));

    if (ids.length === 0) {
      const error = new Error("Debe enviar al menos un destinatario");
      error.statusCode = 400;
      throw error;
    }

    destinatarios = await notificacionDao.listarDestinatariosPorIds(ids);
  } else {
    const error = new Error(
      "Debe indicar destinatarios: TODOS, GRADO, ALUMNO, PERSONAL o ROL",
    );
    error.statusCode = 400;
    throw error;
  }

  const destinatariosUnicos = Array.from(
    new Map(
      destinatarios.map((destinatario) => [
        Number(destinatario.id_usuario),
        destinatario,
      ]),
    ).values(),
  );

  if (destinatariosUnicos.length === 0) {
    const error = new Error(
      "No hay destinatarios activos para el envío seleccionado",
    );
    error.statusCode = 400;
    throw error;
  }

  const notificaciones = await notificacionDao.crearMasivo(
    destinatariosUnicos.map((destinatario) => destinatario.id_usuario),
    {
      id_usuario_remitente: data.id_usuario_remitente,
      asunto,
      cuerpo,
    },
  );

  const remitente = data.id_usuario_remitente
    ? await usuarioDao.findById(data.id_usuario_remitente)
    : null;
  const nombreRemitente = remitente
    ? `${remitente.nombres} ${remitente.apellidos}`
    : "SIGA-UC";

  const destinatariosConCorreo = destinatariosUnicos
    .map((destinatario) => ({
      ...destinatario,
      correoDestino:
        destinatario.correo_personal || destinatario.correo_institucional,
    }))
    .filter((destinatario) => Boolean(destinatario.correoDestino));

  const correosSinDestino =
    destinatariosUnicos.length - destinatariosConCorreo.length;

  let resultadoCorreos = {
    enviados: 0,
    fallidos: 0,
    resultados: [],
    error: null,
  };

  if (destinatariosConCorreo.length > 0) {
    try {
      resultadoCorreos = await emailService.enviarNotificacionLote({
        destinatarios: destinatariosConCorreo.map((destinatario) => ({
          to: destinatario.correoDestino,
          destinatario: `${destinatario.nombres} ${destinatario.apellidos}`,
        })),
        asunto,
        cuerpo,
        remitente: nombreRemitente,
      });
    } catch (emailError) {
      resultadoCorreos = {
        enviados: 0,
        fallidos: destinatariosConCorreo.length,
        resultados: [],
        error: emailError.message,
      };
      console.error(
        "⚠️ No se pudo enviar el lote de correos de la notificación:",
        emailError.message,
      );
    }
  }

  const correosEnviados = Number(resultadoCorreos.enviados) || 0;
  const correosFallidos = Number(resultadoCorreos.fallidos) || 0;
  const correosError =
    resultadoCorreos.error ||
    resultadoCorreos.resultados?.find((resultado) => !resultado.ok)?.error ||
    null;

  return {
    total_destinatarios: destinatariosUnicos.length,
    total_guardadas: notificaciones.length,
    correos_enviados: correosEnviados,
    correos_fallidos: correosFallidos,
    correos_sin_destino: correosSinDestino,
    correos_error: correosError,
    tipo: tipoDestinatario,
    rol_nombre: rolNombre,
  };
};

const marcarLeida = async (id, id_usuario) => {
  const notif = await notificacionDao.marcarLeida(id, id_usuario);
  if (!notif) {
    const error = new Error("Notificación no encontrada");
    error.statusCode = 404;
    throw error;
  }
  return notif;
};

const marcarTodasLeidas = async (id_usuario) => {
  const count = await notificacionDao.marcarTodasLeidas(id_usuario);
  return { marcadas: count };
};

const eliminar = async (id, id_usuario) => {
  const notif = await notificacionDao.eliminar(id, id_usuario);
  if (!notif) {
    const error = new Error("Notificación no encontrada");
    error.statusCode = 404;
    throw error;
  }
  return notif;
};

module.exports = {
  listar,
  obtener,
  contarNoLeidas,
  crear,
  crearMasivo,
  marcarLeida,
  marcarTodasLeidas,
  eliminar,
};
