/**
 * Rutas de Configuración del Sistema (Fase 1 / H74)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const configuracionController = require("../controllers/configuracionController");
const {
  verificarAutenticacion,
} = require("../middlewares/authMiddleware");
const { checkRole } = require("../middlewares/authRoles");

const router = express.Router();

/**
 * @route   GET /api/configuracion
 * @desc    Configuración pública segura (año activo e institución visible)
 * @access  Público
 */
router.get("/", configuracionController.obtenerPublica);

/**
 * @route   GET /api/configuracion/admin
 * @desc    Configuración completa (institución y años)
 * @access  ADMIN/SECRETARIA
 */
router.get(
  "/admin",
  verificarAutenticacion,
  checkRole(["ADMIN", "SECRETARIA"]),
  configuracionController.obtenerAdmin,
);

/**
 * @route   GET /api/configuracion/tarifas
 * @desc    Tarifas y conceptos del año
 * @access  ADMIN/SECRETARIA
 */
router.get(
  "/tarifas",
  verificarAutenticacion,
  checkRole(["ADMIN", "SECRETARIA"]),
  configuracionController.listarTarifas,
);

/**
 * @route   POST /api/configuracion/tarifas/preview
 * @desc    Vista previa de impacto de una tarifa
 * @access  ADMIN
 */
router.post(
  "/tarifas/preview",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.previewTarifa,
);

/**
 * @route   POST /api/configuracion/tarifas
 * @desc    Crea una tarifa con preview_hash y motivo
 * @access  ADMIN
 */
router.post(
  "/tarifas",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.crearTarifa,
);

/**
 * @route   POST /api/configuracion/tarifas/:id/version
 * @desc    Programa una nueva versión de una tarifa existente
 * @access  ADMIN
 */
router.post(
  "/tarifas/:id/version",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.programarVersionTarifa,
);

/**
 * @route   GET /api/configuracion/tarifas/:id
 * @desc    Detalle de una tarifa
 * @access  ADMIN/SECRETARIA
 */
router.get(
  "/tarifas/:id",
  verificarAutenticacion,
  checkRole(["ADMIN", "SECRETARIA"]),
  configuracionController.obtenerTarifa,
);

/**
 * @route   PUT /api/configuracion/tarifas/:id
 * @desc    Edita una tarifa sin dependencias
 * @access  ADMIN
 */
router.put(
  "/tarifas/:id",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.actualizarTarifa,
);

/**
 * @route   PUT /api/configuracion/tarifas/:id/desactivar
 * @desc    Desactiva una tarifa
 * @access  ADMIN
 */
router.put(
  "/tarifas/:id/desactivar",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.desactivarTarifa,
);

/**
 * @route   GET /api/configuracion/academico/areas
 * @desc    Catálogo de áreas académicas
 * @access  ADMIN/SECRETARIA
 */
router.get(
  "/academico/areas",
  verificarAutenticacion,
  checkRole(["ADMIN", "SECRETARIA"]),
  configuracionController.listarAreas,
);

router.post(
  "/academico/areas",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.crearArea,
);

router.put(
  "/academico/areas/:id",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.actualizarArea,
);

router.delete(
  "/academico/areas/:id",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.eliminarArea,
);

/**
 * @route   GET /api/configuracion/academico/cursos
 * @desc    Catálogo de cursos, incluidos inactivos
 * @access  ADMIN/SECRETARIA
 */
router.get(
  "/academico/cursos",
  verificarAutenticacion,
  checkRole(["ADMIN", "SECRETARIA"]),
  configuracionController.listarCursosAdmin,
);

router.post(
  "/academico/cursos",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.crearCurso,
);

router.put(
  "/academico/cursos/:id",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.actualizarCurso,
);

router.delete(
  "/academico/cursos/:id",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.eliminarCurso,
);

/**
 * @route   GET /api/configuracion/academico/cursos/:idCurso/competencias
 * @desc    Competencias del curso, incluidas inactivas
 * @access  ADMIN/SECRETARIA
 */
router.get(
  "/academico/cursos/:idCurso/competencias",
  verificarAutenticacion,
  checkRole(["ADMIN", "SECRETARIA"]),
  configuracionController.listarCompetenciasAdmin,
);

router.post(
  "/academico/cursos/:idCurso/competencias",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.crearCompetencia,
);

router.put(
  "/academico/competencias/:id",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.actualizarCompetencia,
);

router.delete(
  "/academico/competencias/:id",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.eliminarCompetencia,
);

/**
 * @route   GET /api/configuracion/horarios/:anio
 * @desc    Jornada, días y límites del año
 * @access  Autenticado
 */
router.get(
  "/horarios/:anio",
  verificarAutenticacion,
  configuracionController.obtenerHorarioAnio,
);

/**
 * @route   PUT /api/configuracion/horarios/:anio
 * @desc    Actualiza jornada, días y límites del año
 * @access  ADMIN
 */
router.put(
  "/horarios/:anio",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.actualizarHorarioAnio,
);

/**
 * @route   GET /api/configuracion/becas/tipos
 * @desc    Catálogo de tipos de beca
 * @access  ADMIN/SECRETARIA
 */
router.get(
  "/becas/tipos",
  verificarAutenticacion,
  checkRole(["ADMIN", "SECRETARIA"]),
  configuracionController.listarTiposBeca,
);

/**
 * @route   POST /api/configuracion/becas/tipos
 * @desc    Crea un tipo de beca
 * @access  ADMIN
 */
router.post(
  "/becas/tipos",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.crearTipoBeca,
);

/**
 * @route   PUT /api/configuracion/becas/tipos/:id
 * @desc    Edita un tipo de beca
 * @access  ADMIN
 */
router.put(
  "/becas/tipos/:id",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.actualizarTipoBeca,
);

/**
 * @route   GET /api/configuracion/becas
 * @desc    Beca-asignación por alumno y año
 * @access  ADMIN/SECRETARIA
 */
router.get(
  "/becas",
  verificarAutenticacion,
  checkRole(["ADMIN", "SECRETARIA"]),
  configuracionController.listarBecas,
);

/**
 * @route   POST /api/configuracion/becas/preview
 * @desc    Calcula el descuento de las becas vigentes
 * @access  ADMIN
 */
router.post(
  "/becas/preview",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.previewBeca,
);

/**
 * @route   POST /api/configuracion/becas
 * @desc    Registra una beca para un alumno
 * @access  ADMIN
 */
router.post(
  "/becas",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.crearBeca,
);

/**
 * @route   PUT /api/configuracion/becas/:id
 * @desc    Edita una beca sin aplicaciones
 * @access  ADMIN
 */
router.put(
  "/becas/:id",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.actualizarBeca,
);

router.put(
  "/becas/:id/aprobar",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.aprobarBeca,
);

router.put(
  "/becas/:id/rechazar",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.rechazarBeca,
);

router.put(
  "/becas/:id/anular",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.anularBeca,
);

/**
 * @route   PUT /api/configuracion/institucional
 * @desc    Actualiza la configuración institucional global
 * @access  ADMIN
 */
router.put(
  "/institucional",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.actualizarInstitucional,
);

module.exports = router;
