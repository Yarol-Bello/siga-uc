/**
 * Rutas de Exportación SIAGIE
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const siagieController = require("../controllers/siagieController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Configurar multer para guardar archivos temporales
const uploadsDir = path.join(__dirname, "..", "..", "uploads", "temp");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `plantilla-${timestamp}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const permitidos = [".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (permitidos.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos .xlsx o .xls"));
    }
  },
});

// Todas las rutas requieren autenticación
router.use(verificarAutenticacion);

/**
 * @route   POST /api/siagie/generar-excel
 * @desc    Genera Excel SIAGIE con notas inyectadas
 * @access  Privado (ADMIN)
 */
router.post(
  "/generar-excel",
  verificarRol("ADMIN"),
  upload.single("plantilla"),
  siagieController.generarExcel,
);

module.exports = router;
