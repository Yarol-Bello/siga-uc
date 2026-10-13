/**
 * Rutas de Caja
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const cajaController = require("../controllers/cajaController");
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
  verificarRol("ADMIN", "SECRETARIA"),
  cajaController.aperturar,
);
router.post(
  "/egresos",
  verificarRol("ADMIN", "SECRETARIA"),
  cajaController.registrarEgreso,
);
router.post(
  "/cerrar",
  verificarRol("ADMIN", "SECRETARIA"),
  cajaController.cerrar,
);

module.exports = router;
