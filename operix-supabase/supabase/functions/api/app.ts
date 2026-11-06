import { authenticate, type Ctx } from "./lib/auth.ts";
import { type Body, CORS_HEADERS, errorResponse, HttpError, json, readBody } from "./lib/http.ts";
import {
  createAdminEmployee,
  importAdminEmployees,
  createAdminUser,
  listAdminEmployees,
  listAdminSites,
  listAdminUsers,
  updateAdminEmployee,
  updateAdminUser,
} from "./routes/admin.ts";
import { analyzeIncident, deployActions, listIncidentActions, listOpenActions, updateAction } from "./routes/actions.ts";
import { login, logout, me } from "./routes/auth.ts";
import { agentEmployeeSearch, dashboard, incidentStats, listEmployees, recentActivity, safetyTracker, topZones } from "./routes/dashboard.ts";
import { listNotifications, markAllRead, markRead, unreadCount } from "./routes/notifications.ts";
import {
  createBreach,
  createIncident,
  createNearMiss,
  deleteIncident,
  deleteNearMiss,
  listIncidents,
  listNearMiss,
  showIncident,
  showNearMiss,
  updateIncident,
  updateNearMiss,
} from "./routes/records.ts";
import { incidentPdf } from "./routes/reports.ts";
import {
  createPlatformBreach,
  createPlatformCompany,
  deletePlatformBreach,
  listPlatformBreaches,
  listPlatformCompanies,
  platformTenantContext,
  suspendPlatformCompany,
  updatePlatformBreach,
  updatePlatformCompany,
} from "./routes/platform.ts";

/**
 * Routes /api/v1 utilisées par l'application mobile OPERIX, à l'identique de
 * l'ancienne API Laravel. Base URL côté mobile :
 *   https://<projet>.supabase.co/functions/v1/api/v1
 */

interface Req {
  req: Request;
  url: URL;
  params: string[];
  body: () => Promise<Body>;
}

type Handler = (r: Req, ctx: Ctx) => Promise<Response> | Response;

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

const ID = "(\\d+)";
const routes: Route[] = [];
const on = (method: string, path: string, handler: Handler) =>
  routes.push({ method, pattern: new RegExp(`^${path}/?$`), handler });

const num = (s: string) => Number(s);

// Auth
on("GET", "/auth/me", (_r, c) => me(c));
on("POST", "/auth/logout", (_r, c) => logout(c));

// Administration des utilisateurs (permission users.manage, périmètre société).
on("GET", "/admin/sites", (_r, c) => listAdminSites(c));
on("GET", "/admin/users", (r, c) => listAdminUsers(c, r.url));
on("POST", "/admin/users", async (r, c) => createAdminUser(c, await r.body()));
on("PUT", `/admin/users/${ID}`, async (r, c) => updateAdminUser(c, num(r.params[0]), await r.body()));
on("GET", "/admin/employees", (r, c) => listAdminEmployees(c, r.url));
on("POST", "/admin/employees", async (r, c) => createAdminEmployee(c, await r.body()));
on("POST", "/admin/employees/import", async (r, c) => importAdminEmployees(c, await r.body()));
on("PUT", `/admin/employees/${ID}`, async (r, c) => updateAdminEmployee(c, num(r.params[0]), await r.body()));

// Tableau de bord
on("GET", "/dashboard", (_r, c) => dashboard(c));
on("GET", "/dashboard/recent-activity", (_r, c) => recentActivity(c));
on("GET", "/dashboard/top-zones", (_r, c) => topZones(c));
on("GET", "/dashboard/incident-stats", (r, c) => incidentStats(c, r.url));
on("GET", "/safety-tracker", (r, c) => safetyTracker(c, r.url));

