/**
 * Consultas de autorización para SIGA-UC.
 * Mantiene la lógica de pertenencia en SQL parametrizado.
 */

const { query } = require("../config/database");
const { getAnioLectivo } = require("../config/academico");

const getContextoUsuario = async (
  id_usuario,
  anioLectivo = getAnioLectivo(),
) => {
  const sql = `
    SELECT
      u.id_usuario,
      u.dni,
      u.estado,
      u.requiere_cambio_password,
      p.id_personal,
      a.id_alumno,
      a.anio_lectivo
    FROM usuarios u
    LEFT JOIN personal p ON p.id_usuario = u.id_usuario
    LEFT JOIN alumnos a
      ON a.id_usuario = u.id_usuario
     AND a.anio_lectivo = $2
    WHERE u.id_usuario = $1
    LIMIT 1
  `;
  const result = await query(sql, [id_usuario, anioLectivo]);
  return result.rows[0] || null;
};

const docenteTieneCurso = async (
  id_personal,
  id_curso,
  id_grado = null,
  anio_lectivo = getAnioLectivo(),
) => {
  const params = [id_personal, id_curso, anio_lectivo];
  let filtroGrado = "";

  if (id_grado) {
    params.push(id_grado);
    filtroGrado = "AND cc.id_grado = $4";
  }

  const sql = `
    SELECT 1
    FROM carga_curricular cc
    WHERE cc.id_personal = $1
      AND cc.id_curso = $2
      AND cc.anio_lectivo = $3
      ${filtroGrado}
    LIMIT 1
  `;
  const result = await query(sql, params);
  return result.rows.length > 0;
};

const docenteTieneAlumno = async (
  id_personal,
  id_alumno,
  anioLectivo = getAnioLectivo(),
) => {
  const sql = `
    SELECT 1
    FROM alumnos a
    INNER JOIN carga_curricular cc
      ON cc.id_grado = a.id_grado
     AND cc.anio_lectivo = a.anio_lectivo
    WHERE a.id_alumno = $1
      AND cc.id_personal = $2
      AND a.anio_lectivo = $3
    LIMIT 1
  `;
  const result = await query(sql, [id_alumno, id_personal, anioLectivo]);
  return result.rows.length > 0;
};

const docenteTieneAlumnoPorDni = async (
  id_personal,
  dni,
  anioLectivo = getAnioLectivo(),
) => {
  const sql = `
    SELECT 1
    FROM alumnos a
    INNER JOIN carga_curricular cc
      ON cc.id_grado = a.id_grado
     AND cc.anio_lectivo = a.anio_lectivo
    WHERE a.dni = $1
      AND cc.id_personal = $2
      AND a.anio_lectivo = $3
    LIMIT 1
  `;
  const result = await query(sql, [dni, id_personal, anioLectivo]);
  return result.rows.length > 0;
};

const docenteTieneGrado = async (
  id_personal,
  id_grado,
  anio_lectivo = getAnioLectivo(),
) => {
  const sql = `
    SELECT 1
    FROM carga_curricular cc
    WHERE cc.id_personal = $1
      AND cc.id_grado = $2
      AND cc.anio_lectivo = $3
    LIMIT 1
  `;
  const result = await query(sql, [id_personal, id_grado, anio_lectivo]);
  return result.rows.length > 0;
};

module.exports = {
  getContextoUsuario,
  docenteTieneCurso,
  docenteTieneAlumno,
  docenteTieneAlumnoPorDni,
  docenteTieneGrado,
};
