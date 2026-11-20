/**
 * Rutas de Caja
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const cajaController = require("../controllers/cajaController");
const {
  verificarAutenticacion,
} = require("../middlewares/authMiddleware");
const { checkRole } = require("../middlewares/authRoles");

const router = express.Router();

// Todas las rutas requieren autenticación y roles ADMIN/SECRETARIA
router.use(verificarAutenticacion);
router.use(checkRole(["ADMIN", "SECRETARIA"]));

// ============================================================
// CONSULTAS
// ============================================================
router.get("/actual", cajaController.obtenerCajaAbierta);
router.get("/cajas", cajaController.listarCajas);
router.get("/aperturas", cajaController.listarAperturas);
router.get("/aperturas/:id", cajaController.obtenerApertura);
router.get("/movimientos/:id_apertura", cajaController.listarMovimientos);
router.get("/cierres", cajaController.listarCierres);

// ============================================================
// OPERACIONES (solo ADMIN y SECRETARIA)
// ============================================================
router.post(
  "/aperturar",
  cajaController.aperturar,
);
router.post(
  "/egresos",
  cajaController.registrarEgreso,
);
router.post(
  "/cerrar",
  cajaController.cerrar,
);

module.exports = router;
