import { api } from './api';
import type { EmployeeLite } from '@/types/api';

interface FullEmployee {
  id: number;
  matricule: string | null;
  nom: string;
  prenom: string;
  is_active: boolean;
}

/**
 * Deux endpoints selon le rôle : l'agent n'a que la recherche minimale
 * (employees.agent_search), l'encadrement a le module complet (employees.view).
 */
export const employeesService = {
  async search(q: string, canViewAll: boolean): Promise<EmployeeLite[]> {
    if (canViewAll) {
      const { data } = await api.get<{ data: FullEmployee[] }>('/employees', { params: { search: q, per_page: 30 } });
      return data.data.map((e) => ({
        id: e.id,
        matricule: e.matricule,
        name: `${e.prenom} ${e.nom}`.trim(),
        status: e.is_active ? 'active' : 'inactive',
      }));
    }
    const { data } = await api.get<{ data: EmployeeLite[] }>('/agent/employees/search', { params: { q } });
    return data.data;
  },
};
