/**
 * Rate limiting para endpoints sensibles de autenticación.
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const moduloRateLimit = require("express-rate-limit");
const response = require("../utils/response");

const rateLimit =
  typeof moduloRateLimit === "function"
    ? moduloRateLimit
    : moduloRateLimit.rateLimit;

const crearHandler = () => (req, res) => {
  return response.error(
    res,
    429,
    "Demasiados intentos. Intente nuevamente en 15 minutos.",
  );
};

const crearLimiter = (opciones = {}) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: crearHandler(),
    ...opciones,
  });

const loginLimiter = crearLimiter({ skipSuccessfulRequests: true });

const recoveryLimiter = crearLimiter();

const tokenValidationLimiter = crearLimiter();

module.exports = {
  loginLimiter,
  recoveryLimiter,
  tokenValidationLimiter,
};
