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
  is_platform_admin?: boolean;
}

export interface Company {
  id: number;
  slug: string;
  name: string;
  short_name: string | null;
  status: 'active' | 'suspended' | 'expired';
  country: string | null;
  timezone: string;
  created_at: string;
}

export interface CompanyForm {
  slug: string;
  name: string;
  short_name: string;
  country: string;
  timezone: string;
  status?: Company['status'];
}

export interface AdminUsersResponse {
  data: AdminUser[];
  meta: { total: number; current_page: number; last_page: number };
  sites: Site[];
  tenant: AdminSession['tenant'];
}

export interface Employee {
  id: number;
  matricule: string | null;
  nom: string;
  prenom: string;
  poste: string | null;
  type_contrat: string | null;
  gender: string | null;
  date_embauche: string | null;
  nationalite: string | null;
  is_active: boolean;
  department: { id: number; name: string } | null;
}

export interface EmployeeForm {
  matricule: string;
  nom: string;
  prenom: string;
  poste: string;
  type_contrat: string;
  gender: string;
  date_embauche: string;
  nationalite: string;
  department: string;
  is_active: boolean;
}

export interface AdminEmployeesResponse {
  data: Employee[];
  meta: { total: number; current_page: number; last_page: number };
}

export type RecordStatus = 'open' | 'in_progress' | 'closed';

export interface Incident {
  id: number;
  reference: string;
  date: string | null;
  location: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  immediate_cause?: string | null;
  root_cause?: string | null;
  corrective_action?: string | null;
  corrective_action_due?: string | null;
  status: RecordStatus;
  ai_analysis: { category?: string } | null;
}

export interface AdminIncidentsResponse {
  data: Incident[];
  meta: { total: number; current_page: number; last_page: number };
}

export interface AdminNearMiss {
  id: number;
  reference: string;
  date: string;
  location: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  potential_consequence: string | null;
  corrective_action: string | null;
  status: RecordStatus;
}

export interface AdminBreach {
  id: number;
  reference: string;
  employee_id: number | null;
  employee_name: string | null;
  location: string | null;
  date: string;
  type: string;
  severity: Incident['severity'];
  description: string;
  sanction: string | null;
  status: RecordStatus;
}

export interface RecordForm {
  date: string;
  location: string;
  type?: string;
  severity: Incident['severity'];
  description: string;
  status: RecordStatus;
  employee_id?: number | null;
  potential_consequence?: string;
  corrective_action?: string;
  sanction?: string;
}

export interface IncidentForm extends RecordForm {
  type: string;
  immediate_cause?: string;
  root_cause?: string;
  corrective_action?: string;
  corrective_action_due?: string;
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
    if (!session.abilities.includes('users.manage') && !session.abilities.includes('platform.manage')) {
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

function tenantPath(tenantId: number | undefined, path: string): string {
  if (tenantId === undefined) return path;
  const companyPath = path.replace(/^\/admin(?=\/)/, '');
  return `/platform/companies/${tenantId}${companyPath}`;
}

export function getPlatformCompanies(): Promise<{ data: Company[] }> {
  return request('/platform/companies');
}

export function createPlatformCompany(form: CompanyForm): Promise<Company> {
  return request('/platform/companies', { method: 'POST', body: JSON.stringify(form) });
}

export function updatePlatformCompany(id: number, form: CompanyForm): Promise<Company> {
  return request(`/platform/companies/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: form.name, short_name: form.short_name, country: form.country, timezone: form.timezone, status: form.status }),
  });
}

export function suspendPlatformCompany(id: number): Promise<Company> {
  return request(`/platform/companies/${id}`, { method: 'DELETE' });
}

export function getUsers(query: URLSearchParams, signal?: AbortSignal, tenantId?: number): Promise<AdminUsersResponse> {
  return request(`${tenantPath(tenantId, '/admin/users')}?${query}`, { signal });
}

export function createUser(form: UserForm, tenantId?: number): Promise<AdminUser> {
  return request(tenantPath(tenantId, '/admin/users'), {
    method: 'POST',
    body: JSON.stringify({ ...form, site_id: Number(form.site_id) }),
  });
}

export function updateUser(id: number, form: UserForm, tenantId?: number): Promise<AdminUser> {
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
  return request(`${tenantPath(tenantId, '/admin/users')}/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function getEmployees(query: URLSearchParams, signal?: AbortSignal, tenantId?: number): Promise<AdminEmployeesResponse> {
  return request(`${tenantPath(tenantId, '/admin/employees')}?${query}`, { signal });
}

export function createEmployee(form: EmployeeForm, tenantId?: number): Promise<Employee> {
  return request(tenantPath(tenantId, '/admin/employees'), {
    method: 'POST',
    body: JSON.stringify({ ...form, matricule: form.matricule || null }),
  });
}

export function updateEmployee(id: number, form: EmployeeForm, tenantId?: number): Promise<Employee> {
  return request(`${tenantPath(tenantId, '/admin/employees')}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...form, matricule: form.matricule || null }),
  });
}

export function importEmployees(rows: EmployeeForm[], tenantId?: number): Promise<{ imported: number }> {
  return request(`${tenantPath(tenantId, '/admin/employees')}/import`, {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}

export function getIncidents(query: URLSearchParams, signal?: AbortSignal, tenantId?: number): Promise<AdminIncidentsResponse> {
  return request(`${tenantPath(tenantId, '/incidents')}?${query}`, { signal });
}

export function updateIncidentStatus(id: number, status: RecordStatus, tenantId?: number): Promise<Incident> {
  return request(`${tenantPath(tenantId, '/incidents')}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export function saveIncident(form: IncidentForm, id?: number, tenantId?: number): Promise<Incident> {
  const path = tenantPath(tenantId, '/incidents');
  return request(id === undefined ? path : `${path}/${id}`, { method: id === undefined ? 'POST' : 'PUT', body: JSON.stringify(form) });
}

export function deleteIncident(id: number, tenantId?: number): Promise<{ message: string }> {
  return request(`${tenantPath(tenantId, '/incidents')}/${id}`, { method: 'DELETE' });
}

export function getNearMisses(query: URLSearchParams, signal?: AbortSignal, tenantId?: number): Promise<AdminEmployeesResponse & { data: AdminNearMiss[] }> {
  return request(`${tenantPath(tenantId, '/near-miss')}?${query}`, { signal });
}

export function saveNearMiss(form: RecordForm, id?: number, tenantId?: number): Promise<AdminNearMiss> {
  const path = tenantPath(tenantId, '/near-miss');
  return request(id === undefined ? path : `${path}/${id}`, { method: id === undefined ? 'POST' : 'PUT', body: JSON.stringify(form) });
}

export function deleteNearMiss(id: number, tenantId?: number): Promise<{ message: string }> {
  return request(`${tenantPath(tenantId, '/near-miss')}/${id}`, { method: 'DELETE' });
}

export function getBreaches(query: URLSearchParams, signal?: AbortSignal, tenantId?: number): Promise<AdminEmployeesResponse & { data: AdminBreach[] }> {
  return request(`${tenantPath(tenantId, '/breaches')}?${query}`, { signal });
}

export function saveBreach(form: RecordForm, id?: number, tenantId?: number): Promise<AdminBreach> {
  const path = tenantPath(tenantId, '/breaches');
  return request(id === undefined ? path : `${path}/${id}`, { method: id === undefined ? 'POST' : 'PUT', body: JSON.stringify(form) });
}

export function deleteBreach(id: number, tenantId?: number): Promise<{ message: string }> {
  return request(`${tenantPath(tenantId, '/breaches')}/${id}`, { method: 'DELETE' });
}
