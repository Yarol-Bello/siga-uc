/**
 * Servicio de Calificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const calificacionDao = require("../dao/calificacionDao");
const alumnoDao = require("../dao/alumnoDao");
const cursoDao = require("../dao/cursoDao");
const cargaCurricularDao = require("../dao/cargaCurricularDao");
const auditoriaDao = require("../dao/auditoriaDao");
const auditoriaService = require("./auditoriaService");
const { getClient } = require("../config/database");
const { getAnioLectivo } = require("../config/academico");

const verificarActaAbierta = async (idGrado, bimestre, anioLectivo) => {
  if (!idGrado) return;

  const cerrada = await auditoriaDao.actaEstaCerrada(
    idGrado,
    bimestre,
    anioLectivo,
  );

  if (cerrada) {
    const error = new Error(
      "El acta ya está cerrada. No se pueden modificar las notas.",
    );
    error.statusCode = 409;
    throw error;
  }
};

const verificarActasAbiertas = async (registros) => {
  const vistos = new Set();

  for (const reg of registros) {
    const idGrado = reg.id_grado;
    const bimestre = reg.bimestre;
    const anioLectivo = reg.anio_lectivo || getAnioLectivo();

    if (!idGrado) continue;

    const clave = `${idGrado}-${bimestre}-${anioLectivo}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    await verificarActaAbierta(idGrado, bimestre, anioLectivo);
  }
};

const recalcularNotaFinalSeguro = async (
  id_alumno,
  id_curso,
  bimestre,
  anioLectivo,
  idGrado = null,
) => {
  try {
    const saved = await calcularYGuardarNotaFinal(
      id_alumno,
      id_curso,
      bimestre,
      anioLectivo,
      idGrado,
    );
    return { ok: true, nota_final: saved?.nota_final || null };
  } catch (error) {
    console.error(
      `⚠️ No se pudo calcular la nota final (alumno ${id_alumno}, curso ${id_curso}, bimestre ${bimestre}):`,
      error.message,
    );
    return { ok: false, error: error.message };
  }
};

const obtenerPorAlumnoCurso = async (
  id_alumno,
  id_curso,
  anioLectivo,
  idPersonal = null,
) => {
  await alumnoDao.validarMatriculaAnual(id_alumno, anioLectivo);
  const curso = await cursoDao.findById(id_curso);
  if (!curso) {
    const error = new Error("Curso no encontrado");
    error.statusCode = 404;
    throw error;
  }
  return await calificacionDao.obtenerPorAlumnoCurso(
    id_alumno,
    id_curso,
    anioLectivo,
    idPersonal,
  );
};

const obtenerPorCursoGrado = async (
  id_curso,
  id_grado,
  bimestre,
  anioLectivo,
  idPersonal = null,
) => {
  if (!bimestre || bimestre < 1 || bimestre > 4) {
    const error = new Error("Bimestre inválido (1-4)");
    error.statusCode = 400;
    throw error;
  }
  return await calificacionDao.obtenerPorCursoGrado(
    id_curso,
    id_grado,
    bimestre,
    anioLectivo,
    idPersonal,
  );
};

const registrar = async (data) => {
  if (
    !data.id_alumno ||
    !data.id_curso ||
    !data.id_competencia ||
    !data.bimestre ||
    !data.calificacion
  ) {
    const error = new Error("Faltan campos obligatorios");
    error.statusCode = 400;
    throw error;
  }
  if (!["AD", "A", "B", "C"].includes(data.calificacion)) {
    const error = new Error("Calificación inválida. Debe ser AD, A, B o C");
    error.statusCode = 400;
    throw error;
  }
  if (data.bimestre < 1 || data.bimestre > 4) {
    const error = new Error("Bimestre debe estar entre 1 y 4");
    error.statusCode = 400;
    throw error;
  }

  const anioLectivo = data.anio_lectivo || getAnioLectivo();
  await verificarActaAbierta(data.id_grado, data.bimestre, anioLectivo);

  const saved = await calificacionDao.registrar(data);
  const notaFinal = await recalcularNotaFinalSeguro(
    data.id_alumno,
    data.id_curso,
    data.bimestre,
    anioLectivo,
    data.id_grado,
  );

  return {
    ...saved,
    nota_final: notaFinal.nota_final,
    notas_finales_calculadas: notaFinal.ok ? 1 : 0,
    notas_finales_errores: notaFinal.ok ? 0 : 1,
  };
};

const registrarMasivo = async (registros) => {
  if (!Array.isArray(registros) || registros.length === 0) {
    const error = new Error("Debe enviar al menos un registro");
    error.statusCode = 400;
    throw error;
  }

  await verificarActasAbiertas(registros);

  const result = await calificacionDao.registrarMasivo(registros);

  const combinaciones = new Map();
  registros.forEach((reg) => {
    if (!reg.id_alumno || !reg.id_curso || !reg.bimestre) return;
    const anioLectivo = reg.anio_lectivo || getAnioLectivo();
    const clave = `${reg.id_alumno}-${reg.id_curso}-${reg.bimestre}-${anioLectivo}`;
    if (!combinaciones.has(clave)) {
      combinaciones.set(clave, {
        id_alumno: reg.id_alumno,
        id_curso: reg.id_curso,
        bimestre: reg.bimestre,
        anio_lectivo: anioLectivo,
        id_grado: reg.id_grado || null,
      });
    }
  });

  let calculadas = 0;
  let errores = 0;

  for (const combo of combinaciones.values()) {
    const notaFinal = await recalcularNotaFinalSeguro(
      combo.id_alumno,
      combo.id_curso,
      combo.bimestre,
      combo.anio_lectivo,
      combo.id_grado,
    );
    if (notaFinal.ok) calculadas++;
    else errores++;
  }

  return {
    ...result,
    notas_finales_calculadas: calculadas,
    notas_finales_errores: errores,
  };
};

/**
 * Calcular y guardar la nota final del área para un alumno
 */
