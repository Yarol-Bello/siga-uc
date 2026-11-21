/**
 * Utilidades compartidas para PDFs institucionales
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const COLORS = {
  guindo: "#800020",
  gold: "#D4AF37",
  dark: "#1E293B",
  slate: "#64748B",
  border: "#E2E8F0",
  light: "#F8FAFC",
  white: "#FFFFFF",
  danger: "#B91C1C",
  success: "#047857",
};

const safeText = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "short",
    timeStyle: "short",
  });
};

const formatCurrency = (value) => `S/ ${toNumber(value).toFixed(2)}`;

const formatGeneratedAt = () => {
  try {
    return new Date().toLocaleString("es-PE", {
      timeZone: "America/Lima",
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return new Date().toISOString().slice(0, 16).replace("T", " ");
  }
};

/**
 * Cabecera institucional reutilizable.
 * @returns {number} Y donde continúa el contenido.
 */
const drawInstitutionalHeader = (
  doc,
  {
    margin,
    title,
    subtitle,
    rightTitle = "",
    rightSubtitle = "",
  },
) => {
  const contentWidth = doc.page.width - margin * 2;
  const top = margin;

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(COLORS.guindo)
    .text("I.E.P. UNIÓN CIENTÍFICA", margin, top, {
      width: contentWidth - 180,
      lineBreak: false,
    });

  doc
    .font("Helvetica")
    .fontSize(7.8)
    .fillColor(COLORS.slate)
    .text(subtitle, margin, top + 21, {
      width: contentWidth - 180,
      lineBreak: false,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor(COLORS.guindo)
    .text(title, margin, top + 33, {
      width: contentWidth - 180,
      lineBreak: false,
    });

  if (rightTitle) {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.guindo)
      .text(rightTitle, margin, top + 2, {
        width: contentWidth,
        align: "right",
        lineBreak: false,
      });
  }

  if (rightSubtitle) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(COLORS.slate)
      .text(rightSubtitle, margin, top + 17, {
        width: contentWidth,
        align: "right",
        lineBreak: false,
      });
  }

  doc
    .moveTo(margin, top + 48)
    .lineTo(margin + contentWidth, top + 48)
    .lineWidth(2)
    .strokeColor(COLORS.guindo)
    .stroke();

  doc
    .moveTo(margin, top + 51)
    .lineTo(margin + contentWidth, top + 51)
    .lineWidth(1)
    .strokeColor(COLORS.gold)
    .stroke();

  return top + 60;
};

/**
 * Pie de página con fecha y numeración.
 */
const addFooters = (doc, margin) => {
  const range = doc.bufferedPageRange();
  const contentWidth = doc.page.width - margin * 2;
  const generatedAt = formatGeneratedAt();

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);

    const previousBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc
      .font("Helvetica")
      .fontSize(6.8)
      .fillColor(COLORS.slate)
      .text(`Generado el ${generatedAt}`, margin, doc.page.height - 24, {
        width: contentWidth / 2,
        lineBreak: false,
      });

    doc.text(
      `Página ${i + 1} de ${range.count}`,
      margin,
      doc.page.height - 24,
      {
        width: contentWidth,
        align: "right",
        lineBreak: false,
      },
    );

    doc.page.margins.bottom = previousBottomMargin;
  }
};

/**
 * Texto de marca de agua diagonal (para borradores).
 */
const drawWatermark = (doc, text) => {
  doc.save();
  doc.rotate(-28, { origin: [doc.page.width / 2, doc.page.height / 2] });
  doc
    .font("Helvetica-Bold")
    .fontSize(doc.page.width > doc.page.height ? 40 : 32)
    .fillColor(COLORS.guindo)
    .fillOpacity(0.12)
    .text(text, 0, doc.page.height / 2 - 20, {
      width: doc.page.width,
      align: "center",
      lineBreak: false,
    });
  doc.restore();
};

module.exports = {
  COLORS,
  safeText,
  toNumber,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatGeneratedAt,
  drawInstitutionalHeader,
  addFooters,
  drawWatermark,
};
