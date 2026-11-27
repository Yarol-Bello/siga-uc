/**
 * SIGA-UC — Relay de correo con Gmail (Google Apps Script)
 *
 * Uso:
 * 1. Crear un proyecto en https://script.google.com
 * 2. Pegar este código y reemplazar REEMPLAZAR_SECRETO por un secreto largo.
 * 3. Implementar como aplicación web:
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier persona
 * 4. Copiar la URL /exec en GMAIL_RELAY_URL y el secreto en GMAIL_RELAY_SECRET.
 *
 * Límite de Gmail gratuito: 100 destinatarios por día.
 * No es un servicio de correo masivo; es un puente para pruebas y volúmenes pequeños.
 */

const SECRETO = "REEMPLAZAR_SECRETO";
const MAX_MENSAJES = 40;
const MAX_ASUNTO = 200;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respuesta_({ ok: false, error: "Payload vacío" });
    }

    const data = JSON.parse(e.postData.contents);

    if (String(data.secret || "") !== SECRETO) {
      return respuesta_({ ok: false, error: "No autorizado" });
    }

    const mensajes = Array.isArray(data.messages) ? data.messages : [data];

    if (mensajes.length === 0 || mensajes.length > MAX_MENSAJES) {
      return respuesta_({
        ok: false,
        error: `Lote inválido: debe tener entre 1 y ${MAX_MENSAJES} mensajes`,
      });
    }

    const resultados = [];

    for (const mensaje of mensajes) {
      const to = String(mensaje.to || "").trim();
      const subject = String(mensaje.subject || "").trim().slice(0, MAX_ASUNTO);
      const html = String(mensaje.html || "");

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !html) {
        resultados.push({ to, ok: false, error: "Datos inválidos" });
        continue;
      }

      try {
        GmailApp.sendEmail(to, subject, "", {
          htmlBody: html,
          name: "SIGA-UC",
        });
        resultados.push({ to, ok: true });
      } catch (error) {
        resultados.push({ to, ok: false, error: String(error) });
      }
    }

    const enviados = resultados.filter((r) => r.ok).length;
    const fallidos = resultados.length - enviados;

    return respuesta_({
      ok: fallidos === 0,
      enviados,
      fallidos,
      restantes: MailApp.getRemainingDailyQuota(),
      resultados,
    });
  } catch (error) {
    return respuesta_({ ok: false, error: String(error) });
  }
}

function doGet() {
  return respuesta_({
    ok: true,
    servicio: "SIGA-UC Gmail Relay",
    restantes: MailApp.getRemainingDailyQuota(),
  });
}

function respuesta_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
