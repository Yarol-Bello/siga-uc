/**
 * Rutas de gestión académica (grados, cursos, competencias)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const academicoController = require("../controllers/academicoController");
const { verificarAutenticacion } = require("../middlewares/authMiddleware");

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarAutenticacion);

// ============================================================
// GRADOS
// ============================================================
router.get("/grados", academicoController.listarGrados);
router.get("/grados/:id", academicoController.obtenerGrado);

// ============================================================
// CURSOS
// ============================================================
router.get("/cursos", academicoController.listarCursos);
router.get("/cursos/:id", academicoController.obtenerCurso);
router.get("/cursos/:id/competencias", academicoController.listarCompetencias);

// ============================================================
// ESCALA DE CALIFICACIÓN
// ============================================================
router.get(
  "/escala-calificacion",
  academicoController.listarEscalaCalificacion,
);

module.exports = router;
