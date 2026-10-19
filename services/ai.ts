import { api, multipart, toFormData, type LocalFile } from './api';
import type { Analysis, EventKind } from '@/types/api';

/**
 * Operix AI — Safety Intelligence Engine.
 * L'appel passe TOUJOURS par operix-api : aucune clé fournisseur dans l'app.
 */
export const aiService = {
  analyze: (input: { description: string; location?: string; event_type: EventKind }, image?: LocalFile | null) =>
    api
      .post<Analysis>('/ai/incidents/analyze', toFormData({ ...input }, { image }), { ...multipart, timeout: 60_000 })
      .then((r) => r.data),
};
