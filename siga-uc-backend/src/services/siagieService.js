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
const crypto = require("node:crypto");
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
  "Nivel de logro",
  "Avance",
  "Dificultad",
  "Sugerencia",
  "Conclusión descriptiva",
  "Estado",
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
  const totalConclusionesPublicadas = conclusiones.filter(
    (conclusion) => conclusion.conclusion && conclusion.estado === "PUBLICADO",
  ).length;
  const totalConclusionesBorrador = conclusiones.filter(
    (conclusion) => conclusion.estado === "BORRADOR",
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
  if (totalConclusionesBorrador > 0) {
    advertencias.push(
      `Hay ${totalConclusionesBorrador} conclusión(es) en borrador; se exportan con estado BORRADOR.`,
    );
  }
  if (totalConclusiones < totalCombinaciones) {
    advertencias.push(
      `Faltan conclusiones descriptivas: ${totalConclusiones} de ${totalCombinaciones} combinaciones alumno-curso.`,
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
      total_conclusiones_publicadas: totalConclusionesPublicadas,
      total_conclusiones_borrador: totalConclusionesBorrador,
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
 * Construye las filas del Excel interno.
 * Una fila por alumno y curso, con la conclusión estructurada (Opción A).
 */
const construirFilas = ({
  grado,
  cursos,
  alumnos,
  notas,
  conclusiones,
  bimestre,
}) => {
  const notasPorClave = new Map(
    notas.map((nota) => [clave(nota.id_alumno, nota.id_curso), nota.nota_final]),
  );
  const conclusionesPorClave = new Map(
    conclusiones.map((conclusion) => [
      clave(conclusion.id_alumno, conclusion.id_curso),
      conclusion,
    ]),
  );

  const filas = [];
  const alumnosOrdenados = [...alumnos].sort(
    (a, b) => Number(a.id_alumno) - Number(b.id_alumno),
  );
  const cursosOrdenados = [...cursos].sort(
    (a, b) => Number(a.id_curso) - Number(b.id_curso),
  );
  for (const alumno of alumnosOrdenados) {
    for (const curso of cursosOrdenados) {
      const llave = clave(alumno.id_alumno, curso.id_curso);
      const conclusion = conclusionesPorClave.get(llave) || null;
      filas.push({
        dni: alumno.dni,
        alumno: alumno.nombre_completo,
        grado: grado.nombre_grado,
        seccion: grado.seccion,
        anio: grado.anio_lectivo,
        bimestre: textoBimestre(bimestre),
        curso: curso.nombre_curso,
        area: curso.area_academica,
        nota: notasPorClave.get(llave) || "",
        nivel: conclusion?.nivel_logro || "",
        avance: conclusion?.avance || "",
        dificultad: conclusion?.dificultad || "",
        sugerencia: conclusion?.sugerencia || "",
        conclusion: conclusion?.conclusion || "",
        estado: conclusion
          ? conclusion.estado ||
            (conclusion.conclusion ? "PUBLICADO" : "SIN CONCLUSIÓN")
          : "SIN CONCLUSIÓN",
      });
    }
  }
  return filas;
};

/**
 * Hash SHA-256 determinístico del contenido exportado.
 * No usa el binario del Excel: usa los datos canónicos de la exportación.
 */
const construirPayloadHash = (resumen, filas) => {
  const payload = {
    anio_lectivo: resumen.anio_lectivo,
    bimestre: resumen.bimestre,
    id_grado: resumen.id_grado,
    nombre_grado: resumen.nombre_grado,
    seccion: resumen.seccion,
    total_cursos: resumen.total_cursos,
    total_alumnos: resumen.total_alumnos,
    total_notas: resumen.total_notas,
    total_conclusiones: resumen.total_conclusiones,
    filas: filas.map((fila) => ({
      dni: fila.dni,
      curso: fila.curso,
      nota: fila.nota,
      nivel: fila.nivel,
      avance: fila.avance,
      dificultad: fila.dificultad,
      sugerencia: fila.sugerencia,
      conclusion: fila.conclusion,
      estado: fila.estado,
    })),
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
};

const crearCodigoControl = (anio, bimestre, hash) =>
  `SI-${anio}-${bimestre}-${hash.slice(0, 12).toUpperCase()}`;

/**
 * Construye el workbook interno con las columnas estructuradas.
 */
const construirWorkbook = ({ filas }) => {
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
    { header: "Nivel de logro", key: "nivel", width: 14 },
    { header: "Avance", key: "avance", width: 42 },
    { header: "Dificultad", key: "dificultad", width: 42 },
    { header: "Sugerencia", key: "sugerencia", width: 42 },
    { header: "Conclusión descriptiva", key: "conclusion", width: 62 },
    { header: "Estado", key: "estado", width: 16 },
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

  filas.forEach((fila) => hoja.addRow(fila));

  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ENCABEZADOS.length },
  };
  hoja.getColumn("nota").alignment = { horizontal: "center" };
  hoja.getColumn("dni").alignment = { horizontal: "center" };
  hoja.getColumn("nivel").alignment = { horizontal: "center" };
  hoja.getColumn("estado").alignment = { horizontal: "center" };
  for (const key of ["avance", "dificultad", "sugerencia", "conclusion"]) {
    hoja.getColumn(key).alignment = {
      vertical: "top",
      wrapText: true,
    };
  }

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

  const filas = construirFilas({
    ...datos,
    bimestre,
  });
  const hashIntegridad = construirPayloadHash(resumen, filas);
  const codigoControl = crearCodigoControl(
    anio_lectivo,
    bimestre,
    hashIntegridad,
  );

  const { workbook } = construirWorkbook({ filas });

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
    ["Conclusiones publicadas", resumen.total_conclusiones_publicadas],
    ["Conclusiones en borrador", resumen.total_conclusiones_borrador],
    ["Generado", new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })],
    ["Fuente", "SIGA-UC — base de datos institucional"],
    ["Código de control interno", codigoControl],
    ["Hash de integridad (SHA-256)", hashIntegridad],
    [
      "Alcance del código",
      "Control interno de SIGA-UC. No es el código oficial de SIAGIE/MINEDU.",
    ],
    ["Válido para SIAGIE", "No. Documento interno."],
  ];
  for (const [etiqueta, valor] of metadatos) {
    const fila = aviso.addRow([etiqueta, valor]);
    fila.getCell(1).font = { bold: true };
    fila.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const nombreArchivo = `EXPORTACION_INTERNA_${limpiarNombreArchivo(
    datos.grado.nombre_grado,
  )}_BIM${bimestre}_${anio_lectivo}.xlsx`;

  const exportacion = await siagieDao.registrarExportacion({
    id_grado,
    bimestre,
    anio_lectivo,
    nombre_archivo: nombreArchivo,
    id_usuario,
    codigo_control: codigoControl,
    hash_integridad: hashIntegridad,
    origen: "INTERNO",
    detalle: {
      total_filas: filas.length,
      total_notas: resumen.total_notas,
      total_conclusiones: resumen.total_conclusiones,
      total_conclusiones_publicadas: resumen.total_conclusiones_publicadas,
      total_conclusiones_borrador: resumen.total_conclusiones_borrador,
      advertencias: resumen.advertencias,
    },
  });

  return {
    buffer,
    nombre_archivo: nombreArchivo,
    resumen,
    codigo_control: codigoControl,
    hash_integridad: hashIntegridad,
    id_exportacion: exportacion.id_exportacion,
  };
};

