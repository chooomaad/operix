/**
 * Matrice rôle → permissions, recopiée de operix-api (app/Support/Permissions.php).
 * La liste complète est renvoyée au mobile (`abilities`) : c'est elle qui grise
 * les boutons non autorisés. Le serveur re-vérifie chaque route.
 */
export const ROLES = ["company_admin", "hsse_manager", "supervisor", "agent"] as const;
export type Role = typeof ROLES[number];

const CA = "company_admin", HM = "hsse_manager", SV = "supervisor", AG = "agent";

export const MATRIX: Record<string, readonly string[]> = {
  "dashboard.view": [CA, HM, SV, AG],
  "search.use": [CA, HM, SV],
  "media.upload": [CA, HM, SV, AG],
  "notifications.view": [CA, HM, SV, AG],
  "notifications.send": [CA, HM],
  "incidents.view": [CA, HM, SV, AG],
  "incidents.create": [CA, HM, SV, AG],
  "incidents.update": [CA, HM, SV],
  "incidents.close": [CA, HM],
  "incidents.delete": [CA, HM],
  "near_miss.view": [CA, HM, SV, AG],
  "near_miss.create": [CA, HM, SV, AG],
  "near_miss.update": [CA, HM, SV],
  "near_miss.close": [CA, HM],
  "near_miss.delete": [CA, HM],
  "environment.view": [CA, HM, SV, AG],
  "environment.create": [CA, HM, SV, AG],
  "environment.update": [CA, HM, SV],
  "environment.close": [CA, HM],
  "environment.delete": [CA, HM],
  "property_damage.view": [CA, HM, SV, AG],
  "property_damage.create": [CA, HM, SV, AG],
  "property_damage.update": [CA, HM, SV],
  "property_damage.close": [CA, HM],
  "property_damage.delete": [CA, HM],
  "risks.view": [CA, HM, SV, AG],
  "risks.create": [CA, HM, SV],
  "risks.update": [CA, HM, SV],
  "risks.validate": [CA, HM],
  "risks.delete": [CA, HM],
  "employees.view": [CA, HM, SV],
  "employees.agent_search": [AG],
  "employees.manage": [CA, HM],
  "employees.pii.view": [CA, HM],
  "departments.view": [CA, HM, SV, AG],
  "departments.manage": [CA],
  "formations.manage": [CA, HM],
  "certifications.manage": [CA, HM],
  "medical_visits.manage": [CA, HM],
  "breaches.manage": [CA, HM],
  "visitors.manage": [CA, HM, SV],
  "contractors.manage": [CA, HM],
  "equipment.manage": [CA, HM],
  "permits.manage": [CA, HM],
  "safety_tracker.view": [CA, HM, SV],
  "safety_tracker.manage": [CA, HM],
  "reports.generate": [CA, HM, SV],
  "exports.generate": [CA, HM, SV],
  "imports.run": [CA, HM],
  "audit.view": [CA, HM],
  "users.manage": [CA],
  "settings.manage": [CA],
};

export function abilitiesFor(role: string): string[] {
  return Object.keys(MATRIX).filter((p) => MATRIX[p].includes(role)).sort();
}

export function roleCan(role: string, permission: string): boolean {
  return MATRIX[permission]?.includes(role) ?? false;
}

export function rolesFor(permission: string): string[] {
  return [...(MATRIX[permission] ?? [])];
}
