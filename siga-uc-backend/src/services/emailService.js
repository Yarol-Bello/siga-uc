/**
 * Servicio de Envío de Correos - SIGA-UC
 * Sistema Integrado de Gestión Académica
 *
 * Usa Resend (API HTTP) para funcionar tanto en local como en Render.
 * Mantiene la misma interfaz pública que la versión anterior con Nodemailer.
 */

const { Resend } = require("resend");
const env = require("../config/env");

// Inicializar cliente de Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Remitente por defecto (se configura con EMAIL_FROM en .env)
const FROM_EMAIL = process.env.EMAIL_FROM || "SIGA-UC <onboarding@resend.dev>";

/**
 * Verificar configuración de Resend al iniciar
 */
const verificarConexion = async () => {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error(
        "RESEND_API_KEY no está configurada en las variables de entorno",
      );
    }
    console.log("✅ Servicio de correo (Resend) configurado correctamente");
    return true;
  } catch (error) {
    console.error("❌ Error al configurar Resend:", error.message);
    return false;
  }
};

/**
 * Enviar un correo genérico
 * @param {object} params - { to, subject, html, text }
 */
const enviarCorreo = async ({ to, subject, html, text }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: text || "",
      html: html || "",
    });

    if (error) {
      console.error(`❌ Error al enviar correo a ${to}:`, error.message);
      return { success: false, error: error.message };
    }

    console.log(`📧 Correo enviado a ${to}: ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error(`❌ Error al enviar correo a ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Plantilla HTML para notificaciones generales (se mantiene igual)
 */
const plantillaNotificacion = (destinatario, asunto, cuerpo, remitente) => {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #F8FAFC; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #800020 0%, #4A0012 100%); color: white; padding: 30px 25px; text-align: center; }
    .header h1 { font-size: 1.3rem; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px; }
    .header p { font-size: 0.85rem; margin: 0; opacity: 0.9; }
    .body { padding: 30px 25px; color: #1E293B; line-height: 1.6; }
    .body h2 { color: #800020; font-size: 1.1rem; margin-bottom: 15px; }
    .body .cuerpo-box { background: #F8FAFC; border-left: 4px solid #D4AF37; padding: 15px 18px; border-radius: 8px; margin: 15px 0; font-size: 0.92rem; }
    .footer { background: #F8FAFC; padding: 20px 25px; text-align: center; font-size: 0.78rem; color: #64748B; border-top: 1px solid #E2E8F0; }
    .footer strong { color: #800020; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>I.E.P. Unión Científica</h1>
      <p>Sistema Integrado de Gestión Académica — SIGA-UC</p>
    </div>
    <div class="body">
      <h2>🔔 ${asunto}</h2>
      <p>Estimado(a) <strong>${destinatario}</strong>,</p>
      <div class="cuerpo-box">${cuerpo}</div>
      <p style="font-size: 0.85rem; color: #64748B;">
        Este es un mensaje automático generado por SIGA-UC.
        Por favor, no responda directamente a este correo.
      </p>
    </div>
    <div class="footer">
      <p>Enviado por: <strong>${remitente}</strong></p>
      <p>© 2026 I.E.P. Unión Científica — Huancayo, Junín</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Enviar notificación con plantilla institucional
 */
const enviarNotificacion = async ({
  to,
  destinatario,
  asunto,
  cuerpo,
  remitente,
}) => {
  const html = plantillaNotificacion(destinatario, asunto, cuerpo, remitente);
  return await enviarCorreo({ to, subject: `[SIGA-UC] ${asunto}`, html });
};

module.exports = {
  verificarConexion,
  enviarCorreo,
  enviarNotificacion,
};
