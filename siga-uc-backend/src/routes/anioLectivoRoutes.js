/**
 * Rutas de años lectivos y rollover anual (H49 / Fase 6.2 / 6.4)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Lectura: ADMIN y SECRETARIA (selector de año y consulta de históricos).
 * Escritura (preview, rollover, activación y reversión): solo ADMIN.
 */

const express = require("express");
const anioLectivoController = require("../controllers/anioLectivoController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(verificarAutenticacion);

// Rutas fijas antes de las paramétricas.
router.get("/", verificarRol("ADMIN", "SECRETARIA"), anioLectivoController.listar);

router.post("/preview", verificarRol("ADMIN"), anioLectivoController.preview);
router.post("/rollover", verificarRol("ADMIN"), anioLectivoController.rollover);

router.put(
  "/:anio/activar",
  verificarRol("ADMIN"),
  anioLectivoController.activar,
);
router.delete(
  "/:anio/rollover",
  verificarRol("ADMIN"),
  anioLectivoController.revertirRollover,
);

module.exports = router;