const calcularYGuardarNotaFinal = async (
  id_alumno,
  id_curso,
  bimestre,
  anioLectivo,
  idGrado = null,
) => {
  let grado = idGrado;

  if (!grado) {
    const alumno = await alumnoDao.findById(id_alumno);
    if (!alumno) {
      const error = new Error("Alumno no encontrado");
      error.statusCode = 404;
      throw error;
    }
    grado = alumno.id_grado;
  }

  await verificarActaAbierta(grado, bimestre, anioLectivo);

  const notaFinal = await calificacionDao.calcularNotaFinal(
    id_alumno,
    id_curso,
    bimestre,
    anioLectivo,
  );
  const saved = await calificacionDao.guardarNotaFinal({
    id_alumno,
    id_curso,
    bimestre,
    anio_lectivo: anioLectivo,
    nota_final: notaFinal,
    calculo_automatico: true,
  });
  return saved;
};

const obtenerNotasFinales = async (
  id_alumno,
  anioLectivo,
  idPersonal = null,
) => {
  const alumno = await alumnoDao.validarMatriculaAnual(
    id_alumno,
    anioLectivo,
  );

  const notas = await calificacionDao.obtenerNotasFinales(
    id_alumno,
    anioLectivo,
    idPersonal,
  );
  const conclusiones = await calificacionDao.obtenerConclusiones(
    id_alumno,
    anioLectivo,
    idPersonal,
  );

  // Agrupar notas por curso
  const notasPorCurso = {};
  notas.forEach((n) => {
    if (!notasPorCurso[n.id_curso]) {
      notasPorCurso[n.id_curso] = {
        id_curso: n.id_curso,
        nombre_curso: n.nombre_curso,
        area_academica: n.area_academica,
        bimestres: {},
      };
    }
    notasPorCurso[n.id_curso].bimestres[`b${n.bimestre}`] = n.nota_final;
  });

  // Agregar conclusiones
  conclusiones.forEach((c) => {
    if (notasPorCurso[c.id_curso]) {
      notasPorCurso[c.id_curso].conclusion = c.descripcion;
    }
  });

  return {
    alumno: {
      id_alumno: alumno.id_alumno,
      nombre_completo: alumno.nombre_completo,
      dni: alumno.dni,
      codigo_estudiante: alumno.codigo_estudiante,
      nombre_grado: alumno.nombre_grado,
    },
    cursos: Object.values(notasPorCurso),
  };
};

