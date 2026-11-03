const pad = (n: number) => String(n).padStart(2, '0');

export const todayISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const nowHM = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Accepte « 2026-10-18 09:42 » (format Resource Laravel) ou ISO 8601. */
export function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v.includes('T') ? v : v.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTime(v: string | null | undefined): string {
  const d = parseDate(v);
  return d ? nowHM(d) : '—';
}

export function formatDateTime(v: string | null | undefined): string {
  const d = parseDate(v);
  if (!d) return '—';
  const today = todayISO();
  const prefix = todayISO(d) === today ? "Aujourd'hui" : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return `${prefix}, ${nowHM(d)}`;
}

export function timeAgo(v: string | null | undefined): string {
  const d = parseDate(v);
  if (!d) return '';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

export function formatDelay(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}j`;
}

export const firstName = (name: string | undefined) => (name ?? '').trim().split(/\s+/)[0] ?? '';

export const initials = (name: string | undefined) =>
  (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
