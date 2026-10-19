import { formatTime, parseDate } from '@/lib/format';
import type { TimelineItem } from '@/components/ui';
import type { Incident, IncidentAction } from '@/types/api';

/**
 * Chronologie reconstruite UNIQUEMENT à partir d'horodatages serveur :
 * création, analyse, déploiement, actions terminées. Les échéances futures
 * apparaissent comme « à venir ».
 */
export function buildTimeline(incident: Incident, actions: IncidentAction[]): TimelineItem[] {
  const items: (TimelineItem & { at: number })[] = [];
  const push = (iso: string | null | undefined, title: string, detail: string | undefined, state: TimelineItem['state']) => {
    const d = parseDate(iso);
    if (d) items.push({ at: d.getTime(), time: formatTime(iso), title, detail, state });
  };

  push(incident.created_at_iso ?? incident.created_at, 'Déclaration terrain', incident.reported_by?.name, 'done');
  const a = incident.ai_analysis;
  if (a) {
    push(a.analyzed_at, a.engine === 'ai' ? 'Diagnostic Operix AI' : 'Diagnostic (moteur de règles)', `${a.category} • ${a.confidence}% certitude`, 'done');
    push(a.deployed_at, "Plan d'actions déployé", `${actions.length} actions • encadrement notifié`, 'done');
  }
  actions.forEach((act, i) => {
    if (act.done_at) push(act.done_at, `Action #${i + 1} validée`, act.done_by?.name ?? act.description, 'done');
  });
  items.sort((x, y) => x.at - y.at);

  if (incident.status === 'closed') {
    items.push({ at: 0, time: '✓', title: 'Incident clôturé', state: 'done' });
    return items;
  }
  actions
    .filter((x) => x.status !== 'done' && x.due_at)
    .sort((x, y) => (x.due_at ?? '').localeCompare(y.due_at ?? ''))
    .slice(0, 2)
    .forEach((x) =>
      items.push({ at: 0, time: formatTime(x.due_at), title: `Échéance : ${x.description}`, detail: x.responsible_role ?? undefined, state: x.status === 'in_progress' ? 'current' : 'upcoming' }),
    );
  items.push({ at: 0, time: '—', title: 'Clôture attendue', detail: 'Rapport de clôture (PDF) requis', state: 'upcoming' });
  return items;
}
