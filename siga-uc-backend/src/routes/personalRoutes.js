/**
 * Rutas de Personal y Usuarios
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const personalController = require("../controllers/personalController");
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
router.get("/", personalController.listar);
router.get("/roles", personalController.listarRoles);
router.get("/:id", personalController.obtener);

// ============================================================
// MODIFICACIONES (solo ADMIN)
// ============================================================
router.post("/", verificarRol("ADMIN"), personalController.crear);
router.put("/:id", verificarRol("ADMIN"), personalController.actualizar);
router.put("/:id/cesar", verificarRol("ADMIN"), personalController.cesar);
router.put(
  "/:id/reactivar",
  verificarRol("ADMIN"),
  personalController.reactivar,
);
router.put(
  "/:id/reset-password",
  verificarRol("ADMIN"),
  personalController.resetPassword,
);

module.exports = router;
