/**
 * Controlador de Auditoría y Actas
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const auditoriaService = require("../services/auditoriaService");
const actaPdfService = require("../services/actaPdfService");
const response = require("../utils/response");
const listarBitacora = async (req, res) => {
  try {
    const filtros = {
      modulo: req.query.modulo || null,
      accion: req.query.accion || null,
      id_usuario: req.query.id_usuario ? parseInt(req.query.id_usuario) : null,
      desde: req.query.desde || null,
      hasta: req.query.hasta || null,
      search: req.query.search || null,
    };

    const pageSolicitada = parseInt(req.query.page, 10);
    const pageSizeSolicitada = parseInt(req.query.pageSize, 10);

    if (Number.isInteger(pageSolicitada) && pageSolicitada > 0) {
      const pageSize = Math.min(
        Math.max(Number.isInteger(pageSizeSolicitada) ? pageSizeSolicitada : 20, 1),
        100,
      );

      const total = await auditoriaService.contarBitacora(filtros);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(pageSolicitada, totalPages);

      const data = await auditoriaService.listarBitacora({
        ...filtros,
        page,
        pageSize,
      });

      return response.success(
        res,
        200,
        `${data.length} de ${total} registros de auditoría`,
        data,
        { total, page, pageSize, totalPages },
      );
    }

    const data = await auditoriaService.listarBitacora(filtros);
    return response.success(
      res,
      200,
      `${data.length} registros de auditoría`,
      data,
    );
  } catch (error) {
    console.error("❌ Error al listar bitácora:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtenerBitacora = async (req, res) => {
  try {
    const data = await auditoriaService.obtenerBitacora(req.params.id);
    return response.success(res, 200, "Registro obtenido", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarModulos = async (req, res) => {
  try {
    const data = await auditoriaService.listarModulos();
    return response.success(res, 200, "Módulos obtenidos", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarActas = async (req, res) => {
  try {
    const data = await auditoriaService.listarActas();
    return response.success(res, 200, `${data.length} actas`, data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/auditoria/actas/:id_acta/pdf
 * Genera y descarga el acta de cierre con la matriz real de notas.
 */
const getActaPdf = async (req, res) => {
  try {
    const data = await auditoriaService.obtenerActa(req.params.id_acta);
    const buffer = await actaPdfService.generarActaPdf(data);

    await auditoriaService.registrarSeguro(req, {
      modulo: "Reportes",
      accion: "DESCARGAR",
      descripcion: `Descarga de acta #${data.id_acta}`,
      nuevo: { id_acta: data.id_acta },
    });

    const periodo = String(data.periodo || "acta").replace(
      /[^0-9A-Za-z]+/g,
      "_",
    );
    const fileName = `acta_${data.id_acta}_${periodo}_${data.anio_lectivo}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");

    return res.send(buffer);
  } catch (error) {
    console.error("❌ Error al generar PDF de acta:", error.message);
    return response.error(
      res,
      error.statusCode || 500,
      error.statusCode ? error.message : "No se pudo generar el acta en PDF",
    );
  }
};

const cerrarActa = async (req, res) => {
  try {
    const data = await auditoriaService.cerrarActa({
      ...req.body,
      cerrado_por: req.usuario.id_usuario,
    });

    await auditoriaService.registrarSeguro(req, {
      modulo: "Evaluaciones",
      accion: "CERRAR",
      descripcion: `Cierre de acta ${data.periodo} - ${data.anio_lectivo}`,
      nuevo: {
        id_acta: data.id_acta,
        periodo: data.periodo,
        grado: data.id_grado,
        anio_lectivo: data.anio_lectivo,
      },
    });

    return response.success(
      res,
      200,
      "Acta cerrada y firmada digitalmente",
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getEstadisticas = async (req, res) => {
  try {
    const data = await auditoriaService.getEstadisticas();
    return response.success(res, 200, "Estadísticas de auditoría", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  listarBitacora,
  obtenerBitacora,
  listarModulos,
  listarActas,
  getActaPdf,
  cerrarActa,
  getEstadisticas,
};
