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
