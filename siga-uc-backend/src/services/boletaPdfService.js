/**
 * Generación de la Boleta de Pago en PDF
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const PDFDocument = require("pdfkit");
const {
  COLORS,
  safeText,
  toNumber,
  formatDate,
  formatDateTime,
  formatCurrency,
  drawInstitutionalHeader,
  addFooters,
  drawWatermark,
} = require("../utils/pdfCommon");

const MARGIN = 40;

const drawLabelValue = (doc, label, value, x, y, width) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.dark)
    .text(label, x, y, { width: 75, lineBreak: false });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.dark)
    .text(value, x + 78, y, {
      width: width - 78,
      lineBreak: false,
    });
};

const generarBoletaPdf = (pago) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: {
          top: MARGIN,
          bottom: MARGIN,
          left: MARGIN,
          right: MARGIN,
        },
        info: {
          Title: `Boleta ${safeText(pago.numero_boleta, pago.id_pago)}`,
          Author: "SIGA-UC - I.E.P. Unión Científica",
          Subject: `Boleta de pago ${safeText(pago.numero_boleta)}`,
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const contentWidth = doc.page.width - MARGIN * 2;
      const estadoPago = String(pago.estado || "PAGADO").toUpperCase();
      const estadoSunat = String(pago.estado_sunat || "PENDIENTE").toUpperCase();
      const monto = toNumber(pago.monto_total ?? pago.monto);

      let y = drawInstitutionalHeader(doc, {
        margin: MARGIN,
        title: "BOLETA DE PAGO",
        subtitle: "Comprobante interno de tesorería",
        rightTitle: safeText(pago.numero_boleta, "SIN NÚMERO"),
        rightSubtitle: `Estado SUNAT: ${estadoSunat}`,
      });

      // Datos del alumno y del pago
      const infoHeight = 72;
      doc
        .roundedRect(MARGIN, y, contentWidth, infoHeight, 6)
        .fillAndStroke(COLORS.light, COLORS.border);

      const colWidth = contentWidth / 2 - 12;
      const leftX = MARGIN + 10;
      const rightX = MARGIN + contentWidth / 2 + 2;

      drawLabelValue(
        doc,
        "Estudiante:",
        safeText(pago.alumno_nombre, `${pago.nombres || ""} ${pago.apellidos || ""}`),
        leftX,
        y + 9,
        colWidth,
      );
      drawLabelValue(doc, "DNI:", safeText(pago.dni), leftX, y + 25, colWidth);
      drawLabelValue(
        doc,
        "Código:",
        safeText(pago.codigo_estudiante),
        leftX,
        y + 41,
        colWidth,
      );

      drawLabelValue(
        doc,
        "Grado:",
        `${safeText(pago.nombre_grado)} — ${safeText(pago.seccion)}`,
        rightX,
        y + 9,
        colWidth,
      );
      drawLabelValue(
        doc,
        "Fecha pago:",
        formatDateTime(pago.fecha_pago),
        rightX,
        y + 25,
        colWidth,
      );
      drawLabelValue(
        doc,
        "Cobrador:",
        safeText(pago.cobrador),
        rightX,
        y + 41,
        colWidth,
      );

      y += infoHeight + 18;

      // Detalle del concepto
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.guindo);
      doc.text("DETALLE DEL PAGO", MARGIN, y);
      y += 16;

      const conceptWidth = contentWidth - 140;
      const amountWidth = 140;
      const rowHeight = 36;

      doc
        .rect(MARGIN, y, contentWidth, 22)
        .fillColor(COLORS.guindo)
        .fill();

      doc.font("Helvetica-Bold").fontSize(7.8).fillColor(COLORS.white);
      doc.text("CONCEPTO", MARGIN + 6, y + 7, {
        width: conceptWidth - 12,
        lineBreak: false,
      });
      doc.text("MONTO", MARGIN + conceptWidth, y + 7, {
        width: amountWidth - 6,
        align: "right",
        lineBreak: false,
      });

      y += 22;

      doc
        .rect(MARGIN, y, contentWidth, rowHeight)
        .fillAndStroke(COLORS.white, COLORS.border);

      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.dark)
        .text(safeText(pago.concepto_nombre), MARGIN + 6, y + 8, {
          width: conceptWidth - 12,
        });

      if (pago.concepto_tipo || pago.concepto_mes) {
        const detalle = [
          pago.concepto_tipo ? `Tipo: ${pago.concepto_tipo}` : null,
          pago.concepto_mes ? `Mes: ${pago.concepto_mes}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor(COLORS.slate)
          .text(detalle, MARGIN + 6, y + 22, {
            width: conceptWidth - 12,
            lineBreak: false,
          });
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.guindo)
        .text(formatCurrency(monto), MARGIN + conceptWidth, y + 12, {
          width: amountWidth - 6,
          align: "right",
        });

      y += rowHeight + 14;

      // Total
      doc
        .roundedRect(MARGIN + contentWidth - 220, y, 220, 42, 6)
        .fillAndStroke(COLORS.guindo, COLORS.guindo);

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.white)
        .text("TOTAL PAGADO", MARGIN + contentWidth - 208, y + 8, {
          width: 120,
          lineBreak: false,
        });

      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(COLORS.white)
        .text(formatCurrency(monto), MARGIN + contentWidth - 208, y + 20, {
          width: 196,
          align: "right",
          lineBreak: false,
        });

      y += 64;

      // Datos del comprobante
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.guindo);
      doc.text("DATOS DEL COMPROBANTE", MARGIN, y);
      y += 16;

      const details = [
        ["Serie / Número", safeText(pago.numero_boleta)],
        ["Fecha de emisión", formatDateTime(pago.fecha_emision)],
        ["Forma de pago", safeText(pago.forma_pago)],
        ["N° operación", safeText(pago.nro_operacion)],
        ["Estado del pago", estadoPago],
        ["Estado SUNAT", estadoSunat],
      ];

      const detailColWidth = contentWidth / 2 - 10;
      const detailRowHeight = 18;

      details.forEach(([label, value], index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = MARGIN + column * (detailColWidth + 16);
        const detailY = y + row * detailRowHeight;

        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor(COLORS.slate)
          .text(`${label}:`, x, detailY, { width: 90, lineBreak: false });

        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(COLORS.dark)
          .text(value, x + 92, detailY, {
            width: detailColWidth - 92,
            lineBreak: false,
          });
      });

      y += Math.ceil(details.length / 2) * detailRowHeight + 14;

      if (pago.hash_cpe) {
        doc
          .roundedRect(MARGIN, y, contentWidth, 34, 4)
          .fillAndStroke("#FFFBEB", "#FCD34D");

        doc
          .font("Helvetica-Bold")
          .fontSize(7)
          .fillColor("#92400E")
          .text("HASH CPE", MARGIN + 8, y + 7, {
            width: 70,
            lineBreak: false,
          });

        doc
          .font("Helvetica")
          .fontSize(6.5)
          .fillColor("#92400E")
          .text(String(pago.hash_cpe), MARGIN + 78, y + 7, {
            width: contentWidth - 86,
          });

        y += 44;
      }

      const notaY = Math.min(y + 10, doc.page.height - MARGIN - 45);
      doc
        .font("Helvetica-Oblique")
        .fontSize(7)
        .fillColor(COLORS.slate)
        .text(
          "Documento interno generado por SIGA-UC. No reemplaza al comprobante electrónico oficial emitido por SUNAT.",
          MARGIN,
          notaY,
          { width: contentWidth, align: "center" },
        );

      if (estadoPago === "ANULADO") {
        drawWatermark(doc, "ANULADA");
      }

      addFooters(doc, MARGIN);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });

module.exports = {
  generarBoletaPdf,
};
