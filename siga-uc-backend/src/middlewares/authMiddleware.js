/**
 * Middleware de autenticación JWT
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const authService = require("../services/authService");
const autorizacionDao = require("../dao/autorizacionDao");
const { getAnioLectivo } = require("../config/academico");
const response = require("../utils/response");

// Rutas permitidas mientras el usuario debe cambiar su contraseña.
const RUTAS_PERMITIDAS_CAMBIO_PASSWORD = new Set([
  "/api/auth/cambiar-password",
  "/api/auth/logout",
  "/api/auth/perfil",
  "/api/auth/verify",
]);

/**
 * Verificar que el usuario esté autenticado (JWT válido + estado activo).
 */
const verificarAutenticacion = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return response.unauthorized(res, "Token no proporcionado");
    }

    // Formato esperado: "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return response.unauthorized(res, "Formato de token inválido");
    }

    const token = parts[1];

    // Verificar y decodificar token
    const decoded = authService.verificarToken(token);

    // Revalidar estado y obtener contexto (id_personal / id_alumno)
    const contexto = await autorizacionDao.getContextoUsuario(
      decoded.id_usuario,
      getAnioLectivo(),
    );

    if (!contexto || contexto.estado !== "ACTIVO") {
      return response.unauthorized(
        res,
        "Sesión inválida o usuario inactivo. Inicie sesión nuevamente.",
      );
    }

    req.usuario = { ...decoded, ...contexto };

    // Si el usuario tiene una contraseña temporal, solo puede cambiarla
    // (y consultar su perfil o cerrar sesión) hasta que la actualice.
    if (contexto.requiere_cambio_password) {
      const rutaActual = (req.originalUrl || "").split("?")[0].replace(/\/+$/, "");

      if (!RUTAS_PERMITIDAS_CAMBIO_PASSWORD.has(rutaActual)) {
        return response.error(
          res,
          403,
          "Debe cambiar su contraseña antes de continuar.",
          { codigo: "CAMBIO_PASSWORD_REQUERIDO" },
        );
      }
    }

    next();
  } catch (error) {
    if (error.statusCode) {
      return response.error(res, error.statusCode, error.message);
    }
    console.error("❌ Error en autenticación:", error);
    return response.error(res, 500, "Error interno del servidor");
  }
};

/**
 * Verificar que el usuario tenga uno de los roles permitidos
 * @param {string[]} rolesPermitidos - Lista de roles permitidos
 */
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return response.unauthorized(res, "Usuario no autenticado");
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return response.forbidden(
        res,
        `Acceso denegado. Se requiere uno de estos roles: ${rolesPermitidos.join(", ")}`,
      );
    }

    next();
  };
};

module.exports = {
  verificarAutenticacion,
  verificarRol,
};
