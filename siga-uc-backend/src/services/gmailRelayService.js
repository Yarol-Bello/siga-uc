/**
 * Relay de correo por Google Apps Script (Gmail).
 *
 * Permite enviar correos desde una cuenta Gmail sin comprar un dominio.
 * El backend llama por HTTPS a una app web de Apps Script, que usa GmailApp.
 *
 * Requiere:
 *   GMAIL_RELAY_URL    URL /exec de la app web
 *   GMAIL_RELAY_SECRET secreto compartido con el script
 *
 * Límite de Gmail gratuito: 100 destinatarios por día.
 */

const RELAY_URL = String(process.env.GMAIL_RELAY_URL || "").trim();
const RELAY_SECRET = String(process.env.GMAIL_RELAY_SECRET || "").trim();

const LOTE_MAX = 40;
const TIMEOUT_MS = 60000;

const estaConfigurado = () => Boolean(RELAY_URL && RELAY_SECRET);

const dividir = (items, tamano) => {
  const partes = [];
  for (let i = 0; i < items.length; i += tamano) {
    partes.push(items.slice(i, i + tamano));
  }
  return partes;
};

const normalizar = (mensaje) => ({
  to: String(mensaje?.to || "").trim(),
  subject: String(mensaje?.subject || "").trim(),
  html: String(mensaje?.html || ""),
});

const enviarLote = async (mensajes = []) => {
  if (!estaConfigurado()) {
    return {
      success: false,
      proveedor: "gmail",
      enviados: 0,
      fallidos: mensajes.length,
      error: "GMAIL_RELAY_URL/GMAIL_RELAY_SECRET no configurados",
      resultados: [],
    };
  }

  if (!Array.isArray(mensajes) || mensajes.length === 0) {
    return {
      success: false,
      proveedor: "gmail",
      enviados: 0,
      fallidos: 0,
      error: "No hay mensajes para enviar",
      resultados: [],
    };
  }

  const normalizados = mensajes.map(normalizar);
  const validos = normalizados.filter(
    (m) => m.to && m.subject && m.html,
  );
  const invalidos = normalizados.length - validos.length;

  let enviados = 0;
  let fallidos = invalidos;
  let restantes = null;
  const resultados = normalizados
    .filter((m) => !m.to || !m.subject || !m.html)
    .map((m) => ({
      to: m.to,
      ok: false,
      error: "Faltan to, subject o html",
    }));

  for (const lote of dividir(validos, LOTE_MAX)) {
    let temporizador = null;

    try {
      const controller = new AbortController();
      temporizador = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const respuesta = await fetch(RELAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: RELAY_SECRET,
          messages: lote,
        }),
        signal: controller.signal,
      });

      const texto = await respuesta.text();
      let data = null;

      try {
        data = JSON.parse(texto);
      } catch {
        data = null;
      }

      if (!respuesta.ok || !data) {
        fallidos += lote.length;
        resultados.push(
          ...lote.map((m) => ({
            to: m.to,
            ok: false,
            error: `Respuesta inválida del relay (HTTP ${respuesta.status})`,
          })),
        );
        continue;
      }

      enviados += Number(data.enviados) || 0;
      fallidos += Number(data.fallidos) || 0;
      if (Number.isFinite(Number(data.restantes))) {
        restantes =
          restantes === null
            ? Number(data.restantes)
            : Math.min(restantes, Number(data.restantes));
      }
      if (Array.isArray(data.resultados)) {
        resultados.push(...data.resultados);
      }
    } catch (error) {
      fallidos += lote.length;
      const detalle =
        error.name === "AbortError"
          ? "Tiempo de espera agotado al llamar al relay de Gmail"
          : error.message;
      resultados.push(
        ...lote.map((m) => ({ to: m.to, ok: false, error: detalle })),
      );
    } finally {
      if (temporizador) clearTimeout(temporizador);
    }
  }

  return {
    success: enviados > 0 && fallidos === 0,
    proveedor: "gmail",
    enviados,
    fallidos,
    restantes,
    resultados,
    error:
      enviados === 0
        ? resultados.find((r) => !r.ok)?.error ||
          "No se pudo enviar ningún correo por Gmail"
        : null,
  };
};

module.exports = {
  estaConfigurado,
  enviarLote,
};
