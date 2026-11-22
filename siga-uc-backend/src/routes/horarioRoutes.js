/**
 * Rutas de horarios (H47)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const { body, param } = require("express-validator");
const horarioController = require("../controllers/horarioController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");
const { DIAS_SEMANA, TIPOS_PERIODO } = require("../config/horarios");

const router = express.Router();

router.use(verificarAutenticacion);

const idParam = [
  param("id").isInt({ min: 1 }).withMessage("ID inválido"),
];

const periodoBody = [
  body("anio_lectivo")
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage("Año lectivo inválido"),
  body("anio")
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage("Año lectivo inválido"),
  body("nombre")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Nombre obligatorio")
    .isLength({ max: 30 })
    .withMessage("Máximo 30 caracteres"),
  body("orden")
    .optional()
    .isInt({ min: 1 })
    .withMessage("El orden debe ser un entero mayor que cero"),
  body("hora_inicio")
    .optional()
    .matches(/^\d{2}:\d{2}(:\d{2})?$/)
    .withMessage("Hora de inicio inválida"),
  body("hora_fin")
    .optional()
    .matches(/^\d{2}:\d{2}(:\d{2})?$/)
    .withMessage("Hora de fin inválida"),
  body("tipo")
    .optional()
    .isIn([...TIPOS_PERIODO])
    .withMessage("Tipo inválido"),
  body("activo").optional().isBoolean().withMessage("Activo debe ser booleano"),
];

const crearPeriodoBody = [
  body("anio_lectivo")
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage("Año lectivo inválido"),
  body("anio")
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage("Año lectivo inválido"),
  body("nombre")
    .trim()
    .notEmpty()
    .withMessage("Nombre obligatorio")
    .isLength({ max: 30 })
    .withMessage("Máximo 30 caracteres"),
  body("orden")
    .isInt({ min: 1 })
    .withMessage("El orden debe ser un entero mayor que cero"),
  body("hora_inicio")
    .matches(/^\d{2}:\d{2}(:\d{2})?$/)
    .withMessage("Hora de inicio inválida"),
  body("hora_fin")
    .matches(/^\d{2}:\d{2}(:\d{2})?$/)
    .withMessage("Hora de fin inválida"),
  body("tipo").isIn([...TIPOS_PERIODO]).withMessage("Tipo inválido"),
  body("activo").optional().isBoolean().withMessage("Activo debe ser booleano"),
];

const crearBloqueBody = [
  body("id_carga").isInt({ min: 1 }).withMessage("Carga inválida"),
  body("dia_semana")
    .isIn([...DIAS_SEMANA])
    .withMessage("Día inválido"),
  body("id_periodo").isInt({ min: 1 }).withMessage("Período inválido"),
  body("aula")
    .optional({ nullable: true })
    .isLength({ max: 50 })
    .withMessage("El aula no puede superar los 50 caracteres"),
  body("confirmar").optional().isBoolean().withMessage("Confirmar inválido"),
];

const actualizarBloqueBody = [
  body("id_carga").optional().isInt({ min: 1 }).withMessage("Carga inválida"),
  body("dia_semana")
    .optional()
    .isIn([...DIAS_SEMANA])
    .withMessage("Día inválido"),
  body("id_periodo")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Período inválido"),
  body("aula")
    .optional({ nullable: true })
    .isLength({ max: 50 })
    .withMessage("El aula no puede superar los 50 caracteres"),
  body("confirmar").optional().isBoolean().withMessage("Confirmar inválido"),
];

// ------------------------------------------------------------
// Períodos de clase (malla horaria)
// ------------------------------------------------------------
router.get("/periodos", horarioController.listarPeriodos);
router.post(
  "/periodos",
  verificarRol("ADMIN"),
  crearPeriodoBody,
  horarioController.crearPeriodo,
);
router.put(
  "/periodos/:id",
  verificarRol("ADMIN"),
  idParam,
  periodoBody,
  horarioController.actualizarPeriodo,
);
router.delete(
  "/periodos/:id",
  verificarRol("ADMIN"),
  idParam,
  horarioController.eliminarPeriodo,
);

// ------------------------------------------------------------
// Horario personal: sin IDs en la URL
// ------------------------------------------------------------
router.get("/mi-horario", horarioController.miHorario);

// ------------------------------------------------------------
// Listado administrativo
// ------------------------------------------------------------
router.get(
  "/",
  verificarRol("ADMIN", "SECRETARIA"),
  horarioController.listar,
);

// ------------------------------------------------------------
// Generación automática
// ------------------------------------------------------------
router.post(
  "/generar",
  verificarRol("ADMIN"),
  [
    body("anio")
      .isInt({ min: 2000, max: 2100 })
      .withMessage("Año lectivo inválido"),
    body("id_grado")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Grado inválido"),
    body("seed")
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage("La semilla debe ser un entero mayor que cero"),
    body("forzar")
      .optional()
      .isBoolean()
      .withMessage("forzar debe ser booleano"),
  ],
  horarioController.generar,
);

// ------------------------------------------------------------
// Publicación
// ------------------------------------------------------------
router.post(
  "/publicar",
  verificarRol("ADMIN"),
  [
    body("anio")
      .isInt({ min: 2000, max: 2100 })
      .withMessage("Año lectivo inválido"),
    body("id_grado")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Grado inválido"),
    body("permitir_parcial")
      .optional()
      .isBoolean()
      .withMessage("permitir_parcial inválido"),
  ],
  horarioController.publicar,
);

router.post(
  "/despublicar",
  verificarRol("ADMIN"),
  [
    body("anio")
      .isInt({ min: 2000, max: 2100 })
      .withMessage("Año lectivo inválido"),
    body("id_grado")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Grado inválido"),
  ],
  horarioController.despublicar,
);

// ------------------------------------------------------------
// CRUD de bloques (solo ADMIN)
// ------------------------------------------------------------
router.post(
  "/",
  verificarRol("ADMIN"),
  crearBloqueBody,
  horarioController.crear,
);
router.put(
  "/:id",
  verificarRol("ADMIN"),
  idParam,
  actualizarBloqueBody,
  horarioController.actualizar,
);
router.delete(
  "/:id",
  verificarRol("ADMIN"),
  idParam,
  [
    body("confirmar")
      .optional()
      .isBoolean()
      .withMessage("Confirmar inválido"),
  ],
  horarioController.eliminar,
);

module.exports = router;
