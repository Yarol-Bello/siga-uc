/**
 * Generación del Acta de Cierre Bimestral en PDF
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Incluye la matriz real de alumnos y notas finales.
 */

const PDFDocument = require("pdfkit");
const {
  COLORS,
  safeText,
  formatDateTime,
  drawInstitutionalHeader,
  addFooters,
  drawWatermark,
} = require("../utils/pdfCommon");

const MARGIN = 30;
const WATERMARK_TEXT = "BORRADOR - NO VÁLIDO PARA TRÁMITE";

const drawMetadata = (doc, acta, startY, contentWidth) => {
  const boxHeight = 46;
  const columns = 4;
  const cellWidth = contentWidth / columns;
  const items = [
    ["PERIODO", safeText(acta.periodo)],
    ["AÑO LECTIVO", safeText(acta.anio_lectivo)],
    ["GRADO", safeText(acta.nombre_grado, "Todos los grados")],
    ["ESTADO", safeText(acta.estado)],
    ["FECHA DE CIERRE", formatDateTime(acta.fecha_cierre)],
    ["CERRADO POR", safeText(acta.cerrado_por_nombre)],
    ["ACTA N°", safeText(acta.id_acta)],
    ["SECCIÓN", safeText(acta.seccion)],
  ];

  doc
    .roundedRect(MARGIN, startY, contentWidth, boxHeight, 5)
    .fillAndStroke(COLORS.light, COLORS.border);

  items.forEach(([label, value], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + column * cellWidth + 8;
    const y = startY + 7 + row * 19;

    doc
      .font("Helvetica-Bold")
      .fontSize(5.8)
      .fillColor(COLORS.slate)
      .text(label, x, y, { width: cellWidth - 16, lineBreak: false });

    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(COLORS.dark)
      .text(String(value), x, y + 8, {
        width: cellWidth - 16,
        lineBreak: false,
      });
  });

  return startY + boxHeight + 10;
};

const drawTableHeader = (doc, cursos, startY, contentWidth) => {
  const codeWidth = 46;
  const nameWidth = 155;
  const coursesWidth = contentWidth - codeWidth - nameWidth;
  const courseWidth = coursesWidth / Math.max(cursos.length, 1);

  doc.font("Helvetica-Bold").fontSize(5.8);
  const headerHeights = cursos.map((curso) =>
    doc.heightOfString(safeText(curso.nombre_curso), {
      width: courseWidth - 5,
      align: "center",
    }),
  );
  const headerHeight = Math.max(26, ...headerHeights) + 10;

  doc
    .rect(MARGIN, startY, contentWidth, headerHeight)
    .fillColor(COLORS.guindo)
    .fill();

  doc.font("Helvetica-Bold").fontSize(6).fillColor(COLORS.white);

  doc.text("CÓDIGO", MARGIN + 4, startY + headerHeight / 2 - 3, {
    width: codeWidth - 8,
    lineBreak: false,
  });
  doc.text("ALUMNO", MARGIN + codeWidth + 4, startY + headerHeight / 2 - 3, {
    width: nameWidth - 8,
    lineBreak: false,
  });

  cursos.forEach((curso, index) => {
    doc.text(
      safeText(curso.nombre_curso),
      MARGIN + codeWidth + nameWidth + index * courseWidth + 2,
      startY + 5,
      {
        width: courseWidth - 5,
        align: "center",
      },
    );
  });

  return {
    y: startY + headerHeight,
    headerHeight,
    codeWidth,
    nameWidth,
    courseWidth,
  };
};

