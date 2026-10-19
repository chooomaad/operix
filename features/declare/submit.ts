import { actionsService } from '@/services/actions';
import { isNetworkError } from '@/services/api';
import { breachService, incidentsService, nearMissService, type GeoFields } from '@/services/incidents';
import { offlineQueue } from '@/services/offlineQueue';
import { invalidate } from '@/hooks/useQuery';
import { nowHM, todayISO } from '@/lib/format';
import type { Analysis, ProposedAction, Severity } from '@/types/api';
import type { Draft, Outcome } from './DeclareProvider';

function geo(d: Draft): GeoFields {
  if (!d.fix) return {};
  return {
    latitude: d.fix.latitude,
    longitude: d.fix.longitude,
    location_accuracy: d.fix.accuracy ?? undefined,
    location_captured_at: d.fix.capturedAt,
  };
}

const nmSeverity = (s: Severity) => (s === 'critical' ? 'high' : s);

/**
 * Enregistre la déclaration puis, pour un incident, déploie le plan validé.
 * Sans réseau : la déclaration part dans la file locale (sans plan d'actions,
 * l'analyse n'ayant de sens qu'avec le serveur).
 */
export async function submitDeclaration(draft: Draft, analysis: Analysis | null, severity: Severity, actions: ProposedAction[]): Promise<Outcome> {
  const base = { date: todayISO(), time: nowHM(), location: draft.location, description: draft.description, ...geo(draft) };
  const cause = analysis?.causes[0];

  try {
    if (draft.kind === 'incident') {
      const incident = await incidentsService.create(
        { ...base, type: analysis?.incident_type ?? 'Autre', severity, immediate_cause: cause },
        draft.photo,
      );
      let deployed: Outcome['actions'] = [];
      if (analysis && actions.length > 0) {
        deployed = (await actionsService.deploy(incident.id, { ...analysis, risk_level: severity }, actions)).data;
      }
      invalidate('incidents');
      invalidate('dashboard');
      invalidate('actions');
      return { reference: incident.reference, recordId: incident.id, kind: 'incident', offline: false, incident, actions: deployed };
    }

    if (draft.kind === 'near_miss') {
      const nm = await nearMissService.create(
        {
          ...base,
          severity: nmSeverity(severity),
          potential_consequence: analysis?.risks.join(' • '),
          corrective_action: actions.map((a) => a.description).join('\n') || undefined,
        },
        draft.photo,
      );
      invalidate('near-miss');
      invalidate('dashboard');
      return { reference: nm.reference, recordId: nm.id, kind: 'near_miss', offline: false, actions: [] };
    }

    const breach = await breachService.create({
      date: base.date,
      location: base.location,
      type: analysis?.category ?? 'Non-respect des règles',
      severity,
      description: base.description,
    });
    invalidate('dashboard');
    return { reference: breach.reference, recordId: breach.id, kind: 'violation', offline: false, actions: [] };
  } catch (e) {
    if (!isNetworkError(e) || draft.kind === 'violation') throw e;
    if (draft.kind === 'incident') {
      await offlineQueue.enqueue({ kind: 'incident', image: draft.photo, payload: { ...base, type: analysis?.incident_type ?? 'Autre', severity, immediate_cause: cause } });
    } else {
      await offlineQueue.enqueue({ kind: 'near_miss', image: draft.photo, payload: { ...base, severity: nmSeverity(severity) } });
    }
    return { reference: null, recordId: null, kind: draft.kind, offline: true, actions: [] };
  }
}
