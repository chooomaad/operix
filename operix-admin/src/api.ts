export interface AdminUser {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  matricule: string;
  email: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  site: { id: number; name: string } | null;
}

export interface Site {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
}

export interface AdminSession {
  user: { id: number; name: string; matricule: string; role: string };
  tenant: { id: number; name: string; short_name: string | null } | null;
  abilities: string[];
}

export interface AdminUsersResponse {
  data: AdminUser[];
  meta: { total: number; current_page: number; last_page: number };
  sites: Site[];
  tenant: AdminSession['tenant'];
}

export interface UserForm {
  first_name: string;
  last_name: string;
  matricule: string;
  pin: string;
  pin_confirmation: string;
  role: string;
  site_id: string;
  is_active: boolean;
}

export const ROLES = ['company_admin', 'hsse_manager', 'supervisor', 'agent'] as const;
export const ROLE_LABELS: Record<string, string> = {
  company_admin: 'Administrateur',
  hsse_manager: 'Responsable HSSE',
  supervisor: 'Superviseur',
  agent: 'Agent HSSE',
};

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError('Configurez VITE_API_URL dans le fichier .env.', 0);
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Connexion impossible au serveur OPERIX.', 0);
  }
  const data = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) throw new ApiError(data?.message ?? 'Une erreur est survenue.', response.status);
  return data as T;
}

export async function login(matricule: string, pin: string): Promise<AdminSession> {
  const result = await request<{ token: string; user: AdminSession['user']; tenant: AdminSession['tenant']; abilities: string[] }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ matricule, pin, platform: 'web' }) },
  );
  setAccessToken(result.token);
  try {
    const session = await request<AdminSession>('/auth/me');
    if (!session.abilities.includes('users.manage')) {
      throw new ApiError('Ce compte ne dispose pas des droits d’administration des utilisateurs.', 403);
    }
    return session;
  } catch (error) {
    setAccessToken(null);
    throw error;
  }
}

export function logout(): Promise<{ message: string }> {
  return request('/auth/logout', { method: 'POST' });
}

export function getUsers(query: URLSearchParams, signal?: AbortSignal): Promise<AdminUsersResponse> {
  return request(`/admin/users?${query}`, { signal });
}

export function getSites(): Promise<{ data: Site[] }> {
  return request('/admin/sites');
}

export function createUser(form: UserForm): Promise<AdminUser> {
  return request('/admin/users', {
    method: 'POST',
    body: JSON.stringify({ ...form, site_id: Number(form.site_id) }),
  });
}

export function updateUser(id: number, form: UserForm): Promise<AdminUser> {
  const body: Record<string, unknown> = {
    first_name: form.first_name,
    last_name: form.last_name,
    matricule: form.matricule,
    role: form.role,
    site_id: form.site_id ? Number(form.site_id) : null,
    is_active: form.is_active,
  };
  if (form.pin) {
    body.pin = form.pin;
    body.pin_confirmation = form.pin_confirmation;
  }
  return request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}
