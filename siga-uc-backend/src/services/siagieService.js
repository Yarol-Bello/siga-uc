/**
 * Servicio de Exportación Interna de Calificaciones (SIAGIE)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Genera un Excel de apoyo interno con una fila por alumno y curso:
 * DNI, alumno, grado, sección, año, bimestre, curso, nota final y conclusión
 * descriptiva. No es una exportación oficial al SIAGIE/MINEDU.
 *
 * Los cursos salen de la carga curricular del grado y año (H05), no de una
 * lista fija de prefijos.
 */

const ExcelJS = require("exceljs");
const siagieDao = require("../dao/siagieDao");

const BIMESTRES_VALIDOS = [1, 2, 3, 4];
const ENCABEZADOS = [
  "DNI",
  "Alumno",
  "Grado",
  "Sección",
  "Año",
  "Bimestre",
  "Curso",
  "Área",
  "Nota final",
  "Conclusión descriptiva",
];

const AVISO_INTERNO =
  "Exportación interna. No es una exportación oficial a SIAGIE/MINEDU.";

const crearError = (mensaje, statusCode) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
};

const validarParametros = ({ id_grado, bimestre, anio_lectivo }) => {
  if (!Number.isInteger(id_grado) || id_grado <= 0) {
    throw crearError("El grado es obligatorio y debe ser válido.", 400);
  }
  if (!BIMESTRES_VALIDOS.includes(bimestre)) {
    throw crearError("El bimestre debe estar entre 1 y 4.", 400);
  }
  if (!Number.isInteger(anio_lectivo) || anio_lectivo < 2000) {
    throw crearError("El año lectivo es obligatorio y debe ser válido.", 400);
  }
};

const textoBimestre = (bimestre) =>
  ["I", "II", "III", "IV"][bimestre - 1] || String(bimestre);

const limpiarNombreArchivo = (texto) =>
  String(texto || "grado")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const clave = (id_alumno, id_curso) => `${id_alumno}:${id_curso}`;

/**
 * Carga los datos del grado y calcula el resumen de la exportación.
 */
const cargarDatos = async ({ id_grado, bimestre, anio_lectivo }) => {
  validarParametros({ id_grado, bimestre, anio_lectivo });

  const grado = await siagieDao.obtenerGrado(id_grado);
  if (!grado) {
    throw crearError("Grado no encontrado.", 404);
  }
  if (Number(grado.anio_lectivo) !== anio_lectivo) {
    throw crearError(
      "El grado no pertenece al año lectivo solicitado.",
      404,
    );
  }

  const [cursos, alumnos, notas, conclusiones] = await Promise.all([
    siagieDao.obtenerCursosDelGrado(id_grado, anio_lectivo),
    siagieDao.obtenerAlumnosDelGrado(id_grado, anio_lectivo),
    siagieDao.obtenerNotasFinales(id_grado, bimestre, anio_lectivo),
    siagieDao.obtenerConclusiones(id_grado, bimestre, anio_lectivo),
  ]);

  const totalCombinaciones = alumnos.length * cursos.length;
  const totalNotas = notas.filter((nota) => nota.nota_final).length;
  const totalConclusiones = conclusiones.filter(
    (conclusion) => conclusion.conclusion,
  ).length;

  const advertencias = [];
  if (cursos.length === 0) {
    advertencias.push(
      "No hay cursos en la carga curricular para este grado y año.",
    );
  }
  if (alumnos.length === 0) {
    advertencias.push(
      "No hay alumnos matriculados en este grado y año.",
    );
  }
  if (cursos.length > 0 && alumnos.length > 0 && totalNotas === 0) {
    advertencias.push(
      "No hay notas finales registradas para este bimestre; las celdas de nota quedarán vacías.",
    );
  } else if (totalNotas < totalCombinaciones) {
    advertencias.push(
      `Faltan notas finales: ${totalNotas} de ${totalCombinaciones} combinaciones alumno-curso.`,
    );
  }

  return {
    grado,
    cursos,
    alumnos,
    notas,
    conclusiones,
    resumen: {
      anio_lectivo,
      bimestre,
      id_grado,
      nombre_grado: grado.nombre_grado,
      nivel: grado.nivel,
      seccion: grado.seccion,
      total_cursos: cursos.length,
      total_alumnos: alumnos.length,
      total_notas: totalNotas,
      total_conclusiones: totalConclusiones,
      total_combinaciones: totalCombinaciones,
      exportable: cursos.length > 0 && alumnos.length > 0,
      advertencias,
    },
  };
};

/**
 * Resumen de solo lectura para la pantalla ADMIN.
 */
const obtenerResumen = async (params) => {
  const { resumen } = await cargarDatos(params);
  return resumen;
};

/**
 * Construye el workbook interno.
 */