// Operix AI et plans d'actions
on("POST", "/ai/incidents/analyze", async (r, c) => analyzeIncident(c, await r.body()));
on("GET", "/incident-actions", (r, c) => listOpenActions(c, r.url));
on("GET", `/incidents/${ID}/actions`, (r, c) => listIncidentActions(c, num(r.params[0])));
on("POST", `/incidents/${ID}/actions/deploy`, async (r, c) => deployActions(c, num(r.params[0]), await r.body()));
on("PUT", `/incidents/${ID}/actions/${ID}`, async (r, c) => updateAction(c, num(r.params[0]), num(r.params[1]), await r.body()));

// Incidents
on("GET", "/incidents", (r, c) => listIncidents(c, r.url));
on("POST", "/incidents", async (r, c) => createIncident(c, await r.body()));
on("GET", `/incidents/${ID}`, (r, c) => showIncident(c, num(r.params[0])));
on("PUT", `/incidents/${ID}`, async (r, c) => updateIncident(c, num(r.params[0]), await r.body()));

// Near-miss et infractions
on("GET", "/near-miss", (r, c) => listNearMiss(c, r.url));
on("POST", "/near-miss", async (r, c) => createNearMiss(c, await r.body()));
on("GET", `/near-miss/${ID}`, (r, c) => showNearMiss(c, num(r.params[0])));
on("POST", "/breaches", async (r, c) => createBreach(c, await r.body()));

// Administration plateforme : la société cible est explicite et résolue côté serveur.
on("GET", "/platform/companies", (_r, c) => listPlatformCompanies(c));
on("POST", "/platform/companies", async (r, c) => createPlatformCompany(c, await r.body()));
on("PUT", `/platform/companies/${ID}`, async (r, c) => updatePlatformCompany(c, num(r.params[0]), await r.body()));
on("DELETE", `/platform/companies/${ID}`, (r, c) => suspendPlatformCompany(c, num(r.params[0])));
on("GET", `/platform/companies/${ID}/users`, async (r, c) => listAdminUsers(await platformTenantContext(c, num(r.params[0])), r.url));
on("POST", `/platform/companies/${ID}/users`, async (r, c) => createAdminUser(await platformTenantContext(c, num(r.params[0])), await r.body()));
on("PUT", `/platform/companies/${ID}/users/${ID}`, async (r, c) => updateAdminUser(await platformTenantContext(c, num(r.params[0])), num(r.params[1]), await r.body()));
on("GET", `/platform/companies/${ID}/employees`, async (r, c) => listAdminEmployees(await platformTenantContext(c, num(r.params[0])), r.url));
on("POST", `/platform/companies/${ID}/employees`, async (r, c) => createAdminEmployee(await platformTenantContext(c, num(r.params[0])), await r.body()));
on("POST", `/platform/companies/${ID}/employees/import`, async (r, c) => importAdminEmployees(await platformTenantContext(c, num(r.params[0])), await r.body()));
on("PUT", `/platform/companies/${ID}/employees/${ID}`, async (r, c) => updateAdminEmployee(await platformTenantContext(c, num(r.params[0])), num(r.params[1]), await r.body()));
on("GET", `/platform/companies/${ID}/incidents`, async (r, c) => listIncidents(await platformTenantContext(c, num(r.params[0])), r.url));
on("POST", `/platform/companies/${ID}/incidents`, async (r, c) => createIncident(await platformTenantContext(c, num(r.params[0])), await r.body()));
on("GET", `/platform/companies/${ID}/incidents/${ID}`, async (r, c) => showIncident(await platformTenantContext(c, num(r.params[0])), num(r.params[1])));
on("PUT", `/platform/companies/${ID}/incidents/${ID}`, async (r, c) => updateIncident(await platformTenantContext(c, num(r.params[0])), num(r.params[1]), await r.body()));
on("DELETE", `/platform/companies/${ID}/incidents/${ID}`, async (r, c) => deleteIncident(await platformTenantContext(c, num(r.params[0])), num(r.params[1])));
on("GET", `/platform/companies/${ID}/near-miss`, async (r, c) => listNearMiss(await platformTenantContext(c, num(r.params[0])), r.url));
on("POST", `/platform/companies/${ID}/near-miss`, async (r, c) => createNearMiss(await platformTenantContext(c, num(r.params[0])), await r.body()));
on("GET", `/platform/companies/${ID}/near-miss/${ID}`, async (r, c) => showNearMiss(await platformTenantContext(c, num(r.params[0])), num(r.params[1])));
on("PUT", `/platform/companies/${ID}/near-miss/${ID}`, async (r, c) => updateNearMiss(await platformTenantContext(c, num(r.params[0])), num(r.params[1]), await r.body()));
on("DELETE", `/platform/companies/${ID}/near-miss/${ID}`, async (r, c) => deleteNearMiss(await platformTenantContext(c, num(r.params[0])), num(r.params[1])));
on("GET", `/platform/companies/${ID}/breaches`, async (r, c) => listPlatformBreaches(await platformTenantContext(c, num(r.params[0])), r.url));
on("POST", `/platform/companies/${ID}/breaches`, async (r, c) => createPlatformBreach(await platformTenantContext(c, num(r.params[0])), await r.body()));
on("PUT", `/platform/companies/${ID}/breaches/${ID}`, async (r, c) => updatePlatformBreach(await platformTenantContext(c, num(r.params[0])), num(r.params[1]), await r.body()));
on("DELETE", `/platform/companies/${ID}/breaches/${ID}`, async (r, c) => deletePlatformBreach(await platformTenantContext(c, num(r.params[0])), num(r.params[1])));

