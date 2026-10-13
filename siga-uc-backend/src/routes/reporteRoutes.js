/**
 * Rutas de Reportes
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const reporteController = require("../controllers/reporteController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarAutenticacion);

// Dashboard (solo ADMIN y SECRETARIA)
router.get(
  "/dashboard",
  verificarRol("ADMIN", "SECRETARIA"),
  reporteController.getDashboard,
);

// Reportes académicos
router.get(
  "/cuadro-merito/:id_grado",
  verificarRol("ADMIN", "DOCENTE"),
  reporteController.getCuadroMerito,
);
router.get(
  "/alumnos-riesgo/:id_grado",
  verificarRol("ADMIN", "DOCENTE"),
  reporteController.getAlumnosRiesgo,
);
router.get(
  "/resumen-asistencia/:id_grado",
  verificarRol("ADMIN", "DOCENTE"),
  reporteController.getResumenAsistencia,
);

// Libreta (accesible por ADMIN, DOCENTE y el propio ESTUDIANTE)
router.get("/libreta/:id_alumno", reporteController.getLibreta);

module.exports = router;
