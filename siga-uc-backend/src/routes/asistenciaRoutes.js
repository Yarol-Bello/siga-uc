/**
 * Rutas de Asistencia
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const asistenciaController = require("../controllers/asistenciaController");
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
  "/curso/:id_curso/fecha/:fecha",
  checkRole(["ADMIN", "DOCENTE"]),
  checkCursoDocente,
  asistenciaController.obtenerPorCursoFecha,
);
router.get(
  "/alumno/:id_alumno",
  checkRole(["ADMIN", "DOCENTE", "ESTUDIANTE"]),
  checkAlumnoPropio,
  asistenciaController.obtenerPorAlumno,
);
router.get(
  "/alumno/:id_alumno/resumen",
  checkRole(["ADMIN", "DOCENTE", "ESTUDIANTE"]),
  checkAlumnoPropio,
  asistenciaController.obtenerResumenPorAlumno,
);

// ============================================================
// ASISTENCIA DE PERSONAL (QR)
// ============================================================
router.get(
  "/personal/todos",
  checkRole(["ADMIN", "SECRETARIA"]),
  asistenciaController.listarAsistenciaPersonal,
);
router.get(
  "/personal/resumen",
  checkRole(["ADMIN", "SECRETARIA"]),
  asistenciaController.obtenerResumenAsistenciaPersonal,
);
router.get(
  "/personal/dni/:dni",
  checkRole(["ADMIN", "SECRETARIA"]),
  asistenciaController.buscarPersonalPorDni,
);
router.post(
  "/personal/marcar",
  checkRole(["ADMIN", "SECRETARIA"]),
  asistenciaController.registrarAsistenciaPersonal,
);

// ============================================================
// REGISTROS (solo DOCENTE y ADMIN)
// ============================================================
router.post(
  "/",
  checkRole(["ADMIN", "DOCENTE"]),
  checkCursoDocente,
  asistenciaController.registrar,
);
router.post(
  "/masivo",
  checkRole(["ADMIN", "DOCENTE"]),
  checkCursosDocenteBody,
  asistenciaController.registrarMasivo,
);

module.exports = router;