// Notifications
on("GET", "/notifications", (r, c) => listNotifications(c, r.url));
on("GET", "/notifications/unread-count", (_r, c) => unreadCount(c));
on("PUT", "/notifications/([0-9a-fA-F-]+)/read", (r, c) => markRead(c, r.params[0]));
on("POST", "/notifications/read-all", (_r, c) => markAllRead(c));

// Employés
on("GET", "/agent/employees/search", (r, c) => agentEmployeeSearch(c, r.url));
on("GET", "/employees", (r, c) => listEmployees(c, r.url));

// Rapports
on("GET", `/reports/incidents/${ID}`, (_r, c) => incidentPdf(c, num(_r.params[0])));

/**
 * Chemin de route à partir de l'URL reçue. Supabase transmet `/api/...` (nom de
 * la fonction en tête) ; on accepte aussi `/functions/v1/api/...` et l'absence
 * de préfixe `/v1`, pour le développement local.
 */
export function routePath(pathname: string): string {
  let p = pathname.replace(/^\/functions\/v1/, "");
  p = p.replace(/^\/api(?=\/|$)/, "");
  p = p.replace(/^\/v1(?=\/|$)/, "");
  return p || "/";
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  const url = new URL(req.url);
  const path = routePath(url.pathname);
  let bodyPromise: Promise<Body> | null = null;
  const body = () => (bodyPromise ??= readBody(req));

  try {
    if (path === "/health" && req.method === "GET") return json({ status: "ok" });
    // Seule route publique.
    if (path === "/auth/login" && req.method === "POST") return await login(req, await body());

    let matched: { route: Route; params: string[] } | null = null;
    let pathExists = false;
    for (const route of routes) {
      const m = route.pattern.exec(path);
      if (!m) continue;
      pathExists = true;
      if (route.method === req.method) {
        matched = { route, params: m.slice(1) };
        break;
      }
    }
    if (!matched) {
      if (pathExists) throw new HttpError(405, "Méthode non autorisée.");
      throw new HttpError(404, "Route introuvable.");
    }

    const ctx = await authenticate(req);
    return await matched.route.handler({ req, url, params: matched.params, body }, ctx);
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e);
    console.error(`[${req.method} ${path}]`, e);
    return json({ message: "Erreur serveur." }, 500);
  }
}
