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

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: crearHandler(),
});

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: crearHandler(),
});

module.exports = {
  loginLimiter,
  recoveryLimiter,
};
