import { api, multipart, toFormData, type LocalFile } from './api';
import type { Incident, IncidentType, NearMiss, Paginated, RecordStatus, Severity } from '@/types/api';

export interface GeoFields {
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  location_captured_at?: string;
}

export interface NewIncident extends GeoFields {
  date: string;
  time: string;
  location: string;
  type: IncidentType;
  severity: Severity;
  description: string;
  immediate_cause?: string;
}

export interface NewNearMiss extends GeoFields {
  date: string;
  time: string;
  location: string;
  severity: Exclude<Severity, 'critical'>;
  description: string;
  potential_consequence?: string;
  corrective_action?: string;
}

export interface ListParams {
  page?: number;
  per_page?: number;
  status?: RecordStatus;
  severity?: Severity;
  search?: string;
  from?: string;
  to?: string;
}

export const incidentsService = {
  list: (params: ListParams = {}) => api.get<Paginated<Incident>>('/incidents', { params }).then((r) => r.data),
  get: (id: number) => api.get<Incident>(`/incidents/${id}`).then((r) => r.data),
  create: (payload: NewIncident, image?: LocalFile | null) =>
    api.post<Incident>('/incidents', toFormData({ ...payload }, { image }), multipart).then((r) => r.data),
  /** PUT /incidents/{id} — encadrement uniquement (incidents.update). */
  updateStatus: (id: number, status: RecordStatus) =>
    api.put<Incident>(`/incidents/${id}`, { status }).then((r) => r.data),
};

export const nearMissService = {
  list: (params: ListParams = {}) => api.get<Paginated<NearMiss>>('/near-miss', { params }).then((r) => r.data),
  get: (id: number) => api.get<NearMiss>(`/near-miss/${id}`).then((r) => r.data),
  create: (payload: NewNearMiss, image?: LocalFile | null) =>
    api.post<NearMiss>('/near-miss', toFormData({ ...payload }, { image }), multipart).then((r) => r.data),
};

export interface NewBreach {
  date: string;
  location: string;
  type: string;
  severity: Severity;
  description: string;
}

/** Infractions : web + encadrement HSSE (breaches.manage). */
export const breachService = {
  create: (payload: NewBreach) => api.post<{ id: number; reference: string }>('/breaches', payload).then((r) => r.data),
};
