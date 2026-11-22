/**
 * Utilidades de fecha para SIGA-UC.
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

/**
 * Devuelve la fecha LOCAL en formato YYYY-MM-DD.
 *
 * No usar `toISOString().split('T')[0]`: ese método convierte a UTC y, en Lima
 * (UTC-5), a partir de las 19:00 devuelve el día siguiente.
 */
export const fechaLocalISO = (fecha: Date = new Date()): string =>
  fecha.toLocaleDateString('en-CA');

/**
 * Convierte `YYYY-MM-DD` en una fecha local.
 *
 * No usar `new Date('YYYY-MM-DD')`: el estándar la interpreta como UTC y en
 * Lima (UTC-5) devuelve el día anterior. Construir con año, mes y día locales
 * evita ese desfase.
 */
export const parseFechaLocal = (fechaISO: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fechaISO || '').trim());
  if (!match) return null;

  const anio = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const fecha = new Date(anio, mes - 1, dia);

  // Rechaza fechas imposibles como 2026-02-31.
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return null;
  }

  return fecha;
};

/**
 * Devuelve el día de la semana en español para una fecha `YYYY-MM-DD`.
 * Se calcula con la fecha local, no con `toISOString()`.
 */
export const diaSemanaLocal = (fechaISO: string): string => {
  const fecha = parseFechaLocal(fechaISO);
  if (!fecha) return '';

  return [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ][fecha.getDay()];
};
