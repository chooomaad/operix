/** Contrats JSON de operix-api, recopiés des Resources / contrôleurs Laravel. */

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type RecordStatus = 'open' | 'in_progress' | 'closed';
export type IncidentType = 'LTI' | 'MTC' | 'RWC' | 'FAC' | 'HPI' | 'Fire' | 'Security' | 'Autre';
export type EventKind = 'incident' | 'near_miss' | 'violation';

export interface User {
  id: number;
  name: string;
  email: string | null;
  role: 'company_admin' | 'hsse_manager' | 'supervisor' | 'agent' | string;
  matricule: string | null;
  phone: string | null;
  avatar: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

export interface Tenant {
  id: number;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  locale: string | null;
  country: string | null;
  timezone: string | null;
}

export interface Session {
  user: User;
  tenant: Tenant | null;
  abilities: string[];
}

export interface LoginResponse extends Session {
  token: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; per_page?: number; current_page: number; last_page: number; unread_count?: number };
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string | null;
}

export interface Incident {
  id: number;
  reference: string;
  date: string | null;
  time: string | null;
  location: string;
  type: IncidentType;
  severity: Severity;
  description: string;
  immediate_cause: string | null;
  root_cause: string | null;
  corrective_action: string | null;
  status: RecordStatus;
  image_url: string | null;
  reported_by?: { id: number; name: string };
  location_point: LocationPoint | null;
  ai_analysis: StoredAnalysis | null;
  actions_summary?: { total: number; done: number };
  created_at: string | null;
  created_at_iso?: string | null;
}

export interface NearMiss {
  id: number;
  reference: string;
  date: string | null;
  time: string | null;
  location: string;
  severity: Exclude<Severity, 'critical'>;
  description: string;
  potential_consequence: string | null;
  corrective_action: string | null;
  status: RecordStatus;
  image_url: string | null;
  reported_by?: { id: number; name: string };
  created_at: string | null;
}

export type ActionPriority = 'immediate' | 'urgent' | 'shift' | 'prevention';
export type ActionStatus = 'todo' | 'in_progress' | 'done';

export interface ProposedAction {
  priority: ActionPriority;
  delay_minutes: number;
  responsible_role: string;
  description: string;
}

export interface Analysis {
  category: string;
  subcategory: string;
  risk_level: Severity;
  incident_type: IncidentType;
  confidence: number;
  summary: string;
  risks: string[];
  causes: string[];
  aggravating_factor: string | null;
  legal_reference: string | null;
  actions: ProposedAction[];
  /** `ai` = modèle IA distant, `rules` = moteur de règles de repli. Toujours affiché. */
  engine: 'ai' | 'rules' | 'manual';
  model: string | null;
  fallback_reason?: 'not_configured' | 'provider_unavailable' | 'rules_selected' | null;
  duration_ms: number;
  analyzed_at: string;
}

export interface StoredAnalysis extends Analysis {
  deployed_at?: string;
  deployed_by?: number;
}

export interface IncidentAction {
  id: number;
  incident_id: number;
  position: number;
  description: string;
  priority: ActionPriority;
  delay_minutes: number | null;
  due_at: string | null;
  responsible_role: string | null;
  status: ActionStatus;
  source: 'ai' | 'rules' | 'manual';
  is_overdue: boolean;
  done_at: string | null;
  done_by: { id: number; name: string } | null;
  created_at: string | null;
  incident?: { id: number; reference: string; location: string; severity: Severity };
}

export interface DashboardSafety {
  incidents_mois: number;
  incidents_ytd: number;
  incidents_ouverts: number;
  near_miss_mois: number;
  near_miss_ytd: number;
  near_miss_ouverts: number;
  lti_ytd: number;
  taux_frequence: number;
  infractions_mois: number;
  infractions_ytd: number;
  infractions_ouverts: number;
}

export interface DashboardResponse {
  safety: DashboardSafety;
  generated_at: string;
}

export interface Activity {
  id: number;
  type: 'incident' | 'near_miss' | 'breach' | 'visitor' | 'property_damage';
  title: string;
  subtitle: string;
  severity: Severity | null;
  status: string;
  created_at: string | null;
}

export interface Zone {
  location: string;
  incidents: number;
  near_miss: number;
  breaches: number;
  total: number;
}

export interface IncidentStats {
  year: number;
  total: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  by_month: Record<string, number>;
  taux_frequence: number;
  lti_count: number;
}

export interface SafetyTracker {
  days_without_accident: number;
  best_streak_days: number;
  streak_start: string;
}

export interface AppNotification {
  id: string;
  type: string;
  data: {
    title?: string;
    body?: string;
    severity?: Severity | null;
    resource_kind?: string;
    resource_id?: number;
  };
  read_at: string | null;
  created_at: string;
}

export interface EmployeeLite {
  id: number;
  matricule: string | null;
  name: string;
  status: 'active' | 'inactive';
}
