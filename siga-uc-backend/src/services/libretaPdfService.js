/**
 * Generación de la Libreta Informativa en PDF
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Usa PDFKit con fuentes estándar (Helvetica). No requiere Chromium ni
 * dependencias del sistema operativo.
 */

const PDFDocument = require("pdfkit");
const configuracionService = require("./configuracionService");

const MARGIN = 40;
const FOOTER_SPACE = 30;

const COLORS = {
  guindo: "#800020",
  gold: "#D4AF37",
  dark: "#1E293B",
  slate: "#64748B",
  border: "#E2E8F0",
  light: "#F8FAFC",
  white: "#FFFFFF",
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const safeText = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const formatGeneratedAt = (institucion = null) => {
  try {
    return new Date().toLocaleString(institucion?.locale || "es-PE", {
      timeZone: institucion?.zona_horaria || "America/Lima",
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return new Date().toISOString().slice(0, 16).replace("T", " ");
  }
};

const drawHeader = (doc, data, institucion = null) => {
  const contentWidth = doc.page.width - MARGIN * 2;
  const top = MARGIN;
  const nombre = safeText(institucion?.nombre_institucion, "SIGA-UC");
  const ubicacion = [
    institucion?.distrito,
    institucion?.provincia,
    institucion?.departamento,
  ]
    .filter(Boolean)
    .join(" - ")
    .toUpperCase();
  const subtitulo = `${institucion?.texto_libreta || "Boletín Informativo"} - Año Lectivo ${safeText(data.anio_lectivo, "")}`;

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(COLORS.guindo)
    .text(nombre, MARGIN, top, {
      width: contentWidth - 150,
      lineBreak: false,
    });

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(COLORS.slate)
    .text(subtitulo, MARGIN, top + 21, {
      width: contentWidth - 150,
      lineBreak: false,
    });

  if (ubicacion) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(COLORS.guindo)
      .text(ubicacion, MARGIN, top + 3, {
        width: contentWidth,
        align: "right",
        lineBreak: false,
      });
  }

  doc
    .moveTo(MARGIN, top + 39)
    .lineTo(MARGIN + contentWidth, top + 39)
    .lineWidth(2)
    .strokeColor(COLORS.guindo)
    .stroke();

  doc
    .moveTo(MARGIN, top + 42)
    .lineTo(MARGIN + contentWidth, top + 42)
    .lineWidth(1)
    .strokeColor(COLORS.gold)
    .stroke();

  return top + 52;
};

const drawInfo = (doc, data, startY) => {
  const contentWidth = doc.page.width - MARGIN * 2;
  const alumno = data.alumno || {};
  const tutor = data.tutor?.tutor_nombre;
  const columnWidth = contentWidth / 2 - 15;
  const lineHeight = 14;

  const leftRows = [
    ["Estudiante:", safeText(alumno.nombre_completo)],
    ["DNI:", safeText(alumno.dni)],
    ["Código:", safeText(alumno.codigo_estudiante)],
  ];

  const rightRows = [
    [
      "Grado:",
      `${safeText(alumno.nombre_grado)} — ${safeText(alumno.seccion)}`,
    ],
    ["Bimestre:", `${safeText(data.bimestre)}° Bimestre`],
  ];

  if (tutor) {
    rightRows.push(["Tutor:", safeText(tutor)]);
  }

  const rows = Math.max(leftRows.length, rightRows.length);
  const boxHeight = 14 + rows * lineHeight;

  doc
    .roundedRect(MARGIN, startY, contentWidth, boxHeight, 6)
    .fillAndStroke(COLORS.light, COLORS.border);

  const drawRows = (items, x) => {
    items.forEach(([label, value], index) => {
      const y = startY + 8 + index * lineHeight;

      doc
        .font("Helvetica-Bold")
        .fontSize(8.2)
        .fillColor(COLORS.dark)
        .text(label, x, y, { width: 62, lineBreak: false });

      doc
        .font("Helvetica")
        .fontSize(8.2)
        .fillColor(COLORS.dark)
        .text(value, x + 64, y, {
          width: columnWidth - 64,
          lineBreak: false,
        });
    });
  };

  drawRows(leftRows, MARGIN + 10);
  drawRows(rightRows, MARGIN + contentWidth / 2 + 5);

  return startY + boxHeight + 14;
};

const drawTableHeader = (doc, startY) => {
  const contentWidth = doc.page.width - MARGIN * 2;
  const courseWidth = 185;
  const noteWidth = 50;
  const conclusionWidth = contentWidth - courseWidth - noteWidth;
  const height = 22;

  doc
    .rect(MARGIN, startY, contentWidth, height)
    .fillColor(COLORS.guindo)
    .fill();

  doc.font("Helvetica-Bold").fontSize(7.8).fillColor(COLORS.white);

  doc.text("ÁREA / CURSO", MARGIN + 5, startY + 7, {
    width: courseWidth - 10,
    lineBreak: false,
  });
  doc.text("NOTA", MARGIN + courseWidth, startY + 7, {
    width: noteWidth,
    align: "center",
    lineBreak: false,
  });
  doc.text(
    "CONCLUSIÓN DESCRIPTIVA",
    MARGIN + courseWidth + noteWidth + 5,
    startY + 7,
    { width: conclusionWidth - 10, lineBreak: false },
  );

  return startY + height;
};

const drawRow = (doc, nota, startY, index) => {
  const contentWidth = doc.page.width - MARGIN * 2;
  const courseWidth = 185;
  const noteWidth = 50;
  const conclusionWidth = contentWidth - courseWidth - noteWidth;
  const innerPadding = 5;

  const course = safeText(nota.nombre_curso);
  const area = nota.area_academica ? String(nota.area_academica) : "";
  const conclusion = safeText(nota.conclusion);
  const note = safeText(nota.nota_final);

  doc.font("Helvetica-Bold").fontSize(8.4);
  const courseHeight = doc.heightOfString(course, {
    width: courseWidth - innerPadding * 2,
  });

  doc.font("Helvetica").fontSize(6.8);
  const areaHeight = area
    ? doc.heightOfString(area, { width: courseWidth - innerPadding * 2 })
    : 0;

  doc.font("Helvetica").fontSize(7.8);
  const conclusionHeight = doc.heightOfString(conclusion, {
    width: conclusionWidth - innerPadding * 2,
  });

  const rowHeight = Math.max(
    25,
    courseHeight + areaHeight + 10,
    conclusionHeight + 10,
  );

  if (index % 2 === 0) {
    doc
      .rect(MARGIN, startY, contentWidth, rowHeight)
      .fillColor(COLORS.light)
      .fill();
  }

  doc.lineWidth(0.5).strokeColor(COLORS.border);
  doc.rect(MARGIN, startY, courseWidth, rowHeight).stroke();
  doc.rect(MARGIN + courseWidth, startY, noteWidth, rowHeight).stroke();
  doc
    .rect(
      MARGIN + courseWidth + noteWidth,
      startY,
      conclusionWidth,
      rowHeight,
    )
    .stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(8.4)
    .fillColor(COLORS.dark)
    .text(course, MARGIN + innerPadding, startY + innerPadding, {
      width: courseWidth - innerPadding * 2,
    });

  if (area) {
    doc
      .font("Helvetica")
      .fontSize(6.8)
      .fillColor(COLORS.slate)
      .text(area, MARGIN + innerPadding, startY + innerPadding + courseHeight, {
        width: courseWidth - innerPadding * 2,
      });
  }

  const noteText = String(note);
  doc.font("Helvetica-Bold").fontSize(9);
  const noteHeight = doc.heightOfString(noteText, {
    width: noteWidth,
    align: "center",
  });

  doc.fillColor(COLORS.guindo).text(
    noteText,
    MARGIN + courseWidth,
    startY + (rowHeight - noteHeight) / 2,
    {
      width: noteWidth,
      align: "center",
    },
  );

  doc
    .font("Helvetica")
    .fontSize(7.8)
    .fillColor(COLORS.dark)
    .text(
      conclusion,
      MARGIN + courseWidth + noteWidth + innerPadding,
      startY + innerPadding,
      {
        width: conclusionWidth - innerPadding * 2,
      },
    );

  return startY + rowHeight;
};

const drawAttendance = (doc, data, startY) => {
  const contentWidth = doc.page.width - MARGIN * 2;
  const asistencia = data.asistencia || {};
  const items = [
    ["Asistencias", `${toNumber(asistencia.total_presente)} días`],
    ["Tardanzas", `${toNumber(asistencia.total_tardanza)}`],
    ["Faltas", `${toNumber(asistencia.total_falta)}`],
    [
      "% Asistencia",
      `${toNumber(asistencia.porcentaje_asistencia).toFixed(2)}%`,
    ],
  ];
  const boxHeight = 38;
  const itemWidth = contentWidth / items.length;

  doc
    .roundedRect(MARGIN, startY, contentWidth, boxHeight, 6)
    .fillAndStroke("#F1F5F9", COLORS.border);

  items.forEach(([label, value], index) => {
    const x = MARGIN + index * itemWidth;
    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor(COLORS.slate)
      .text(label.toUpperCase(), x + 8, startY + 8, {
        width: itemWidth - 16,
        align: "center",
        lineBreak: false,
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(COLORS.dark)
      .text(value, x + 8, startY + 19, {
        width: itemWidth - 16,
        align: "center",
        lineBreak: false,
      });
  });

  return startY + boxHeight + 10;
};

const addFooters = (doc, institucion = null) => {
  const range = doc.bufferedPageRange();
  const contentWidth = doc.page.width - MARGIN * 2;
  const generatedAt = formatGeneratedAt(institucion);
  const pie = String(institucion?.texto_pie || "").trim();
  const leftText = pie
    ? `${pie} · ${generatedAt}`
    : `Generado el ${generatedAt}`;

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);

    const previousBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc
      .font("Helvetica")
      .fontSize(6.8)
      .fillColor(COLORS.slate)
      .text(leftText, MARGIN, doc.page.height - 27, {
        width: contentWidth / 2,
        lineBreak: false,
      });

    doc.text(
      `Página ${i + 1} de ${range.count}`,
      MARGIN,
      doc.page.height - 27,
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
 * Genera el PDF de la libreta a partir del objeto de reporteService.getLibreta.
 * @param {object} data
 * @returns {Promise<Buffer>}
 */
const generarLibretaPdf = async (data) => {
  const institucion = await configuracionService.obtenerInstitucionDocumentos();
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: {
          top: MARGIN,
          bottom: MARGIN,
          left: MARGIN,
          right: MARGIN,
        },
        bufferPages: true,
        info: {
          Title: `Libreta - ${safeText(data.alumno?.nombre_completo, "")}`,
          Author: `SIGA-UC - ${institucion.nombre_institucion}`,
          Subject: `Libreta ${safeText(data.bimestre)}° Bimestre ${safeText(data.anio_lectivo)}`,
        },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const contentBottom = doc.page.height - MARGIN - FOOTER_SPACE;
      let y = drawHeader(doc, data, institucion);
      y = drawInfo(doc, data, y);

      const drawTable = () => {
        y = drawTableHeader(doc, y);
      };

      drawTable();

      const notas = Array.isArray(data.notas) ? data.notas : [];

      if (notas.length === 0) {
        doc
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor(COLORS.slate)
          .text("Sin notas registradas para este bimestre.", MARGIN + 8, y + 10);
        y += 34;
      } else {
        notas.forEach((nota, index) => {
          // Calcular la altura antes de decidir el salto de página.
          doc.font("Helvetica-Bold").fontSize(8.4);
          const courseHeight = doc.heightOfString(
            safeText(nota.nombre_curso),
            { width: 175 },
          );
          doc.font("Helvetica").fontSize(6.8);
          const areaHeight = nota.area_academica
            ? doc.heightOfString(String(nota.area_academica), { width: 175 })
            : 0;
          doc.font("Helvetica").fontSize(7.8);
          const conclusionHeight = doc.heightOfString(
            safeText(nota.conclusion),
            { width: doc.page.width - MARGIN * 2 - 235 - 10 },
          );
          const estimatedHeight = Math.max(
            25,
            courseHeight + areaHeight + 10,
            conclusionHeight + 10,
          );

          if (y + estimatedHeight > contentBottom) {
            doc.addPage();
            y = drawHeader(doc, data, institucion);
            y = drawTableHeader(doc, y);
          }

          y = drawRow(doc, nota, y, index);
        });
      }

      if (y + 48 > contentBottom) {
        doc.addPage();
        y = drawHeader(doc, data, institucion);
      }

      drawAttendance(doc, data, y + 8);
      addFooters(doc, institucion);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generarLibretaPdf,
};
