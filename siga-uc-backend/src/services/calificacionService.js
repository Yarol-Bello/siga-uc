/**
 * Servicio de Calificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const calificacionDao = require("../dao/calificacionDao");
const alumnoDao = require("../dao/alumnoDao");
const cursoDao = require("../dao/cursoDao");

const obtenerPorAlumnoCurso = async (id_alumno, id_curso, anioLectivo) => {
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
  );
};

const obtenerPorCursoGrado = async (
  id_curso,
  id_grado,
  bimestre,
  anioLectivo,
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
  return await calificacionDao.registrar(data);
};

const registrarMasivo = async (registros) => {
  if (!Array.isArray(registros) || registros.length === 0) {
    const error = new Error("Debe enviar al menos un registro");
    error.statusCode = 400;
    throw error;
  }
  return await calificacionDao.registrarMasivo(registros);
};

/**
 * Calcular y guardar la nota final del área para un alumno
 */
const calcularYGuardarNotaFinal = async (
  id_alumno,
  id_curso,
  bimestre,
  anioLectivo,
) => {
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

const obtenerNotasFinales = async (id_alumno, anioLectivo) => {
  const alumno = await alumnoDao.findById(id_alumno);
  if (!alumno) {
    const error = new Error("Alumno no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const notas = await calificacionDao.obtenerNotasFinales(
    id_alumno,
    anioLectivo,
  );
  const conclusiones = await calificacionDao.obtenerConclusiones(
    id_alumno,
    anioLectivo,
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
