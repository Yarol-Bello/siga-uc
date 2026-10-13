/**
 * Rutas de Calificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const calificacionController = require("../controllers/calificacionController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarAutenticacion);

// ============================================================
// CONSULTAS
// ============================================================
router.get(
  "/alumno/:id_alumno/curso/:id_curso",
  calificacionController.obtenerPorAlumnoCurso,
);
router.get(
  "/curso/:id_curso/grado/:id_grado",
  calificacionController.obtenerPorCursoGrado,
);
router.get(
  "/notas-finales/alumno/:id_alumno",
  calificacionController.obtenerNotasFinales,
);

// ============================================================
// REGISTROS (DOCENTE y ADMIN)
// ============================================================
router.post(
  "/",
  verificarRol("ADMIN", "DOCENTE"),
  calificacionController.registrar,
);
router.post(
  "/masivo",
  verificarRol("ADMIN", "DOCENTE"),
  calificacionController.registrarMasivo,
);
router.post(
  "/notas-finales",
  verificarRol("ADMIN", "DOCENTE"),
  calificacionController.calcularNotaFinal,
);

module.exports = router;
