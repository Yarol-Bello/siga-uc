/**
 * Rutas de Tesorería
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const tesoreriaController = require("../controllers/tesoreriaController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarAutenticacion);

// ============================================================
// CONCEPTOS
// ============================================================
router.get("/conceptos", tesoreriaController.listarConceptos);

// ============================================================
// PRE-TICKETS
// ============================================================
router.get("/pre-tickets", tesoreriaController.listarPreTickets);
router.get("/pre-tickets/:id", tesoreriaController.obtenerPreTicket);
router.post(
  "/pre-tickets",
  verificarRol("ADMIN", "SECRETARIA"),
  tesoreriaController.crearPreTicket,
);

// ============================================================
// PAGOS
// ============================================================
router.get("/pagos", tesoreriaController.listarPagos);
router.get("/pagos/:id", tesoreriaController.obtenerPago);
router.post(
  "/pagos",
  verificarRol("ADMIN", "SECRETARIA"),
  tesoreriaController.registrarPago,
);

// ============================================================
// PENSIONES
// ============================================================
router.get(
  "/pensiones/alumno/:id_alumno",
  tesoreriaController.listarPensionesAlumno,
);
router.post(
  "/pensiones/generar",
  verificarRol("ADMIN", "SECRETARIA"),
  tesoreriaController.generarPensionesMes,
);

// ============================================================
// BECAS
// ============================================================
router.get("/becas", tesoreriaController.listarBecas);
router.post("/becas", verificarRol("ADMIN"), tesoreriaController.aplicarBeca);

// ============================================================
// ESTADÍSTICAS
// ============================================================
router.get("/estadisticas", tesoreriaController.getEstadisticas);

module.exports = router;
