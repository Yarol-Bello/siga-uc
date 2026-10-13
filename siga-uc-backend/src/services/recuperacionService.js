/**
 * Servicio de Recuperación de Contraseña
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const crypto = require("crypto");
const usuarioDao = require("../dao/usuarioDao");
const recuperacionDao = require("../dao/recuperacionDao");
const emailService = require("./emailService");
const env = require("../config/env");

/**
 * Solicitar recuperación de contraseña
 * @param {string} identificador - DNI o correo (institucional o personal)
 */
const solicitarRecuperacion = async (identificador) => {
  if (!identificador) {
    const error = new Error("Debe proporcionar un DNI o correo");
    error.statusCode = 400;
    throw error;
  }

  // 1. Buscar al usuario
  const usuario = await usuarioDao.findByDniOCorreo(identificador.trim());

  if (!usuario || usuario.estado !== "ACTIVO") {
    // Por seguridad, no revelar si el usuario existe
    return { enviado: true, tieneCorreo: true };
  }

  // 2. Verificar si tiene correo personal
  const correoDestino = usuario.correo_personal || usuario.correo_institucional;

  if (!correoDestino) {
    // No tiene correo registrado → debe contactar al Admin
    return { enviado: false, tieneCorreo: false };
  }

  // 3. Generar token único
  const token = crypto.randomBytes(32).toString("hex");

  // 4. Fecha de expiración (2 horas)
  const fechaExpiracion = new Date(Date.now() + 2 * 60 * 60 * 1000);

  // 5. Guardar en BD
  await recuperacionDao.crearToken(usuario.id_usuario, token, fechaExpiracion);

  // 6. Enviar correo
  const urlBase = process.env.FRONTEND_URL || "http://localhost:4200";
  const enlace = `${urlBase}/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #F8FAFC; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #800020 0%, #4A0012 100%); color: white; padding: 30px 25px; text-align: center; }
        .header h1 { font-size: 1.3rem; margin: 0 0 5px 0; text-transform: uppercase; }
        .header p { font-size: 0.85rem; margin: 0; opacity: 0.9; }
        .body { padding: 30px 25px; color: #1E293B; line-height: 1.6; }
        .body h2 { color: #800020; font-size: 1.1rem; margin-bottom: 15px; }
        .btn-container { text-align: center; margin: 25px 0; }
        .btn { display: inline-block; padding: 14px 30px; background: #800020; color: white !important; text-decoration: none; border-radius: 8px; font-weight: 700; }
        .info-box { background: #FFFBEB; border-left: 4px solid #D4AF37; padding: 12px 16px; border-radius: 8px; font-size: 0.85rem; margin: 15px 0; }
        .footer { background: #F8FAFC; padding: 20px 25px; text-align: center; font-size: 0.78rem; color: #64748B; border-top: 1px solid #E2E8F0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>I.E.P. Unión Científica</h1>
          <p>Sistema Integrado de Gestión Académica — SIGA-UC</p>
        </div>
        <div class="body">
          <h2>🔑 Recuperación de Contraseña</h2>
          <p>Hola <strong>${usuario.nombres} ${usuario.apellidos}</strong>,</p>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en SIGA-UC.</p>
          <p>Para crear una nueva contraseña, haz clic en el siguiente botón:</p>
          <div class="btn-container">
            <a href="${enlace}" class="btn">Restablecer Mi Contraseña</a>
          </div>
          <div class="info-box">
            <strong>⏰ Importante:</strong> Este enlace expirará en <strong>2 horas</strong>. Si no solicitaste este cambio, ignora este correo.
          </div>
        </div>
        <div class="footer">
          <p>© 2026 I.E.P. Unión Científica — Huancayo, Junín</p>
          <p>Este es un correo automático, por favor no responder.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await emailService.enviarCorreo({
    to: correoDestino,
    subject: "[SIGA-UC] Recuperación de Contraseña",
    html,
  });

  return { enviado: true, tieneCorreo: true };
};

/**
 * Validar un token de recuperación
 */
const validarToken = async (token) => {
  const registro = await recuperacionDao.findTokenValido(token);
  if (!registro) {
    const error = new Error("Token inválido, expirado o ya utilizado");
    error.statusCode = 400;
    throw error;
  }
  return {
    valido: true,
    usuario: {
      nombres: registro.nombres,
      apellidos: registro.apellidos,
      correo: registro.correo_institucional,
    },
  };
};

/**
 * Restablecer la contraseña con el token
 */
const restablecerPassword = async (token, nuevaPassword) => {
  if (!token || !nuevaPassword) {
    const error = new Error("Faltan datos: token y nueva contraseña");
    error.statusCode = 400;
    throw error;
  }

  if (nuevaPassword.length < 6) {
    const error = new Error("La contraseña debe tener al menos 6 caracteres");
    error.statusCode = 400;
    throw error;
  }

  // 1. Validar el token
  const registro = await recuperacionDao.findTokenValido(token);
  if (!registro) {
    const error = new Error("Token inválido, expirado o ya utilizado");
    error.statusCode = 400;
    throw error;
  }

  // 2. Actualizar la contraseña
  const usuarioActualizado = await usuarioDao.actualizarPassword(
    registro.id_usuario,
    nuevaPassword,
  );

  // 3. Marcar token como usado
  await recuperacionDao.marcarTokenUsado(token);

  return {
    success: true,
    usuario: {
      dni: usuarioActualizado.dni,
      nombres: usuarioActualizado.nombres,
      apellidos: usuarioActualizado.apellidos,
    },
  };
};

module.exports = {
  solicitarRecuperacion,
  validarToken,
  restablecerPassword,
};
