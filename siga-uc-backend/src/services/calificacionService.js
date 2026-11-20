/**
 * Servicio de Calificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const calificacionDao = require("../dao/calificacionDao");
const alumnoDao = require("../dao/alumnoDao");
const cursoDao = require("../dao/cursoDao");
const auditoriaDao = require("../dao/auditoriaDao");
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
  const alumno = await alumnoDao.findById(id_alumno);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }
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
  const alumno = await alumnoDao.findById(id_alumno);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }

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

module.exports = {
  obtenerPorAlumnoCurso,
  obtenerPorCursoGrado,
  registrar,
  registrarMasivo,
  calcularYGuardarNotaFinal,
  obtenerNotasFinales,
};
