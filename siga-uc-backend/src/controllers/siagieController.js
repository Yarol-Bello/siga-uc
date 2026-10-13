/**
 * Controlador de Exportación SIAGIE
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const path = require("path");
const fs = require("fs");
const siagieService = require("../services/siagieService");
const response = require("../utils/response");

/**
 * POST /api/siagie/generar-excel
 * Recibe la plantilla .xlsx + datos del grado/bimestre
 * y devuelve un archivo Excel con las notas inyectadas.
 */
const generarExcel = async (req, res) => {
  try {
    // 1. Verificar que se subió el archivo
    if (!req.file) {
      return response.error(
        res,
        400,
        "Debe subir la plantilla Excel del SIAGIE",
      );
    }

    const { id_grado, bimestre, anio_lectivo } = req.body;

    if (!id_grado || !bimestre) {
      return response.error(res, 400, "Faltan parámetros: id_grado, bimestre");
    }

    // 2. Generar el Excel
    const resultado = await siagieService.generarExcel({
      id_grado: parseInt(id_grado),
      bimestre: parseInt(bimestre),
      anio_lectivo: parseInt(anio_lectivo) || 2026,
      archivo_plantilla: req.file.path,
      id_usuario: req.usuario.id_usuario,
    });

    // 3. Eliminar el archivo temporal subido
    fs.unlink(req.file.path, () => {});

    // 4. Devolver el archivo generado como descarga
    res.download(resultado.ruta, resultado.nombre_archivo, (err) => {
      if (err) {
        console.error("❌ Error al enviar archivo:", err);
      }
    });
  } catch (error) {
    console.error("❌ Error en generar Excel SIAGIE:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  generarExcel,
};
