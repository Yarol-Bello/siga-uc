/**
 * Rutas de Calificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const calificacionController = require("../controllers/calificacionController");
const {
  verificarAutenticacion,
} = require("../middlewares/authMiddleware");
const {
  checkRole,
  checkAlumnoPropio,
  checkCursoDocente,
  checkCursosDocenteBody,
} = require("../middlewares/authRoles");

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarAutenticacion);

// ============================================================
// CONSULTAS
// ============================================================
router.get(
  "/alumno/:id_alumno/curso/:id_curso",
  checkRole(["ADMIN", "DOCENTE", "ESTUDIANTE"]),
  checkAlumnoPropio,
  checkCursoDocente,
  calificacionController.obtenerPorAlumnoCurso,
);
router.get(
  "/curso/:id_curso/grado/:id_grado",
  checkRole(["ADMIN", "DOCENTE"]),
  checkCursoDocente,
  calificacionController.obtenerPorCursoGrado,
);
router.get(
  "/curso/:id_curso/grado/:id_grado/conclusiones",
  checkRole(["ADMIN", "DOCENTE"]),
  checkCursoDocente,
  calificacionController.obtenerConclusionesCursoGrado,
);
router.get(
  "/notas-finales/alumno/:id_alumno",
  checkRole(["ADMIN", "DOCENTE", "ESTUDIANTE"]),
  checkAlumnoPropio,
  calificacionController.obtenerNotasFinales,
);

// ============================================================
// REGISTROS (DOCENTE y ADMIN)
// ============================================================
router.post(
  "/",
  checkRole(["ADMIN", "DOCENTE"]),
  checkCursoDocente,
  calificacionController.registrar,
);
router.post(
  "/masivo",
  checkRole(["ADMIN", "DOCENTE"]),
  checkCursosDocenteBody,
  calificacionController.registrarMasivo,
);
router.post(
  "/notas-finales",
  checkRole(["ADMIN", "DOCENTE"]),
  checkCursoDocente,
  calificacionController.calcularNotaFinal,
);
router.put(
  "/conclusiones",
  checkRole(["ADMIN", "DOCENTE"]),
  checkCursoDocente,
  calificacionController.guardarConclusion,
);

module.exports = router;
