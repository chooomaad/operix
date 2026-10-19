import type { Incident, IncidentAction, NearMiss } from '@/types/api';
import { parseDate } from '@/lib/format';

export type InsightPeriod = '7J' | '30J' | 'Trimestre' | 'Année';

export interface Insights {
  preventionIndex: number;
  deltaVsPrevious: number;
  incidents: number;
  nearMiss: number;
  /** Near-miss signalés : chaque presqu'accident déclaré est un incident évité. */
  potentialNeutralized: number;
  trend: { label: string; value: number; projected: boolean }[];
  zones: { location: string; share: number; count: number }[];
  categories: { label: string; share: number }[];
  closureRate: number;
  avgCloseHours: number | null;
  openActions: number;
  overdueActions: number;
  highShare: number;
}

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function share(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

/**
 * Indice de prévention (0-100) — formule transparente, affichée dans l'app :
 *   40 pts × ratio near-miss / (near-miss + incidents)  → culture du signalement
 *   30 pts × part des actions terminées                  → exécution du plan
 *   30 pts × (1 − part des incidents élevés/critiques)   → gravité maîtrisée
 */
export function computeInsights(input: {
  incidents: Incident[];
  previousCount: number;
  nearMiss: NearMiss[];
  nearMissTotal: number;
  byMonth: Record<string, number>;
  actions: IncidentAction[];
  days: number;
}): Insights {
  const { incidents, nearMiss, actions } = input;
  const nInc = incidents.length;
  const nNm = input.nearMissTotal;

  const high = incidents.filter((i) => i.severity === 'high' || i.severity === 'critical').length;
  const done = actions.filter((a) => a.status === 'done');
  const reportingRatio = nInc + nNm > 0 ? nNm / (nInc + nNm) : 1;
  const execRatio = actions.length > 0 ? done.length / actions.length : 1;
  const gravityRatio = nInc > 0 ? 1 - high / nInc : 1;
  const preventionIndex = Math.round(40 * reportingRatio + 30 * execRatio + 30 * gravityRatio);

  // Zones : regroupement par lieu déclaré.
  const zoneMap = new Map<string, number>();
  [...incidents.map((i) => i.location), ...nearMiss.map((n) => n.location)].forEach((l) => {
    if (l) zoneMap.set(l, (zoneMap.get(l) ?? 0) + 1);
  });
  const zoneTotal = [...zoneMap.values()].reduce((a, b) => a + b, 0);
  const zones = [...zoneMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([location, count]) => ({ location, count, share: share(count, zoneTotal) }));

  // Catégories issues des analyses Operix AI figées sur les incidents.
  const catMap = new Map<string, number>();
  incidents.forEach((i) => {
    const c = i.ai_analysis?.category;
    if (c) catMap.set(c, (catMap.get(c) ?? 0) + 1);
  });
  const catTotal = [...catMap.values()].reduce((a, b) => a + b, 0);
  const categories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, n]) => ({ label, share: share(n, catTotal) }));

  // Trajectoire : 6 derniers mois réels + 2 mois projetés (régression linéaire simple).
  const month = new Date().getMonth();
  const real = Array.from({ length: 6 }, (_, k) => {
    const m = month - 5 + k;
    if (m < 0) return null; // by_month ne couvre que l'année en cours
    return { label: MONTHS[m] ?? '', value: input.byMonth[String(m + 1).padStart(2, '0')] ?? 0, projected: false };
  }).filter((x): x is { label: string; value: number; projected: boolean } => x !== null);
  const n = real.length;
  const xs = real.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / Math.max(n, 1);
  const my = real.reduce((a, b) => a + b.value, 0) / Math.max(n, 1);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const slope = den > 0 ? xs.reduce((a, x, i) => a + (x - mx) * ((real[i]?.value ?? 0) - my), 0) / den : 0;
  const projected = [1, 2].map((k) => ({
    label: MONTHS[(month + k) % 12] ?? '',
    value: Math.max(0, Math.round(my + slope * (n - 1 + k - mx))),
    projected: true,
  }));

  // Délai moyen de clôture d'une action.
  const durations = done
    .map((a) => {
      const s = parseDate(a.created_at);
      const e = parseDate(a.done_at);
      return s && e ? (e.getTime() - s.getTime()) / 3_600_000 : null;
    })
    .filter((x): x is number => x !== null);

  return {
    preventionIndex,
    deltaVsPrevious: nInc - input.previousCount,
    incidents: nInc,
    nearMiss: nNm,
    potentialNeutralized: nNm,
    trend: [...real, ...projected],
    zones,
    categories,
    closureRate: share(incidents.filter((i) => i.status === 'closed').length, nInc),
    avgCloseHours: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    openActions: actions.length - done.length,
    overdueActions: actions.filter((a) => a.is_overdue).length,
    highShare: share(high, nInc),
  };
}