/**
 * Normaliza un texto de conclusión: recorta y colapsa espacios.
 */
const normalizarTextoConclusion = (valor) =>
  String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();

const componerDescripcionConclusion = ({ avance, dificultad, sugerencia }) =>
  [avance, dificultad, sugerencia]
    .map(normalizarTextoConclusion)
    .filter(Boolean)
    .join(" ");

const resumenConclusion = (conclusion) =>
  conclusion
    ? {
        id_conclusion: conclusion.id_conclusion,
        id_alumno: conclusion.id_alumno,
        id_curso: conclusion.id_curso,
        bimestre: conclusion.bimestre,
        anio_lectivo: conclusion.anio_lectivo,
        nivel_logro: conclusion.nivel_logro,
        avance: conclusion.avance,
        dificultad: conclusion.dificultad,
        sugerencia: conclusion.sugerencia,
        descripcion: conclusion.descripcion,
        estado: conclusion.estado,
      }
    : null;

/**
 * Listar alumnos y conclusiones de un curso/grado/bimestre.
 * Devuelve también si el acta está cerrada para que la UI sea solo lectura.
 */
const listarConclusionesCursoGrado = async (
  id_curso,
  id_grado,
  bimestre,
  anioLectivo = getAnioLectivo(),
  idPersonal = null,
) => {
  const idCurso = Number(id_curso);
  const idGrado = Number(id_grado);
  const bim = Number(bimestre);
  const anio = Number(anioLectivo) || getAnioLectivo();

  if (!idCurso || !idGrado) {
    const error = new Error("Curso y grado son obligatorios.");
    error.statusCode = 400;
    throw error;
  }
  if (![1, 2, 3, 4].includes(bim)) {
    const error = new Error("Bimestre inválido (1-4).");
    error.statusCode = 400;
    throw error;
  }

  const destino = await cargaCurricularDao.validarDestino({
    id_grado: idGrado,
    id_curso: idCurso,
    anio_lectivo: anio,
  });
  if (!destino) {
    const error = new Error("El curso no pertenece al grado y año indicados.");
    error.statusCode = 404;
    throw error;
  }

  const actaCerrada = await auditoriaDao.actaEstaCerrada(
    idGrado,
    bim,
    anio,
  );
  const alumnos = await calificacionDao.listarConclusionesCursoGrado(
    idCurso,
    idGrado,
    bim,
    anio,
    idPersonal,
  );

  return {
    acta_cerrada: Boolean(actaCerrada),
    id_grado: idGrado,
    id_curso: idCurso,
    bimestre: bim,
    anio_lectivo: anio,
    alumnos,
  };
};

/**
 * Guardar una conclusión estructurada (Opción A).
 * El nivel debe coincidir con la nota final cuando esta ya existe.
 */