const construirWorkbook = ({
  grado,
  cursos,
  alumnos,
  notas,
  conclusiones,
  bimestre,
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SIGA-UC";
  workbook.created = new Date();
  workbook.subject = "Exportación interna de calificaciones";

  const hoja = workbook.addWorksheet("Notas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  hoja.columns = [
    { header: "DNI", key: "dni", width: 13 },
    { header: "Alumno", key: "alumno", width: 32 },
    { header: "Grado", key: "grado", width: 22 },
    { header: "Sección", key: "seccion", width: 10 },
    { header: "Año", key: "anio", width: 8 },
    { header: "Bimestre", key: "bimestre", width: 10 },
    { header: "Curso", key: "curso", width: 26 },
    { header: "Área", key: "area", width: 22 },
    { header: "Nota final", key: "nota", width: 11 },
    { header: "Conclusión descriptiva", key: "conclusion", width: 60 },
  ];

  const filaEncabezado = hoja.getRow(1);
  filaEncabezado.values = ENCABEZADOS;
  filaEncabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  filaEncabezado.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF800020" },
  };
  filaEncabezado.alignment = { vertical: "middle", horizontal: "center" };
  filaEncabezado.height = 22;

  const notasPorClave = new Map(
    notas.map((nota) => [clave(nota.id_alumno, nota.id_curso), nota.nota_final]),
  );
  const conclusionesPorClave = new Map(
    conclusiones.map((conclusion) => [
      clave(conclusion.id_alumno, conclusion.id_curso),
      conclusion.conclusion,
    ]),
  );

  for (const alumno of alumnos) {
    for (const curso of cursos) {
      const llave = clave(alumno.id_alumno, curso.id_curso);
      hoja.addRow({
        dni: alumno.dni,
        alumno: alumno.nombre_completo,
        grado: grado.nombre_grado,
        seccion: grado.seccion,
        anio: grado.anio_lectivo,
        bimestre: textoBimestre(bimestre),
        curso: curso.nombre_curso,
        area: curso.area_academica,
        nota: notasPorClave.get(llave) || "",
        conclusion: conclusionesPorClave.get(llave) || "",
      });
    }
  }

  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ENCABEZADOS.length },
  };
  hoja.getColumn("nota").alignment = { horizontal: "center" };
  hoja.getColumn("dni").alignment = { horizontal: "center" };

  return { workbook, hoja };
};

/**
 * Generar el Excel interno y registrarlo en exportaciones_siagie.
 */
const generarExcelInterno = async ({
  id_grado,
  bimestre,
  anio_lectivo,
  id_usuario,
}) => {
  const datos = await cargarDatos({ id_grado, bimestre, anio_lectivo });
  const { resumen } = datos;

  if (!resumen.exportable) {
    throw crearError(
      resumen.advertencias[0] ||
        "No se puede generar la exportación con los filtros elegidos.",
      422,
    );
  }

  const { workbook } = construirWorkbook({
    ...datos,
    bimestre,
  });

  // Segunda hoja: aviso explícito para quien abra el archivo.
  const aviso = workbook.addWorksheet("Aviso");
  aviso.columns = [{ width: 34 }, { width: 78 }];
  aviso.addRow(["EXPORTACIÓN INTERNA DE CALIFICACIONES"]);
  aviso.getRow(1).font = { bold: true, size: 14, color: { argb: "FF800020" } };
  aviso.addRow([AVISO_INTERNO]);
  aviso.getRow(2).font = { bold: true, color: { argb: "FFB45309" } };
  aviso.addRow([]);
  const metadatos = [
    ["Año lectivo", datos.grado.anio_lectivo],
    ["Bimestre", textoBimestre(resumen.bimestre)],
    ["Grado", `${datos.grado.nombre_grado} — ${datos.grado.seccion}`],
    ["Cursos incluidos", resumen.total_cursos],
    ["Alumnos incluidos", resumen.total_alumnos],
    ["Notas finales", resumen.total_notas],
    ["Conclusiones descriptivas", resumen.total_conclusiones],
    ["Generado", new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })],
    ["Fuente", "SIGA-UC — base de datos institucional"],
  ];
  for (const [etiqueta, valor] of metadatos) {
    const fila = aviso.addRow([etiqueta, valor]);
    fila.getCell(1).font = { bold: true };
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const nombreArchivo = `EXPORTACION_INTERNA_${limpiarNombreArchivo(
    datos.grado.nombre_grado,
  )}_BIM${bimestre}_${anio_lectivo}.xlsx`;

  await siagieDao.registrarExportacion({
    id_grado,
    bimestre,
    anio_lectivo,
    nombre_archivo: nombreArchivo,
    id_usuario,
  });

  return {
    buffer,
    nombre_archivo: nombreArchivo,
    resumen,
  };
};

module.exports = {
  AVISO_INTERNO,
  obtenerResumen,
  generarExcelInterno,
};
