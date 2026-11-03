import { api, tokenStore } from './api';
import type { LoginResponse, Session } from '@/types/api';

export const authService = {
  /** POST /auth/login — matricule + PIN, jeton nommé « operix-mobile » côté serveur. */
  async login(matricule: string, pin: string): Promise<Session> {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      matricule: matricule.trim().toUpperCase(),
      pin,
      platform: 'mobile',
    });
    await tokenStore.save(data.token);
    return { user: data.user, tenant: data.tenant, abilities: data.abilities };
  },

  async me(): Promise<Session> {
    const { data } = await api.get<Session>('/auth/me');
    return data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      await tokenStore.clear();
    }
  },
};