const guardarConclusion = async (data = {}, usuario = {}, ip = null) => {
  const idAlumno = Number(data.id_alumno);
  const idCurso = Number(data.id_curso);
  const idGrado = Number(data.id_grado);
  const bimestre = Number(data.bimestre);
  const anio = Number(data.anio_lectivo) || getAnioLectivo();

  if (!idAlumno || !idCurso || !idGrado) {
    const error = new Error("Alumno, curso y grado son obligatorios.");
    error.statusCode = 400;
    throw error;
  }
  if (![1, 2, 3, 4].includes(bimestre)) {
    const error = new Error("Bimestre inválido (1-4).");
    error.statusCode = 400;
    throw error;
  }

  const nivel = normalizarTextoConclusion(data.nivel_logro).toUpperCase();
  if (!["AD", "A", "B", "C"].includes(nivel)) {
    const error = new Error("Nivel de logro inválido. Debe ser AD, A, B o C.");
    error.statusCode = 400;
    throw error;
  }

  const avance = normalizarTextoConclusion(data.avance);
  const dificultad = normalizarTextoConclusion(data.dificultad);
  const sugerencia = normalizarTextoConclusion(data.sugerencia);
  const estado =
    normalizarTextoConclusion(data.estado).toUpperCase() === "PUBLICADO"
      ? "PUBLICADO"
      : "BORRADOR";

  if (estado === "PUBLICADO" && (!avance || !dificultad || !sugerencia)) {
    const error = new Error(
      "Para publicar la conclusión complete avance, dificultad y sugerencia.",
    );
    error.statusCode = 400;
    throw error;
  }

  const descripcion = componerDescripcionConclusion({
    avance,
    dificultad,
    sugerencia,
  });
  if (descripcion.length > 350) {
    const error = new Error(
      `La conclusión no puede superar los 350 caracteres (actual: ${descripcion.length}).`,
    );
    error.statusCode = 400;
    error.details = {
      codigo: "CONCLUSION_LARGA",
      maximo: 350,
      actual: descripcion.length,
    };
    throw error;
  }

  const alumno = await alumnoDao.validarMatriculaAnual(idAlumno, anio);
  if (Number(alumno.id_grado) !== idGrado) {
    const error = new Error("El alumno no pertenece al grado indicado.");
    error.statusCode = 400;
    throw error;
  }

  const destino = await cargaCurricularDao.validarDestino({
    id_grado: idGrado,
    id_curso: idCurso,
    anio_lectivo: anio,
  });
  if (!destino) {
    const error = new Error("El curso no pertenece al grado y año indicados.");
    error.statusCode = 404;
    throw error;
  }

  const nota = await calificacionDao.obtenerNotaFinal(
    idAlumno,
    idCurso,
    bimestre,
    anio,
  );
  if (nota?.nota_final && nota.nota_final !== nivel) {
    const error = new Error(
      `El nivel ${nivel} no coincide con la nota final ${nota.nota_final} del curso.`,
    );
    error.statusCode = 400;
    error.details = {
      codigo: "NIVEL_NO_COINCIDE",
      nota_final: nota.nota_final,
      nivel_logro: nivel,
    };
    throw error;
  }

  await verificarActaAbierta(idGrado, bimestre, anio);

  const anterior = await calificacionDao.findConclusion(
    idAlumno,
    idCurso,
    bimestre,
    anio,
  );
  const curso = await cursoDao.findById(idCurso);
  const idPersonal = usuario?.id_personal || data.id_personal || null;
  const client = await getClient();

  try {
    await client.query("BEGIN");

    const saved = await calificacionDao.guardarConclusion(
      {
        id_alumno: idAlumno,
        id_curso: idCurso,
        bimestre,
        anio_lectivo: anio,
        descripcion,
        nivel_logro: nivel,
        avance,
        dificultad,
        sugerencia,
        estado,
        id_personal: idPersonal,
        actualizado_por: usuario?.id_usuario || null,
        publicado_por:
          estado === "PUBLICADO" ? usuario?.id_usuario || null : null,
      },
      client,
    );

    await auditoriaService.registrarEnTransaccion(client, {
      id_usuario: usuario?.id_usuario || null,
      modulo: "Calificaciones",
      accion: anterior
        ? estado === "PUBLICADO"
          ? "PUBLICAR"
          : "MODIFICAR"
        : "CREAR",
      descripcion: `Conclusión descriptiva ${curso?.nombre_curso || ""} - ${
        alumno.nombre_completo || alumno.dni || idAlumno
      } (BIM ${bimestre}, ${anio})`,
      anterior: resumenConclusion(anterior),
      nuevo: resumenConclusion(saved),
      ip,
    });

    await client.query("COMMIT");
    return saved;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerPorAlumnoCurso,
  obtenerPorCursoGrado,
  registrar,
  registrarMasivo,
  calcularYGuardarNotaFinal,
  obtenerNotasFinales,
  listarConclusionesCursoGrado,
  guardarConclusion,
};
