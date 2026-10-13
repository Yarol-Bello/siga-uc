/**
 * Rutas de Carga Curricular
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const cargaCurricularController = require("../controllers/cargaCurricularController");
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
router.get("/", cargaCurricularController.listar);
router.get("/grado/:id", cargaCurricularController.listarPorGrado);
router.get("/grado/:id/tutor", cargaCurricularController.getTutor);
router.get("/docente/:id", cargaCurricularController.listarPorDocente);
router.get("/:id", cargaCurricularController.obtener);

// ============================================================
// MODIFICACIONES (solo ADMIN)
// ============================================================
router.post("/", verificarRol("ADMIN"), cargaCurricularController.crear);
router.post(
  "/tutor",
  verificarRol("ADMIN"),
  cargaCurricularController.asignarTutor,
);
router.put("/:id", verificarRol("ADMIN"), cargaCurricularController.actualizar);
router.delete(
  "/:id",
  verificarRol("ADMIN"),
  cargaCurricularController.eliminar,
);

module.exports = router;
