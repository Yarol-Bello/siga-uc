/**
 * Generador de horarios (H47)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Algoritmo puro, sin dependencias externas:
 * - Sesiones = horas_asignadas de cada carga.
 * - Greedy aleatorio con backtracking acotado y varios intentos.
 * - Restricciones duras: grado, docente, máximo por curso/día.
 * - Los bloques externos (otros grados) ocupan al docente.
 * - Nunca publica: solo produce asignaciones BORRADOR.
 */

const PRNG_INCREMENTO = 0x6d2b79f5;

const crearRng = (seed) => {
  let estado = seed >>> 0;
  return () => {
    estado = (estado + PRNG_INCREMENTO) | 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const sumarCuadrados = (mapa) => {
  let total = 0;
  for (const valor of mapa.values()) total += valor * valor;
  return total;
};

const calcularCalidad = (estado) =>
  -(sumarCuadrados(estado.gradoDia) + sumarCuadrados(estado.docenteDia));

const generarHorario = ({
  cargas = [],
  periodos = [],
  dias = [],
  bloquesExternos = [],
  maxPorCursoDia = 2,
  seed = 1,
  intentos = 8,
  maxNodos = 8000,
  maxCandidatos = 6,
}) => {
  const capacidad = periodos.length * dias.length;
  if (capacidad === 0 || cargas.length === 0) {
    return {
      seed,
      intentos_ejecutados: 0,
      colocadas: [],
      sin_ubicar: cargas.map((c) => ({
        id_carga: c.id_carga,
        requeridas: Number(c.horas) || 0,
        colocadas: 0,
        faltan: Number(c.horas) || 0,
        motivo: "No hay períodos o días configurados.",
      })),
      por_grado: [],
      calidad: 0,
    };
  }

  const horasPorDocente = new Map();
  for (const carga of cargas) {
    horasPorDocente.set(
      carga.id_personal,
      (horasPorDocente.get(carga.id_personal) || 0) + (Number(carga.horas) || 0),
    );
  }

  const dificultad = (carga) =>
    ((horasPorDocente.get(carga.id_personal) || 0) / capacidad) * 100 +
    (Number(carga.horas) || 0) * 2;

  const sesiones = [];
  for (const carga of cargas) {
    const horas = Number(carga.horas) || 0;
    for (let i = 0; i < horas; i += 1) {
      sesiones.push({ ...carga });
    }
  }

  const sesionesOrdenadas = [...sesiones].sort(
    (a, b) => dificultad(b) - dificultad(a) || a.id_carga - b.id_carga,
  );

  const ocupadoDocenteBase = new Set(
    bloquesExternos.map(
      (b) => `${b.id_personal}|${b.dia_semana}|${b.id_periodo}`,
    ),
  );
  const docenteDiaBase = new Map();
  for (const bloque of bloquesExternos) {
    const clave = `${bloque.id_personal}|${bloque.dia_semana}`;
    docenteDiaBase.set(clave, (docenteDiaBase.get(clave) || 0) + 1);
  }

  const periodoPorOrden = new Map();
  for (const periodo of periodos) {
    periodoPorOrden.set(Number(periodo.orden), periodo.id_periodo);
  }

  let mejor = { colocadas: [], calidad: Number.NEGATIVE_INFINITY };
  let intentosEjecutados = 0;
  let intentosSinMejora = 0;

  for (let intento = 0; intento < intentos; intento += 1) {
    intentosEjecutados += 1;
    const rng = crearRng((seed + intento * 7919) >>> 0);
    const colocadasAntes = mejor.colocadas.length;

    const orden = sesionesOrdenadas
      .map((sesion) => ({ sesion, azar: rng() }))
      .sort(
        (a, b) =>
          dificultad(b.sesion) - dificultad(a.sesion) ||
          a.azar - b.azar,
      )
      .map((item) => item.sesion);

    const estado = {
      ocupadoGrado: new Set(),
      ocupadoDocente: new Set(ocupadoDocenteBase),
      cursoDia: new Map(),
      gradoDia: new Map(),
      docenteDia: new Map(docenteDiaBase),
      colocadas: [],
    };

    let nodos = 0;

    const registrarMejor = () => {
      if (estado.colocadas.length > mejor.colocadas.length) {
        mejor = {
          colocadas: estado.colocadas.map((bloque) => ({ ...bloque })),
          calidad: calcularCalidad(estado),
        };
      }
    };

    const colocar = (sesion, dia, periodo) => {
      const claveGrado = `${sesion.id_grado}|${dia}|${periodo.id_periodo}`;
      const claveDocente = `${sesion.id_personal}|${dia}|${periodo.id_periodo}`;
      const claveCurso = `${sesion.id_grado}|${sesion.id_curso}|${dia}`;
      const claveGradoDia = `${sesion.id_grado}|${dia}`;
      const claveDocenteDia = `${sesion.id_personal}|${dia}`;

      estado.ocupadoGrado.add(claveGrado);
      estado.ocupadoDocente.add(claveDocente);
      estado.cursoDia.set(claveCurso, (estado.cursoDia.get(claveCurso) || 0) + 1);
      estado.gradoDia.set(claveGradoDia, (estado.gradoDia.get(claveGradoDia) || 0) + 1);
      estado.docenteDia.set(
        claveDocenteDia,
        (estado.docenteDia.get(claveDocenteDia) || 0) + 1,
      );
      estado.colocadas.push({
        ...sesion,
        dia_semana: dia,
        id_periodo: periodo.id_periodo,
        periodo_nombre: periodo.nombre,
        aula: null,
      });
    };

    const quitar = (sesion, dia, periodo) => {
      const claveGrado = `${sesion.id_grado}|${dia}|${periodo.id_periodo}`;
      const claveDocente = `${sesion.id_personal}|${dia}|${periodo.id_periodo}`;
      const claveCurso = `${sesion.id_grado}|${sesion.id_curso}|${dia}`;
      const claveGradoDia = `${sesion.id_grado}|${dia}`;
      const claveDocenteDia = `${sesion.id_personal}|${dia}`;

      estado.ocupadoGrado.delete(claveGrado);
      estado.ocupadoDocente.delete(claveDocente);
      estado.colocadas.pop();

      const curso = (estado.cursoDia.get(claveCurso) || 1) - 1;
      if (curso > 0) estado.cursoDia.set(claveCurso, curso);
      else estado.cursoDia.delete(claveCurso);

      const gradoDia = (estado.gradoDia.get(claveGradoDia) || 1) - 1;
      if (gradoDia > 0) estado.gradoDia.set(claveGradoDia, gradoDia);
      else estado.gradoDia.delete(claveGradoDia);

      const docenteDia = (estado.docenteDia.get(claveDocenteDia) || 1) - 1;
      if (docenteDia > 0) estado.docenteDia.set(claveDocenteDia, docenteDia);
      else estado.docenteDia.delete(claveDocenteDia);
    };

    const buscar = (indice) => {
      if (indice >= orden.length) {
        registrarMejor();
        return;
      }
      if (nodos >= maxNodos) {
        registrarMejor();
        return;
      }
      nodos += 1;
      registrarMejor();

      const sesion = orden[indice];
      const candidatos = [];

      for (const dia of dias) {
        const claveGradoDia = `${sesion.id_grado}|${dia}`;
        const claveDocenteDia = `${sesion.id_personal}|${dia}`;
        const bloqueadosGradoDia = estado.gradoDia.get(claveGradoDia) || 0;
        const bloqueadosDocenteDia =
          estado.docenteDia.get(claveDocenteDia) || 0;

        for (const periodo of periodos) {
          const claveGrado = `${sesion.id_grado}|${dia}|${periodo.id_periodo}`;
          const claveDocente = `${sesion.id_personal}|${dia}|${periodo.id_periodo}`;
          const claveCurso = `${sesion.id_grado}|${sesion.id_curso}|${dia}`;

          if (estado.ocupadoGrado.has(claveGrado)) continue;
          if (estado.ocupadoDocente.has(claveDocente)) continue;
          if ((estado.cursoDia.get(claveCurso) || 0) >= maxPorCursoDia) continue;

          const ordenPeriodo = Number(periodo.orden);
          const anterior = periodoPorOrden.get(ordenPeriodo - 1);
          const siguiente = periodoPorOrden.get(ordenPeriodo + 1);
          let adyacencia = 0;
          if (
            anterior &&
            estado.ocupadoGrado.has(`${sesion.id_grado}|${dia}|${anterior}`)
          ) {
            adyacencia += 1;
          }
          if (
            siguiente &&
            estado.ocupadoGrado.has(`${sesion.id_grado}|${dia}|${siguiente}`)
          ) {
            adyacencia += 1;
          }

          const usadosCurso = estado.cursoDia.get(claveCurso) || 0;
          const puntaje =
            -bloqueadosGradoDia * 4 -
            bloqueadosDocenteDia * 2 -
            usadosCurso * 3 +
            adyacencia * 2 +
            rng() * 0.75;

          candidatos.push({ dia, periodo, puntaje });
        }
      }

      candidatos.sort((a, b) => b.puntaje - a.puntaje);
      const mejoresCandidatos = candidatos.slice(0, maxCandidatos);

      if (mejoresCandidatos.length === 0) {
        buscar(indice + 1);
        return;
      }

      for (const candidato of mejoresCandidatos) {
        colocar(sesion, candidato.dia, candidato.periodo);
        buscar(indice + 1);
        quitar(sesion, candidato.dia, candidato.periodo);

        if (mejor.colocadas.length === orden.length) return;
      }
    };

    buscar(0);
    if (mejor.colocadas.length === orden.length) break;
    if (mejor.colocadas.length > colocadasAntes) {
      intentosSinMejora = 0;
    } else {
      intentosSinMejora += 1;
      if (intentosSinMejora >= 3) break;
    }
  }

  const colocadasPorCarga = new Map();
  for (const bloque of mejor.colocadas) {
    colocadasPorCarga.set(
      bloque.id_carga,
      (colocadasPorCarga.get(bloque.id_carga) || 0) + 1,
    );
  }

  const sinUbicar = cargas
    .map((carga) => {
      const requeridas = Number(carga.horas) || 0;
      const colocadas = colocadasPorCarga.get(carga.id_carga) || 0;
      return {
        id_carga: carga.id_carga,
        id_grado: carga.id_grado,
        nombre_grado: carga.nombre_grado,
        seccion: carga.seccion,
        id_curso: carga.id_curso,
        nombre_curso: carga.nombre_curso,
        id_personal: carga.id_personal,
        docente_nombre: carga.docente_nombre,
        requeridas,
        colocadas,
        faltan: requeridas - colocadas,
      };
    })
    .filter((item) => item.faltan > 0);

  const grados = new Map();
  for (const carga of cargas) {
    if (!grados.has(carga.id_grado)) {
      grados.set(carga.id_grado, {
        id_grado: carga.id_grado,
        nombre_grado: carga.nombre_grado,
        seccion: carga.seccion,
        requeridas: 0,
        colocadas: 0,
      });
    }
    const grado = grados.get(carga.id_grado);
    grado.requeridas += Number(carga.horas) || 0;
    grado.colocadas += colocadasPorCarga.get(carga.id_carga) || 0;
  }

  const porGrado = [...grados.values()].map((grado) => ({
    ...grado,
    faltan: grado.requeridas - grado.colocadas,
  }));

  return {
    seed,
    intentos_ejecutados: intentosEjecutados,
    colocadas: mejor.colocadas,
    sin_ubicar: sinUbicar,
    por_grado: porGrado,
    calidad: mejor.calidad,
  };
};

module.exports = {
  generarHorario,
};
