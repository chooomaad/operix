import { api } from './api';
import type { ActionStatus, Analysis, IncidentAction, ProposedAction } from '@/types/api';

export const actionsService = {
  forIncident: (incidentId: number) =>
    api.get<{ data: IncidentAction[] }>(`/incidents/${incidentId}/actions`).then((r) => r.data.data),
  /** Fige l'analyse sur l'incident et crée le plan d'actions (une seule fois). */
  deploy: (incidentId: number, analysis: Analysis, actions: ProposedAction[]) =>
    api
      .post<{ analysis: Analysis; data: IncidentAction[] }>(`/incidents/${incidentId}/actions/deploy`, { analysis, actions })
      .then((r) => r.data),
  setStatus: (incidentId: number, actionId: number, status: ActionStatus) =>
    api.put<IncidentAction>(`/incidents/${incidentId}/actions/${actionId}`, { status }).then((r) => r.data),
  all: (status?: ActionStatus) =>
    api.get<{ data: IncidentAction[] }>('/incident-actions', { params: status ? { status } : {} }).then((r) => r.data.data),
};
