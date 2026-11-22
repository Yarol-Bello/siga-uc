/**
 * Rutas de años lectivos y rollover anual (H49 / Fase 6.2)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Todas las rutas son solo ADMIN.
 */

const express = require("express");
const anioLectivoController = require("../controllers/anioLectivoController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(verificarAutenticacion);
router.use(verificarRol("ADMIN"));

// Rutas fijas antes de las paramétricas.
router.get("/", anioLectivoController.listar);
router.post("/preview", anioLectivoController.preview);
router.post("/rollover", anioLectivoController.rollover);

router.put("/:anio/activar", anioLectivoController.activar);
router.delete("/:anio/rollover", anioLectivoController.revertirRollover);

module.exports = router;
