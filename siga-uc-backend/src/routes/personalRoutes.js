/**
 * Rutas de Personal y Usuarios
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const personalController = require("../controllers/personalController");
const {
  verificarAutenticacion,
} = require("../middlewares/authMiddleware");
const { checkRole } = require("../middlewares/authRoles");

const router = express.Router();

// Todas las rutas requieren autenticación y rol ADMIN
router.use(verificarAutenticacion);
router.use(checkRole(["ADMIN"]));

// ============================================================
// CONSULTAS
// ============================================================
router.get("/", personalController.listar);
router.get("/roles", personalController.listarRoles);
router.get("/:id", personalController.obtener);

// ============================================================
// MODIFICACIONES (solo ADMIN)
// ============================================================
router.post("/", personalController.crear);
router.put("/:id", personalController.actualizar);
router.put("/:id/cesar", personalController.cesar);
router.put("/:id/reactivar", personalController.reactivar);
router.put("/:id/reset-password", personalController.resetPassword);

module.exports = router;
