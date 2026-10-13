/**
 * Servicio de Exportación SIAGIE
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Genera un archivo Excel inyectando las notas de PostgreSQL
 * sobre la plantilla oficial del MINEDU.
 */

const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const siagieDao = require("../dao/siagieDao");

/**
 * Generar el Excel SIAGIE inyectado con las notas
 * @param {object} params - { id_grado, bimestre, anio_lectivo, archivo_plantilla, id_usuario }
 * @returns {Promise<string>} - Ruta del archivo generado
 */
const generarExcel = async (params) => {
  const { id_grado, bimestre, anio_lectivo, archivo_plantilla, id_usuario } =
    params;

  // 1. Validar grado
  const grado = await siagieDao.obtenerGrado(id_grado);
  if (!grado) {
    const error = new Error("Grado no encontrado");
    error.statusCode = 404;
    throw error;
  }

  // 2. Obtener notas de PostgreSQL
  const notas = await siagieDao.obtenerNotasParaSIAGIE(
    id_grado,
    bimestre,
    anio_lectivo,
  );
  if (notas.length === 0) {
    const error = new Error(
      "No hay notas registradas para este grado y bimestre",
    );
    error.statusCode = 404;
    throw error;
  }

  // 3. Crear workbook a partir de la plantilla
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(archivo_plantilla);

  // 4. Obtener la primera hoja (donde van las notas)
  const worksheet = workbook.worksheets[0];

  // 5. Detectar fila de encabezados (donde está "DNI" o "Alumno")
  let filaEncabezado = -1;
  let colDni = -1;
  const colsCursos = {};

  worksheet.eachRow((row, rowNumber) => {
    if (filaEncabezado !== -1) return;

    row.eachCell((cell, colNumber) => {
      const valor = String(cell.value || "")
        .toUpperCase()
        .trim();
      if (valor.includes("DNI") || valor.includes("DOCUMENTO")) {
        filaEncabezado = rowNumber;
        colDni = colNumber;
      }
      // Detectar columnas de cursos
      if (
        valor.includes("ARITM") ||
        valor.includes("ALGEBRA") ||
        valor.includes("COMUNIC") ||
        valor.includes("FISICA")
      ) {
        colsCursos[valor] = colNumber;
      }
    });
  });

  // 6. Si no se detectó encabezado, usar fila 5 por defecto
  if (filaEncabezado === -1) {
    filaEncabezado = 5;
    colDni = 3;
  }

  // 7. Agrupar notas por alumno
  const notasPorAlumno = {};
  notas.forEach((n) => {
    if (!notasPorAlumno[n.dni]) {
      notasPorAlumno[n.dni] = { alumno: n, cursos: {} };
    }
    notasPorAlumno[n.dni].cursos[n.nombre_curso.toUpperCase()] =
      n.nota_final || "";
  });

  // 8. Inyectar notas fila por fila
  let filaActual = filaEncabezado + 1;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= filaEncabezado) return;

    const dniCell = row.getCell(colDni);
    const dni = String(dniCell.value || "").trim();

    if (notasPorAlumno[dni]) {
      const datos = notasPorAlumno[dni];

      // Rellenar cada curso detectado
      Object.keys(colsCursos).forEach((cursoKey) => {
        Object.keys(datos.cursos).forEach((nombreCurso) => {
          if (
            cursoKey.includes(nombreCurso.substring(0, 5)) ||
            nombreCurso.includes(cursoKey.substring(0, 5))
          ) {
            row.getCell(colsCursos[cursoKey]).value = datos.cursos[nombreCurso];
          }
        });
      });
    }
  });

  // 9. Guardar el archivo generado
  const nombreArchivo = `SIAGIE_${grado.nombre_grado.replace(/\s+/g, "_")}_BIM${bimestre}_${anio_lectivo}.xlsx`;
  const carpetaSalida = path.join(__dirname, "..", "..", "uploads", "siagie");
  if (!fs.existsSync(carpetaSalida)) {
    fs.mkdirSync(carpetaSalida, { recursive: true });
  }
  const rutaSalida = path.join(carpetaSalida, nombreArchivo);
  await workbook.xlsx.writeFile(rutaSalida);

  // 10. Registrar en auditoría
  await siagieDao.registrarExportacion({
    id_grado,
    bimestre,
    anio_lectivo,
    nombre_archivo: nombreArchivo,
    id_usuario,
  });

  return {
    nombre_archivo: nombreArchivo,
    ruta: rutaSalida,
    total_alumnos: Object.keys(notasPorAlumno).length,
    total_notas: notas.filter((n) => n.nota_final).length,
  };
};

module.exports = {
  generarExcel,
};
