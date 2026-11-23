/**
 * Rutas de Reportes
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const reporteController = require("../controllers/reporteController");
const {
  verificarAutenticacion,
} = require("../middlewares/authMiddleware");
const {
  checkRole,
  checkAlumnoPropio,
  checkGradoDocente,
} = require("../middlewares/authRoles");

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarAutenticacion);

// Dashboard (solo ADMIN y SECRETARIA)
router.get(
  "/dashboard",
  checkRole(["ADMIN", "SECRETARIA"]),
  reporteController.getDashboard,
);

// Reportes académicos
router.get(
  "/cuadro-merito/:id_grado",
  checkRole(["ADMIN", "DOCENTE"]),
  checkGradoDocente,
  reporteController.getCuadroMerito,
);
router.get(
  "/alumnos-riesgo/:id_grado",
  checkRole(["ADMIN", "DOCENTE"]),
  checkGradoDocente,
  reporteController.getAlumnosRiesgo,
);
router.get(
  "/resumen-asistencia/:id_grado",
  checkRole(["ADMIN", "DOCENTE"]),
  checkGradoDocente,
  reporteController.getResumenAsistencia,
);

// Consolidado histórico por DNI (ADMIN y SECRETARIA, Fase 6.4)
router.get(
  "/consolidado/:dni",
  checkRole(["ADMIN", "SECRETARIA"]),
  reporteController.getConsolidado,
);

// Libreta (ADMIN, DOCENTE o el propio ESTUDIANTE)
router.get(
  "/libreta/:id_alumno/pdf",
  checkRole(["ADMIN", "DOCENTE", "ESTUDIANTE"]),
  checkAlumnoPropio,
  reporteController.getLibretaPdf,
);
router.get(
  "/libreta/:id_alumno",
  checkRole(["ADMIN", "DOCENTE", "ESTUDIANTE"]),
  checkAlumnoPropio,
  reporteController.getLibreta,
);

// Auditoría de docentes (para SIAGIE)
router.get(
  "/auditoria-docentes/:id_grado",
  checkRole(["ADMIN"]),
  reporteController.getAuditoriaDocentes,
);

module.exports = router;