/**
 * Verificar un código de control interno contra el estado actual de los datos.
 * No es una validación oficial de SIAGIE.
 */
const verificarExportacion = async (codigo) => {
  const codigoLimpio = String(codigo || "")
    .trim()
    .toUpperCase();
  if (!codigoLimpio) {
    throw crearError("El código de control es obligatorio.", 400);
  }

  const exportacion = await siagieDao.findExportacionPorCodigo(codigoLimpio);
  if (!exportacion) {
    throw crearError("Código de control interno no encontrado.", 404);
  }

  const datos = await cargarDatos({
    id_grado: exportacion.id_grado,
    bimestre: exportacion.bimestre,
    anio_lectivo: exportacion.anio_lectivo,
  });
  const filas = construirFilas({
    ...datos,
    bimestre: exportacion.bimestre,
  });
  const hashActual = construirPayloadHash(datos.resumen, filas);

  return {
    codigo_control: exportacion.codigo_control,
    origen: exportacion.origen,
    fecha_generacion: exportacion.fecha_generacion,
    nombre_archivo: exportacion.nombre_archivo,
    hash_registrado: exportacion.hash_integridad,
    hash_actual: hashActual,
    coincide:
      Boolean(exportacion.hash_integridad) &&
      hashActual === exportacion.hash_integridad,
    resumen: datos.resumen,
    aviso: AVISO_INTERNO,
  };
};

module.exports = {
  AVISO_INTERNO,
  obtenerResumen,
  generarExcelInterno,
  verificarExportacion,
};
