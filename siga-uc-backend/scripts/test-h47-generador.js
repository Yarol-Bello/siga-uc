/**
 * Pruebas unitarias del generador de horarios H47.
 * No toca la base de datos.
 *
 * Ejecutar: npm run test:h47-generador
 */

const assert = require("node:assert/strict");
const { generarHorario } = require("../src/services/horarioGenerator");

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const PERIODOS = Array.from({ length: 8 }, (_, i) => ({
  id_periodo: i + 1,
  orden: i + 1,
  nombre: `${i + 1}ta hora`,
}));

let pruebas = 0;
const probar = (nombre, fn) => {
  pruebas += 1;
  try {
    fn();
    console.log(`PASS ${pruebas} - ${nombre}`);
  } catch (error) {
    console.error(`FAIL ${pruebas} - ${nombre}: ${error.message}`);
    process.exitCode = 1;
    throw error;
  }
};

const crearCarga = (id, grado, curso, personal, horas) => ({
  id_carga: id,
  id_grado: grado,
  id_curso: curso,
  id_personal: personal,
  horas,
  anio_lectivo: 2026,
  nombre_grado: `Grado ${grado}`,
  seccion: "A",
  nombre_curso: `Curso ${curso}`,
  docente_nombre: `Docente ${personal}`,
});

const sinSolapes = (bloques) => {
  const grado = new Set();
  const docente = new Set();
  for (const bloque of bloques) {
    const claveGrado = `${bloque.id_grado}|${bloque.dia_semana}|${bloque.id_periodo}`;
    const claveDocente = `${bloque.id_personal}|${bloque.dia_semana}|${bloque.id_periodo}`;
    assert.ok(!grado.has(claveGrado), `Solape de grado: ${claveGrado}`);
    assert.ok(!docente.has(claveDocente), `Solape de docente: ${claveDocente}`);
    grado.add(claveGrado);
    docente.add(claveDocente);
  }
};

const fixtureCoherente = () => [
  crearCarga(1, 1, 1, 1, 3),
  crearCarga(2, 1, 2, 2, 3),
  crearCarga(3, 2, 1, 1, 3),
  crearCarga(4, 2, 2, 2, 3),
];

probar("coloca todas las horas de una carga coherente", () => {
  const resultado = generarHorario({
    cargas: fixtureCoherente(),
    periodos: PERIODOS,
    dias: DIAS,
    maxPorCursoDia: 2,
    seed: 42,
  });

  assert.equal(resultado.colocadas.length, 12);
  assert.equal(resultado.sin_ubicar.length, 0);
  sinSolapes(resultado.colocadas);

  const porCursoDia = new Map();
  for (const bloque of resultado.colocadas) {
    const clave = `${bloque.id_grado}|${bloque.id_curso}|${bloque.dia_semana}`;
    porCursoDia.set(clave, (porCursoDia.get(clave) || 0) + 1);
  }
  for (const [clave, total] of porCursoDia) {
    assert.ok(total <= 2, `Más de 2 bloques para ${clave}`);
  }
});

probar("respeta los bloques externos del docente en otro grado", () => {
  const resultado = generarHorario({
    cargas: fixtureCoherente(),
    periodos: PERIODOS,
    dias: DIAS,
    bloquesExternos: [
      { id_personal: 1, dia_semana: "Lunes", id_periodo: 1 },
    ],
    maxPorCursoDia: 2,
    seed: 7,
  });

  assert.equal(resultado.sin_ubicar.length, 0);
  assert.ok(
    !resultado.colocadas.some(
      (bloque) =>
        bloque.id_personal === 1 &&
        bloque.dia_semana === "Lunes" &&
        bloque.id_periodo === 1,
    ),
    "El generador ocupó un bloque externo del docente",
  );
  sinSolapes(resultado.colocadas);
});

probar("devuelve sin ubicar cuando el docente supera la capacidad", () => {
  const cargas = [];
  let id = 1;
  for (let grado = 1; grado <= 2; grado += 1) {
    for (let curso = 1; curso <= 5; curso += 1) {
      cargas.push(crearCarga(id++, grado, curso, 99, 6));
    }
  }

  const resultado = generarHorario({
    cargas,
    periodos: PERIODOS,
    dias: DIAS,
    maxPorCursoDia: 2,
    seed: 123,
  });

  const colocadas = resultado.colocadas.length;
  const faltan = resultado.sin_ubicar.reduce(
    (total, item) => total + item.faltan,
    0,
  );

  assert.equal(colocadas + faltan, 60);
  assert.ok(colocadas <= 40, `Colocó ${colocadas} bloques; capacidad 40`);
  assert.ok(faltan >= 20, `Solo reportó ${faltan} horas sin ubicar`);
  sinSolapes(resultado.colocadas);
});

probar("es reproducible con la misma semilla", () => {
  const opciones = {
    cargas: fixtureCoherente(),
    periodos: PERIODOS,
    dias: DIAS,
    maxPorCursoDia: 2,
    seed: 2026,
  };
  const a = generarHorario(opciones);
  const b = generarHorario(opciones);
  const normalizar = (bloques) =>
    bloques
      .map(
        (b) =>
          `${b.id_carga}|${b.dia_semana}|${b.id_periodo}|${b.id_personal}`,
      )
      .sort()
      .join(",");

  assert.equal(normalizar(a.colocadas), normalizar(b.colocadas));
});

console.log(`\nH47 generador: ${pruebas} PASS`);
