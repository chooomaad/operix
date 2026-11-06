import { api } from './api';
import type { EmployeeLite } from '@/types/api';

interface FullEmployee {
  id: number;
  matricule: string | null;
  nom: string;
  prenom: string;
  is_active: boolean;
}

interface EmployeesPage {
  data: FullEmployee[];
  meta: { current_page: number; last_page: number };
}

function toEmployeeLite(employee: FullEmployee): EmployeeLite {
  return {
    id: employee.id,
    matricule: employee.matricule,
    name: `${employee.prenom} ${employee.nom}`.trim(),
    status: employee.is_active ? 'active' : 'inactive',
  };
}

/**
 * Deux endpoints selon le rôle : l'agent n'a que la recherche minimale
 * (employees.agent_search), l'encadrement a le module complet (employees.view).
 */
export const employeesService = {
  async list(search: string, page: number): Promise<{ items: EmployeeLite[]; page: number; lastPage: number }> {
    const params: Record<string, string | number> = { per_page: 100, page };
    if (search) params.search = search;
    const { data } = await api.get<EmployeesPage>('/employees', { params });
    return {
      items: data.data.map(toEmployeeLite),
      page: data.meta.current_page,
      lastPage: data.meta.last_page,
    };
  },

  async search(q: string): Promise<EmployeeLite[]> {
    const { data } = await api.get<{ data: EmployeeLite[] }>('/agent/employees/search', { params: { q } });
    return data.data;
  },
};