const drawStudentRow = (
  doc,
  alumno,
  cursos,
  startY,
  index,
  columns,
  contentWidth,
) => {
  const { codeWidth, nameWidth, courseWidth } = columns;

  doc.font("Helvetica-Bold").fontSize(6.8);
  const nameHeight = doc.heightOfString(safeText(alumno.nombre_completo), {
    width: nameWidth - 8,
  });
  const rowHeight = Math.max(20, nameHeight + 14);

  if (index % 2 === 0) {
    doc
      .rect(MARGIN, startY, contentWidth, rowHeight)
      .fillColor(COLORS.light)
      .fill();
  }

  doc.lineWidth(0.4).strokeColor(COLORS.border);
  doc.rect(MARGIN, startY, codeWidth, rowHeight).stroke();
  doc.rect(MARGIN + codeWidth, startY, nameWidth, rowHeight).stroke();

  cursos.forEach((_curso, courseIndex) => {
    doc
      .rect(
        MARGIN + codeWidth + nameWidth + courseIndex * courseWidth,
        startY,
        courseWidth,
        rowHeight,
      )
      .stroke();
  });

  doc
    .font("Helvetica")
    .fontSize(6.2)
    .fillColor(COLORS.slate)
    .text(safeText(alumno.codigo_estudiante), MARGIN + 4, startY + 5, {
      width: codeWidth - 8,
      lineBreak: false,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(6.8)
    .fillColor(COLORS.dark)
    .text(safeText(alumno.nombre_completo), MARGIN + codeWidth + 4, startY + 4, {
      width: nameWidth - 8,
    });

  doc
    .font("Helvetica")
    .fontSize(5.8)
    .fillColor(COLORS.slate)
    .text(
      `${safeText(alumno.nombre_grado)} — ${safeText(alumno.seccion)}`,
      MARGIN + codeWidth + 4,
      startY + 4 + nameHeight,
      { width: nameWidth - 8, lineBreak: false },
    );

  cursos.forEach((curso, courseIndex) => {
    const nota = alumno.notas?.[curso.id_curso];
    doc
      .font("Helvetica-Bold")
      .fontSize(6.8)
      .fillColor(nota ? COLORS.dark : COLORS.slate)
      .text(safeText(nota), MARGIN + codeWidth + nameWidth + courseIndex * courseWidth, startY + 6, {
        width: courseWidth,
        align: "center",
        lineBreak: false,
      });
  });

  return startY + rowHeight;
};

const generarActaPdf = (acta) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: {
          top: MARGIN,
          bottom: MARGIN,
          left: MARGIN,
          right: MARGIN,
        },
        bufferPages: true,
        info: {
          Title: `Acta ${safeText(acta.id_acta)} - ${safeText(acta.periodo)} ${safeText(acta.anio_lectivo)}`,
          Author: "SIGA-UC - I.E.P. Unión Científica",
          Subject: `Acta de cierre bimestral ${safeText(acta.periodo)} ${safeText(acta.anio_lectivo)}`,
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const contentWidth = doc.page.width - MARGIN * 2;
      const cursos = Array.isArray(acta.cursos) ? acta.cursos : [];
      const alumnos = Array.isArray(acta.alumnos) ? acta.alumnos : [];
      const esBorrador = String(acta.estado).toUpperCase() === "ABIERTO";

      let y = 0;

      const nuevaPagina = () => {
        doc.addPage();
        if (esBorrador) drawWatermark(doc, WATERMARK_TEXT);
        y = drawInstitutionalHeader(doc, {
          margin: MARGIN,
          title: "ACTA DE CIERRE BIMESTRAL",
          subtitle: `Año lectivo ${safeText(acta.anio_lectivo)} — ${safeText(acta.nombre_grado, "Todos los grados")}`,
          rightTitle: `ACTA N° ${safeText(acta.id_acta)}`,
          rightSubtitle: safeText(acta.estado),
        });
      };

      if (esBorrador) drawWatermark(doc, WATERMARK_TEXT);
      y = drawInstitutionalHeader(doc, {
        margin: MARGIN,
        title: "ACTA DE CIERRE BIMESTRAL",
        subtitle: `Año lectivo ${safeText(acta.anio_lectivo)} — ${safeText(acta.nombre_grado, "Todos los grados")}`,
        rightTitle: `ACTA N° ${safeText(acta.id_acta)}`,
        rightSubtitle: safeText(acta.estado),
      });

      y = drawMetadata(doc, acta, y, contentWidth);

      const estadoTexto =
        String(acta.estado).toUpperCase() === "CERRADO"
          ? "El acta se encuentra CERRADA. Las calificaciones quedaron congeladas y bloqueadas para edición."
          : "El acta se encuentra ABIERTA y pendiente de firma. Este documento es un borrador.";

      doc
        .font("Helvetica")
        .fontSize(7.2)
        .fillColor(COLORS.dark)
        .text(
          `La presente acta certifica el cierre y bloqueo de las calificaciones del ${safeText(acta.periodo)} del año lectivo ${safeText(acta.anio_lectivo)} para ${safeText(acta.nombre_grado, "todos los grados")}. ${estadoTexto}`,
          MARGIN,
          y,
          { width: contentWidth, align: "justify" },
        );

      y = doc.y + 8;

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(COLORS.guindo)
        .text("MATRIZ DE CALIFICACIONES FINALES", MARGIN, y);

      y += 14;

      const columns = drawTableHeader(doc, cursos, y, contentWidth);
      y = columns.y;

      alumnos.forEach((alumno, index) => {
        doc.font("Helvetica-Bold").fontSize(6.8);
        const nameHeight = doc.heightOfString(safeText(alumno.nombre_completo), {
          width: columns.nameWidth - 8,
        });
        const estimatedHeight = Math.max(20, nameHeight + 14);

        if (y + estimatedHeight > doc.page.height - MARGIN - 26) {
          nuevaPagina();
          const newColumns = drawTableHeader(doc, cursos, y, contentWidth);
          y = newColumns.y;
        }

        y = drawStudentRow(
          doc,
          alumno,
          cursos,
          y,
          index,
          columns,
          contentWidth,
        );
      });

      // Firma / hash
      if (y + 55 > doc.page.height - MARGIN - 26) {
        nuevaPagina();
      }

      y += 8;

      doc
        .roundedRect(MARGIN, y, contentWidth, 42, 4)
        .fillAndStroke("#FFFBEB", "#FCD34D");

      doc
        .font("Helvetica-Bold")
        .fontSize(6.5)
        .fillColor("#92400E")
        .text("HASH DE INTEGRIDAD", MARGIN + 8, y + 7, {
          width: 120,
          lineBreak: false,
        });

      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor("#92400E")
        .text(safeText(acta.hash_integridad), MARGIN + 130, y + 7, {
          width: contentWidth - 138,
        });

      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor("#92400E")
        .text(
          `Firmado digitalmente por: ${safeText(acta.cerrado_por_nombre)} · ${formatDateTime(acta.fecha_cierre)}`,
          MARGIN + 8,
          y + 23,
          { width: contentWidth - 16 },
        );

      addFooters(doc, MARGIN);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });

module.exports = {
  generarActaPdf,
};
