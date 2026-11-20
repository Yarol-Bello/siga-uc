/**
 * Rutas de Auditoría y Actas
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const auditoriaController = require("../controllers/auditoriaController");
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
router.get("/", auditoriaController.listarBitacora);
router.get("/modulos", auditoriaController.listarModulos);
router.get("/estadisticas", auditoriaController.getEstadisticas);
router.get("/actas", auditoriaController.listarActas);
router.get("/:id", auditoriaController.obtenerBitacora);

// ============================================================
// MODIFICACIONES (solo ADMIN)
// ============================================================
router.post(
  "/actas/cerrar",
  auditoriaController.cerrarActa,
);

module.exports = router;
