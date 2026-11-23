/**
 * Controlador de Personal y Usuarios
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const personalService = require("../services/personalService");
const auditoriaService = require("../services/auditoriaService");
const response = require("../utils/response");

const listar = async (req, res) => {
  try {
    const filtros = {
      id_rol: req.query.id_rol ? parseInt(req.query.id_rol) : null,
      estado: req.query.estado || null,
      search: req.query.search || null,
    };

    if (req.query.page !== undefined) {
      const resultado = await personalService.listarPaginado({
        ...filtros,
        page: req.query.page,
        pageSize: req.query.pageSize || 20,
      });
      return response.success(
        res,
        200,
        `Se encontraron ${resultado.total} trabajadores`,
        {
          data: resultado.data,
          pagination: {
            page: resultado.page,
            pageSize: resultado.pageSize,
            total: resultado.total,
            totalPages:
              resultado.total > 0
                ? Math.ceil(resultado.total / resultado.pageSize)
                : 0,
          },
        },
      );
    }

    const data = await personalService.listar(filtros);
    return response.success(
      res,
      200,
      `Se encontraron ${data.length} trabajadores`,
      data,
    );
  } catch (error) {
    console.error("❌ Error al listar personal:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const obtener = async (req, res) => {
  try {
    const data = await personalService.obtener(req.params.id);
    return response.success(res, 200, "Personal obtenido", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const listarRoles = async (req, res) => {
  try {
    const data = await personalService.listarRoles();
    return response.success(res, 200, "Roles obtenidos", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const crear = async (req, res) => {
  try {
    const data = await personalService.crear(req.body);

    await auditoriaService.registrarSeguro(req, {
      modulo: "Personal",
      accion: "CREAR",
      descripcion: `Alta de personal DNI ${data.dni} - ${data.nombre_completo} - rol ${req.body.id_rol}`,
      nuevo: {
        id_personal: data.id_personal,
        dni: data.dni,
        nombre_completo: data.nombre_completo,
        rol: Number(req.body.id_rol) || null,
      },
    });

    return response.success(res, 201, "Personal registrado exitosamente", data);
  } catch (error) {
    console.error("❌ Error al crear personal:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const actualizar = async (req, res) => {
  try {
    const anterior = await personalService.obtener(req.params.id);
    const data = await personalService.actualizar(req.params.id, req.body);

    const cambioRol =
      Number(anterior.id_rol) !== Number(data.id_rol)
        ? {
            anterior: {
              id_rol: anterior.id_rol,
              rol: anterior.nombre_rol,
            },
            nuevo: {
              id_rol: data.id_rol,
              rol: data.nombre_rol,
            },
          }
        : {};

    await auditoriaService.registrarSeguro(req, {
      modulo: "Personal",
      accion: "MODIFICAR",
      descripcion: `Edición de personal DNI ${data.dni}`,
      ...cambioRol,
    });

    return response.success(res, 200, "Personal actualizado", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const cesar = async (req, res) => {
  try {
    const anterior = await personalService.obtener(req.params.id);
    const data = await personalService.cesar(req.params.id, req.body);

    await auditoriaService.registrarSeguro(req, {
      modulo: "Personal",
      accion: "CESAR",
      descripcion: `Cese de personal DNI ${data.dni} - motivo: ${req.body.motivo_cese}`,
      anterior: { estado: anterior.estado },
      nuevo: {
        estado: "CESADO",
        motivo: req.body.motivo_cese,
        observaciones: data.observaciones || null,
      },
    });

    return response.success(res, 200, "Cese registrado exitosamente", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const reactivar = async (req, res) => {
  try {
    const data = await personalService.reactivar(req.params.id);
    return response.success(res, 200, "Trabajador reactivado", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const resetPassword = async (req, res) => {
  try {
    const {
      dni,
      id_usuario_afectado,
      ...data
    } = await personalService.resetPassword(req.params.id);

    await auditoriaService.registrarSeguro(req, {
      modulo: "Seguridad",
      accion: "RESET_PASSWORD",
      descripcion: `Reset de contraseña por administrador para DNI ${dni}`,
      nuevo: {
        dni,
        id_usuario_afectado,
      },
    });

    return response.success(res, 200, "Contraseña restablecida", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  listar,
  obtener,
  listarRoles,
  crear,
  actualizar,
  cesar,
  reactivar,
  resetPassword,
};
