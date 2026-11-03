import { api } from './api';
import type { Activity, DashboardResponse, IncidentStats, SafetyTracker, Zone } from '@/types/api';

export const dashboardService = {
  summary: () => api.get<DashboardResponse>('/dashboard').then((r) => r.data),
  recentActivity: () => api.get<{ activities: Activity[] }>('/dashboard/recent-activity').then((r) => r.data.activities),
  topZones: () => api.get<{ zones: Zone[] }>('/dashboard/top-zones').then((r) => r.data.zones),
  incidentStats: (year?: number) =>
    api.get<IncidentStats>('/dashboard/incident-stats', { params: year ? { year } : {} }).then((r) => r.data),
  /** Réservé à l'encadrement (safety_tracker.view). */
  safetyTracker: () => api.get<SafetyTracker>('/safety-tracker').then((r) => r.data),
};
