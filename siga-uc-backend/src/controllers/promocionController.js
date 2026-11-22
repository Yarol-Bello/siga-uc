/**
 * Controlador de promociones anuales (H73 / Fase 6.3)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const promocionService = require("../services/promocionService");
const politicaPromocionService = require("../services/politicaPromocionService");
const auditoriaService = require("../services/auditoriaService");
const response = require("../utils/response");

const MODULO = "Promociones";

const responderError = (res, error) => {
  const status = error?.statusCode || 500;

  if (status >= 500) {
    console.error("❌ Error en promociones:", error?.message || error);
    const message =
      status === 503
        ? error.message
        : "Ocurrió un error interno en el servidor";
    return res.status(status).json({
      success: false,
      message,
      errors: error?.details || null,
      timestamp: new Date().toISOString(),
    });
  }

  return response.error(
    res,
    status,
    error.message || "Error en la operación",
    error.details || null,
  );
};

// ============================================================
// POLÍTICAS
// ============================================================
const listarPoliticas = async (req, res) => {
  try {
    const politicas = await politicaPromocionService.listar(req.query || {});
    return response.success(res, 200, "Políticas obtenidas", politicas);
  } catch (error) {
    return responderError(res, error);
  }
};

const crearPolitica = async (req, res) => {
  try {
    const politica = await politicaPromocionService.crear(
      req.body || {},
      req.usuario?.id_usuario || null,
    );

    await auditoriaService.registrarSeguro(req, {
      modulo: MODULO,
      accion: "CREAR_POLITICA",
      descripcion: `Política de promoción "${politica.nombre}" creada para ${politica.anio_origen}.`,
      nuevo: {
        id_politica: politica.id_politica,
        anio_origen: politica.anio_origen,
        anio_destino: politica.anio_destino,
        nombre: politica.nombre,
        permite_override: politica.permite_override,
      },
    });

    return response.success(res, 201, "Política creada", politica);
  } catch (error) {
    return responderError(res, error);
  }
};

const actualizarPolitica = async (req, res) => {
  try {
    const politica = await politicaPromocionService.actualizar(
      req.params.id,
      req.body || {},
    );

    await auditoriaService.registrarSeguro(req, {
      modulo: MODULO,
      accion: "ACTUALIZAR_POLITICA",
      descripcion: `Política de promoción ${politica.id_politica} actualizada.`,
      nuevo: {
        id_politica: politica.id_politica,
        anio_origen: politica.anio_origen,
        anio_destino: politica.anio_destino,
        nombre: politica.nombre,
        permite_override: politica.permite_override,
      },
    });

    return response.success(res, 200, "Política actualizada", politica);
  } catch (error) {
    return responderError(res, error);
  }
};

// ============================================================
// PREVISUALIZACIÓN
// ============================================================
const preview = async (req, res) => {
  try {
    const data = await promocionService.previsualizar(req.body || {});

    await auditoriaService.registrarSeguro(req, {
      modulo: MODULO,
      accion: "PREVISUALIZAR",
      descripcion: `Previsualización de promoción ${data.anio_origen} → ${data.anio_destino}: ${data.resumen.total} alumno(s), ${data.resumen.bloqueados} bloqueado(s).`,
      nuevo: {
        anio_origen: data.anio_origen,
        anio_destino: data.anio_destino,
        id_politica: data.id_politica,
        id_grado: data.id_grado,
        incluir_retirados: data.incluir_retirados,
        copiar_becas: data.copiar_becas,
        total: data.resumen.total,
        por_resultado: data.resumen.por_resultado,
        bloqueados: data.resumen.bloqueados,
        preview_hash: data.preview_hash,
      },
    });

    return response.success(res, 200, "Previsualización de promoción generada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

// ============================================================
// CONFIRMACIÓN
// ============================================================
const confirmar = async (req, res) => {
  try {
    const data = await promocionService.confirmar(
      req.body || {},
      req.usuario?.id_usuario || null,
    );

    await auditoriaService.registrarSeguro(req, {
      modulo: MODULO,
      accion: "CONFIRMAR",
      descripcion: `Promoción ${data.anio_origen} → ${data.anio_destino}: ${data.creados} promoción(es) confirmada(s).`,
      nuevo: {
        anio_origen: data.anio_origen,
        anio_destino: data.anio_destino,
        ya_confirmada: data.ya_confirmada,
        creados: data.creados,
        conteos: data.conteos,
        promociones: data.promociones.map((promocion) => ({
          id_promocion: promocion.id_promocion,
          resultado: promocion.resultado,
        })),
      },
    });

    return response.success(res, 200, "Promoción confirmada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

// ============================================================
// LISTADO Y DETALLE
// ============================================================
const listar = async (req, res) => {
  try {
    const promociones = await promocionService.listar(req.query || {});
    return response.success(res, 200, "Promociones obtenidas", promociones);
  } catch (error) {
    return responderError(res, error);
  }
};

const obtener = async (req, res) => {
  try {
    const promocion = await promocionService.obtener(req.params.id);
    return response.success(res, 200, "Promoción obtenida", promocion);
  } catch (error) {
    return responderError(res, error);
  }
};

const anular = async (req, res) => {
  try {
    const data = await promocionService.anular(req.params.id, {
      motivo: req.body?.motivo,
      idUsuario: req.usuario?.id_usuario || null,
    });

    await auditoriaService.registrarSeguro(req, {
      modulo: MODULO,
      accion: "ANULAR",
      descripcion: `Promoción ${data.id_promocion} (${data.resultado}) anulada: ${data.motivo}`,
      anterior: {
        id_promocion: data.id_promocion,
        estado: "CONFIRMADA",
        resultado: data.resultado,
      },
      nuevo: {
        id_promocion: data.id_promocion,
        estado: data.estado,
        motivo: data.motivo,
        actividad: data.actividad,
        eliminados: data.eliminados,
      },
    });

    return response.success(res, 200, "Promoción anulada", data);
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = {
  listarPoliticas,
  crearPolitica,
  actualizarPolitica,
  preview,
  confirmar,
  listar,
  obtener,
  anular,
};
