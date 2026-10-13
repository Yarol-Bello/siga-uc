/**
 * Servicio de Notificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const notificacionDao = require("../dao/notificacionDao");

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

const crearMasivo = async (data) => {
  if (!Array.isArray(data.destinos) || data.destinos.length === 0) {
    const error = new Error("Debe enviar al menos un destinatario");
    error.statusCode = 400;
    throw error;
  }
  return await notificacionDao.crearMasivo(data.destinos, {
    id_usuario_remitente: data.id_usuario_remitente,
    asunto: data.asunto,
    cuerpo: data.cuerpo,
  });
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
