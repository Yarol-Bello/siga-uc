/**
 * Rutas de Tesorería
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const tesoreriaController = require("../controllers/tesoreriaController");
const {
  verificarAutenticacion,
} = require("../middlewares/authMiddleware");
const { checkRole } = require("../middlewares/authRoles");

const router = express.Router();

// Todas las rutas requieren autenticación y roles ADMIN/SECRETARIA
router.use(verificarAutenticacion);
router.use(checkRole(["ADMIN", "SECRETARIA"]));

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
  tesoreriaController.crearPreTicket,
);

// ============================================================
// PAGOS
// ============================================================
router.get("/pagos", tesoreriaController.listarPagos);
router.get("/pagos/:id", tesoreriaController.obtenerPago);
router.put("/pagos/:id/anular", tesoreriaController.anularPago);
router.get("/boletas/:id_pago/pdf", tesoreriaController.getBoletaPdf);
router.post(
  "/pagos",
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
  tesoreriaController.generarPensionesMes,
);

// ============================================================
// BECAS
// ============================================================
router.get("/becas", tesoreriaController.listarBecas);
router.post("/becas", checkRole(["ADMIN"]), tesoreriaController.aplicarBeca);

// ============================================================
// ESTADÍSTICAS
// ============================================================
router.get("/estadisticas", tesoreriaController.getEstadisticas);

module.exports = router;
