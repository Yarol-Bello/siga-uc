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
// ASISTENCIA DE PERSONAL (QR)
// ============================================================
router.get("/personal/todos", asistenciaController.listarAsistenciaPersonal);
router.get(
  "/personal/resumen",
  asistenciaController.obtenerResumenAsistenciaPersonal,
);
router.get("/personal/dni/:dni", asistenciaController.buscarPersonalPorDni);
router.post(
  "/personal/marcar",
  verificarRol("ADMIN", "SECRETARIA"),
  asistenciaController.registrarAsistenciaPersonal,
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
