/**
 * Rutas de Asistencia
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const asistenciaController = require("../controllers/asistenciaController");
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
  "/curso/:id_curso/fecha/:fecha",
  asistenciaController.obtenerPorCursoFecha,
);
router.get("/alumno/:id_alumno", asistenciaController.obtenerPorAlumno);
router.get(
  "/alumno/:id_alumno/resumen",
  asistenciaController.obtenerResumenPorAlumno,
);

// ============================================================
// REGISTROS (solo DOCENTE y ADMIN)
// ============================================================
router.post(
  "/",
  verificarRol("ADMIN", "DOCENTE"),
  asistenciaController.registrar,
);
router.post(
  "/masivo",
  verificarRol("ADMIN", "DOCENTE"),
  asistenciaController.registrarMasivo,
);

module.exports = router;
