/**
 * Utilidades para respuestas HTTP estandarizadas
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const success = (
  res,
  statusCode = 200,
  message = "Operación exitosa",
  data = null,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

const error = (
  res,
  statusCode = 500,
  message = "Error interno del servidor",
  errors = null,
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
  });
};

const validationError = (res, errors) => {
  return res.status(400).json({
    success: false,
    message: "Errores de validación",
    errors,
    timestamp: new Date().toISOString(),
  });
};

const unauthorized = (res, message = "No autorizado") => {
  return res.status(401).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
  });
};

const forbidden = (res, message = "Acceso denegado") => {
  return res.status(403).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
  });
};

const notFound = (res, message = "Recurso no encontrado") => {
  return res.status(404).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  success,
  error,
  validationError,
  unauthorized,
  forbidden,
  notFound,
};
