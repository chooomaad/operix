/**
 * Dates : tout en UTC, comme l'ancienne API (config/app.php : timezone UTC).
 */

/** ISO 8601 sans millisecondes, offset explicite (format Carbon::toIso8601String). */
export function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

/** 'YYYY-MM-DD HH:MM' (format Laravel 'Y-m-d H:i' des resources). */
export function ymdHi(d: Date | null | undefined): string | null {
  if (!d) return null;
  const s = d.toISOString();
  return `${s.slice(0, 10)} ${s.slice(11, 16)}`;
}

export function todayYmd(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Nombre de jours entiers entre deux dates 'YYYY-MM-DD' (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
