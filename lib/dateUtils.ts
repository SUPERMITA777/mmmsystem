/**
 * Utilities for handling dates in the Argentina timezone (UTC-3).
 */

export const ARGENTINA_ZONE = 'America/Argentina/Buenos_Aires';
export const ARGENTINA_OFFSET = '-03:00';

/**
 * Returns the current date in Argentina as a "YYYY-MM-DD" string.
 */
export function getArgentinaDate(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Returns the first day of the current month in Argentina as a "YYYY-MM-DD" string.
 */
export function getArgentinaFirstDayOfMonth(): string {
  const baDate = getArgentinaDate(); // "YYYY-MM-DD"
  return baDate.substring(0, 8) + '01';
}

/**
 * Returns an ISO-like string with Argentina's offset for the start of a day (00:00:00).
 * Example: "2026-03-15T00:00:00-03:00"
 */
export function getStartOfDayArgentina(dateStr: string): string {
  return `${dateStr}T00:00:00${ARGENTINA_OFFSET}`;
}

/**
 * Returns an ISO-like string with Argentina's offset for the end of a day (23:59:59).
 * Example: "2026-03-15T23:59:59-03:00"
 */
export function getEndOfDayArgentina(dateStr: string): string {
  return `${dateStr}T23:59:59${ARGENTINA_OFFSET}`;
}

/**
 * Formats a date string or object to Argentina local time string.
 */
export function formatToArgentinaTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('es-AR', {
    timeZone: ARGENTINA_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a date string or object to Argentina local date-time string.
 */
export function formatToArgentinaDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-AR', {
    timeZone: ARGENTINA_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
