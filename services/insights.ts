import { dashboardService } from './dashboard';
import { incidentsService, nearMissService } from './incidents';
import { actionsService } from './actions';
import { todayISO } from '@/lib/format';
import { computeInsights, type InsightPeriod, type Insights } from '@/features/insights/computeInsights';

const PERIOD_DAYS: Record<InsightPeriod, number> = { '7J': 7, '30J': 30, Trimestre: 90, 'Année': 365 };

/**
 * Agrège des endpoints existants ; aucun chiffre n'est inventé. Chaque indicateur
 * dérivé est documenté dans computeInsights.
 */
export async function loadInsights(period: InsightPeriod): Promise<Insights> {
  const days = PERIOD_DAYS[period];
  const from = todayISO(new Date(Date.now() - days * 86_400_000));
  const prevFrom = todayISO(new Date(Date.now() - 2 * days * 86_400_000));

  const [current, previous, nearMiss, stats, actions] = await Promise.all([
    incidentsService.list({ from, per_page: 100 }),
    incidentsService.list({ from: prevFrom, to: from, per_page: 100 }),
    nearMissService.list({ from, per_page: 100 }),
    dashboardService.incidentStats(),
    actionsService.all().catch(() => []),
  ]);

  return computeInsights({
    incidents: current.data,
    previousCount: previous.meta.total,
    nearMiss: nearMiss.data,
    nearMissTotal: nearMiss.meta.total,
    byMonth: stats.by_month,
    actions,
    days,
  });
}
