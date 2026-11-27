/**
 * Servicio de Envío de Correos - SIGA-UC
 * Sistema Integrado de Gestión Académica
 *
 * Usa Resend (API HTTP) para funcionar tanto en local como en Render.
 * El correo es opcional: si no hay RESEND_API_KEY, la API sigue funcionando.
 */

const { Resend } = require("resend");
const env = require("../config/env");
const configuracionService = require("./configuracionService");
const gmailRelayService = require("./gmailRelayService");

// Inicializar cliente de Resend solo si hay clave.
// El correo es opcional: la API debe arrancar aunque RESEND_API_KEY no exista.
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Remitente por defecto (se configura con EMAIL_FROM en .env)
const FROM_EMAIL = process.env.EMAIL_FROM || "SIGA-UC <onboarding@resend.dev>";

/**
 * Verificar configuración de Resend al iniciar
 */
const verificarConexion = async () => {
  try {
    if (gmailRelayService.estaConfigurado()) {
      console.log(
        "✅ Servicio de correo (Gmail relay) configurado correctamente",
      );
      console.warn(
        "⚠️ Gmail relay usa la cuenta de Gmail: límite de 100 destinatarios por día en cuentas gratuitas.",
      );
      return true;
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error(
        "RESEND_API_KEY no está configurada en las variables de entorno",
      );
    }
    if (FROM_EMAIL.includes("onboarding@resend.dev")) {
      console.warn(
        "⚠️ EMAIL_FROM usa onboarding@resend.dev: Resend en modo prueba solo entrega al correo dueño de la cuenta.",
      );
      console.warn(
        "   Para enviar a cualquier usuario, verifique un dominio en Resend y use EMAIL_FROM=no-reply@tudominio.com.",
      );
    }
    console.log("✅ Servicio de correo (Resend) configurado correctamente");
    return true;
  } catch (error) {
    console.error("❌ Error al configurar el servicio de correo:", error.message);
    return false;
  }
};

/**
 * Enviar un correo genérico
 * @param {object} params - { to, subject, html, text }
 */
const enviarCorreo = async ({ to, subject, html, text }) => {
  if (gmailRelayService.estaConfigurado()) {
    const resultado = await gmailRelayService.enviarLote([
      { to, subject, html, text },
    ]);

    if (resultado.enviados > 0) {
      console.log(
        `📧 Correo enviado por Gmail relay (restantes hoy: ${resultado.restantes ?? "?"})`,
      );
      return {
        success: true,
        proveedor: "gmail",
        messageId: null,
        restantes: resultado.restantes,
      };
    }

    const error =
      resultado.error ||
      resultado.resultados?.find((r) => !r.ok)?.error ||
      "No se pudo enviar el correo por Gmail";
    console.error("❌ Error al enviar correo por Gmail relay:", error);
    return { success: false, proveedor: "gmail", error };
  }

  if (!resend) {
    console.warn("⚠️ RESEND_API_KEY no configurada: correo omitido.");
    return { success: false, error: "RESEND_API_KEY no configurada" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: text || "",
      html: html || "",
    });

    if (error) {
      console.error("❌ Error al enviar correo:", error.message);
      return { success: false, error: error.message };
    }

    console.log(`📧 Correo enviado: ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("❌ Error al enviar correo:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Plantilla HTML para notificaciones generales (se mantiene igual)
 */
const plantillaNotificacion = (
  destinatario,
  asunto,
  cuerpo,
  remitente,
  institucion = null,
) => {
  const nombre = institucion?.nombre_institucion || "SIGA-UC";
  const ubicacion = [
    institucion?.distrito,
    institucion?.provincia,
    institucion?.departamento,
  ]
    .filter(Boolean)
    .join(", ");
  const pie =
    String(institucion?.texto_pie || "").trim() ||
    `© ${new Date().getFullYear()} ${nombre}${ubicacion ? ` - ${ubicacion}` : ""}`;
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
      <h1>${nombre}</h1>
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
      <p>Enviado por: <strong>${remitente || institucion?.nombre_remitente || nombre}</strong></p>
      <p>${pie}</p>
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
  const institucion = await configuracionService.obtenerInstitucionDocumentos();
  const html = plantillaNotificacion(
    destinatario,
    asunto,
    cuerpo,
    remitente,
    institucion,
  );
  return await enviarCorreo({ to, subject: `[SIGA-UC] ${asunto}`, html });
};

/**
 * Enviar la misma notificación a varios destinatarios.
 * Con Gmail relay se envía en un solo lote HTTP (máximo 40 por llamada).
 * Con Resend se recorre uno por uno como respaldo.
 */
const enviarNotificacionLote = async ({
  destinatarios = [],
  asunto,
  cuerpo,
  remitente,
}) => {
  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    return {
      success: true,
      proveedor: gmailRelayService.estaConfigurado() ? "gmail" : "resend",
      enviados: 0,
      fallidos: 0,
      resultados: [],
    };
  }

  const institucion = await configuracionService.obtenerInstitucionDocumentos();
  const mensajes = destinatarios.map((destinatario) => ({
    to: destinatario.to,
    subject: `[SIGA-UC] ${asunto}`,
    html: plantillaNotificacion(
      destinatario.destinatario,
      asunto,
      cuerpo,
      remitente,
      institucion,
    ),
  }));

  if (gmailRelayService.estaConfigurado()) {
    return await gmailRelayService.enviarLote(mensajes);
  }

  let enviados = 0;
  let fallidos = 0;
  const resultados = [];

  for (const mensaje of mensajes) {
    const resultado = await enviarCorreo(mensaje);
    if (resultado.success) {
      enviados += 1;
      resultados.push({ to: mensaje.to, ok: true });
    } else {
      fallidos += 1;
      resultados.push({
        to: mensaje.to,
        ok: false,
        error: resultado.error || "No se pudo enviar",
      });
    }
  }

  return {
    success: fallidos === 0,
    proveedor: "resend",
    enviados,
    fallidos,
    resultados,
    error:
      enviados === 0
        ? resultados.find((r) => !r.ok)?.error ||
          "No se pudo enviar ningún correo"
        : null,
  };
};

module.exports = {
  verificarConexion,
  enviarCorreo,
  enviarNotificacion,
  enviarNotificacionLote,
};
