import { type Ctx, throttle } from "../lib/auth.ts";
import { db } from "../lib/db.ts";
import { HttpError, json } from "../lib/http.ts";
import { pageMeta, pageParams } from "../lib/paging.ts";
import { addDays, daysBetween, iso, todayYmd } from "../lib/time.ts";
import { Validator } from "../lib/validate.ts";

/** Taux de fréquence : accidents avec arrêt × 10⁶ / heures travaillées (200 j × 8 h). */
function tauxFrequence(lti: number, employees: number): number {
  return employees > 0 ? Math.round(((lti * 1_000_000) / (employees * 200 * 8)) * 100) / 100 : 0;
}

/** GET /dashboard — seul le bloc `safety` (et employees) est servi : c'est ce que lit le mobile. */
export async function dashboard(ctx: Ctx): Promise<Response> {
  ctx.require("dashboard.view");
  const sql = db();
  const t = ctx.tenant.id;
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const [k] = await sql<Record<string, number>[]>`
    select
      (select count(*) from operix.safety_incidents where tenant_id = ${t} and deleted_at is null
          and extract(year from date) = ${year} and extract(month from date) = ${month})::int as incidents_mois,
      (select count(*) from operix.safety_incidents where tenant_id = ${t} and deleted_at is null
          and extract(year from date) = ${year})::int as incidents_ytd,
      (select count(*) from operix.safety_incidents where tenant_id = ${t} and deleted_at is null
          and status = 'open')::int as incidents_ouverts,
      (select count(*) from operix.safety_near_miss where tenant_id = ${t} and deleted_at is null
          and extract(year from date) = ${year} and extract(month from date) = ${month})::int as near_miss_mois,
      (select count(*) from operix.safety_near_miss where tenant_id = ${t} and deleted_at is null
          and extract(year from date) = ${year})::int as near_miss_ytd,
      (select count(*) from operix.safety_near_miss where tenant_id = ${t} and deleted_at is null
          and status = 'open')::int as near_miss_ouverts,
      (select count(*) from operix.safety_incidents where tenant_id = ${t} and deleted_at is null
          and extract(year from date) = ${year} and type = 'LTI')::int as lti_ytd,
      (select count(*) from operix.breaches where tenant_id = ${t} and deleted_at is null
          and extract(year from date) = ${year} and extract(month from date) = ${month})::int as infractions_mois,
      (select count(*) from operix.breaches where tenant_id = ${t} and deleted_at is null
          and extract(year from date) = ${year})::int as infractions_ytd,
      (select count(*) from operix.breaches where tenant_id = ${t} and deleted_at is null
          and status = 'open')::int as infractions_ouverts,
      (select count(*) from operix.employees where tenant_id = ${t})::int as emp_total,
      (select count(*) from operix.employees where tenant_id = ${t} and is_active)::int as emp_actifs`;

  return json({
    employees: { total: k.emp_total, actifs: k.emp_actifs },
    safety: {
      incidents_mois: k.incidents_mois,
      incidents_ytd: k.incidents_ytd,
      incidents_ouverts: k.incidents_ouverts,
      near_miss_mois: k.near_miss_mois,
      near_miss_ytd: k.near_miss_ytd,
      near_miss_ouverts: k.near_miss_ouverts,
      lti_ytd: k.lti_ytd,
      taux_frequence: tauxFrequence(k.lti_ytd, k.emp_actifs),
      infractions_mois: k.infractions_mois,
      infractions_ytd: k.infractions_ytd,
      infractions_ouverts: k.infractions_ouverts,
    },
    generated_at: iso(now),
  });
}

/** GET /dashboard/recent-activity — 5 derniers de chaque registre, 15 au total. */
export async function recentActivity(ctx: Ctx): Promise<Response> {
  ctx.require("dashboard.view");
  const rows = await db()<{ id: number; type: string; title: string; subtitle: string; severity: string | null; status: string; created_at: Date; link: string }[]>`
    (select id, 'incident' as type, reference || ' — ' || type as title, coalesce(location, '') as subtitle,
            severity, status, created_at, '/incidents/' || id as link
       from operix.safety_incidents where tenant_id = ${ctx.tenant.id} and deleted_at is null
      order by created_at desc limit 5)
    union all
    (select id, 'near_miss', reference || ' — Presqu''accident', coalesce(location, ''),
            severity, status, created_at, '/near-miss/' || id
       from operix.safety_near_miss where tenant_id = ${ctx.tenant.id} and deleted_at is null
      order by created_at desc limit 5)
    union all
    (select id, 'breach', reference || ' — ' || type, coalesce(location, ''),
            severity, status, created_at, '/breaches/' || id
       from operix.breaches where tenant_id = ${ctx.tenant.id} and deleted_at is null
      order by created_at desc limit 5)
    order by created_at desc
    limit 15`;
  const icons: Record<string, string> = { incident: "fire", near_miss: "warning", breach: "shield" };
  return json({
    activities: rows.map((r) => ({ ...r, icon: icons[r.type], created_at: iso(r.created_at) })),
  });
}

/** GET /dashboard/top-zones — lieux les plus concernés, tous registres confondus. */
export async function topZones(ctx: Ctx): Promise<Response> {
  ctx.require("dashboard.view");
  const t = ctx.tenant.id;
  const rows = await db()<{ location: string; incidents: number; near_miss: number; breaches: number; total: number }[]>`
    with i as (select location, count(*)::int n from operix.safety_incidents
                where tenant_id = ${t} and deleted_at is null and coalesce(location, '') <> ''
                group by location order by n desc limit 10),
         m as (select location, count(*)::int n from operix.safety_near_miss
                where tenant_id = ${t} and deleted_at is null and coalesce(location, '') <> ''
                group by location order by n desc limit 10),
         b as (select location, count(*)::int n from operix.breaches
                where tenant_id = ${t} and deleted_at is null and coalesce(location, '') <> ''
                group by location order by n desc limit 10),
         locs as (select location from i union select location from m union select location from b)
    select l.location,
           coalesce(i.n, 0) as incidents, coalesce(m.n, 0) as near_miss, coalesce(b.n, 0) as breaches,
           (coalesce(i.n, 0) + coalesce(m.n, 0) + coalesce(b.n, 0))::int as total
      from locs l
      left join i on i.location = l.location
      left join m on m.location = l.location
      left join b on b.location = l.location
     order by total desc, l.location
     limit 8`;
  return json({ zones: rows });
}

/** GET /dashboard/incident-stats?year= */
export async function incidentStats(ctx: Ctx, url: URL): Promise<Response> {
  ctx.require("dashboard.view");
  const sql = db();
  const t = ctx.tenant.id;
  const yearParam = url.searchParams.get("year");
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : new Date().getUTCFullYear();

  const groups = await sql<{ dim: string; key: string; total: number }[]>`
    select 'type' as dim, type as key, count(*)::int as total from operix.safety_incidents
     where tenant_id = ${t} and deleted_at is null and extract(year from date) = ${year} group by type
    union all
    select 'severity', severity, count(*)::int from operix.safety_incidents
     where tenant_id = ${t} and deleted_at is null and extract(year from date) = ${year} group by severity
    union all
    select 'status', status, count(*)::int from operix.safety_incidents
     where tenant_id = ${t} and deleted_at is null and extract(year from date) = ${year} group by status
    union all
    select 'month', to_char(date, 'MM'), count(*)::int from operix.safety_incidents
     where tenant_id = ${t} and deleted_at is null and extract(year from date) = ${year} group by to_char(date, 'MM')
    order by 1, 2`;
  const pick = (dim: string) => Object.fromEntries(groups.filter((g) => g.dim === dim).map((g) => [g.key, g.total]));
  const byType = pick("type");
  const total = Object.values(byType).reduce((s, n) => s + n, 0);
  const lti = byType.LTI ?? 0;
  const [{ emp }] = await sql<{ emp: number }[]>`select count(*)::int as emp from operix.employees where tenant_id = ${t} and is_active`;

  return json({
    year,
    total,
    by_type: byType,
    by_severity: pick("severity"),
    by_status: pick("status"),
    by_month: pick("month"),
    taux_frequence: tauxFrequence(lti, emp),
    lti_count: lti,
  });
}

/** GET /safety-tracker — jours sans accident avec arrêt (encadrement). */
export async function safetyTracker(ctx: Ctx, url: URL): Promise<Response> {
  ctx.require("safety_tracker.view");
  const sql = db();
  const t = ctx.tenant.id;
  const today = todayYmd();
  const yearParam = url.searchParams.get("year");
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : new Date().getUTCFullYear();
  const startOfYear = `${today.slice(0, 4)}-01-01`;

  const ltiRows = await sql<{ id: number; reference: string; date: string; type: string; severity: string; location: string }[]>`
    select id, reference, date, type, severity, location from operix.safety_incidents
     where tenant_id = ${t} and deleted_at is null and type = 'LTI'
     order by date desc`;
  const lastLti = ltiRows[0] ?? null;

  // Départ du compteur = le plus récent entre le lendemain du dernier LTI et la date
  // de référence fixée par l'encadrement (tenant.settings.safety_tracker_start_date).
  const rawBaseline = ctx.tenant.settings?.safety_tracker_start_date;
  const baseline = typeof rawBaseline === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawBaseline) ? rawBaseline.slice(0, 10) : null;
  let start: string | null = lastLti ? addDays(lastLti.date, 1) : null;
  if (baseline && (start === null || baseline > start)) start = baseline;
  start ??= startOfYear;

  // Meilleure série depuis la référence (ou le 1er janvier).
  const floor = baseline ?? startOfYear;
  const dates = ltiRows.map((r) => r.date).filter((d) => d >= floor).sort();
  let best = 0;
  let prev = floor;
  for (const d of dates) {
    best = Math.max(best, daysBetween(prev, d));
    prev = addDays(d, 1);
  }
  best = Math.max(best, daysBetween(prev, today));

  const monthly = await sql<{ month: string; incidents: number; lti: number }[]>`
    select to_char(date, 'MM') as month, count(*)::int as incidents, count(*) filter (where type = 'LTI')::int as lti
      from operix.safety_incidents
     where tenant_id = ${t} and deleted_at is null and extract(year from date) = ${year}
     group by 1`;
  const monthlyData: Record<string, { incidents: number; lti: number }> = {};
  for (let m = 1; m <= 12; m++) {
    const key = String(m).padStart(2, "0");
    const row = monthly.find((r) => r.month === key);
    monthlyData[key] = { incidents: row?.incidents ?? 0, lti: row?.lti ?? 0 };
  }
  const totalYtd = Object.values(monthlyData).reduce((s, x) => s + x.incidents, 0);
  const ltiYtd = Object.values(monthlyData).reduce((s, x) => s + x.lti, 0);
  const [{ emp }] = await sql<{ emp: number }[]>`select count(*)::int as emp from operix.employees where tenant_id = ${t} and is_active`;

  return json({
    days_without_accident: Math.max(0, daysBetween(start, today)),
    last_incident: lastLti,
    streak_start: start,
    best_streak_days: Math.max(0, best),
    year,
    monthly_data: monthlyData,
    kpis: {
      total_incidents_ytd: totalYtd,
      lti_ytd: ltiYtd,
      taux_frequence: tauxFrequence(ltiYtd, emp),
      taux_gravite: emp > 0 ? Math.round(((totalYtd * 1_000) / (emp * 200 * 8)) * 100) / 100 : 0,
      employee_count: emp,
    },
  });
}

// ── Employés ────────────────────────────────────────────────────────────────

/** GET /agent/employees/search?q= — recherche minimale pour l'agent terrain. */
export async function agentEmployeeSearch(ctx: Ctx, url: URL): Promise<Response> {
  ctx.require("employees.agent_search");
  await throttle(`emp-search:${ctx.user.id}`, 30, 60);
  const v = new Validator({ q: url.searchParams.get("q") ?? undefined });
  const q = v.string("q", { required: true, min: 2, max: 100 });
  v.done();
  const like = `%${q}%`;
  const rows = await db()<{ id: number; matricule: string | null; nom: string; prenom: string; is_active: boolean }[]>`
    select id, matricule, nom, prenom, is_active from operix.employees
     where tenant_id = ${ctx.tenant.id}
       and (matricule ilike ${like} or nom ilike ${like} or prenom ilike ${like} or (prenom || ' ' || nom) ilike ${like})
     order by matricule asc nulls last, nom
     limit 20`;
  // `id` en plus du format Laravel : l'écran Employés du mobile l'utilise comme clé de liste.
  return json({
    data: rows.map((e) => ({ id: e.id, matricule: e.matricule, name: `${e.prenom} ${e.nom}`.trim(), status: e.is_active ? "active" : "inactive" })),
  });
}

/** GET /employees — module complet, encadrement. */
export async function listEmployees(ctx: Ctx, url: URL): Promise<Response> {
  ctx.require("employees.view");
  const sql = db();
  const { perPage, page, offset } = pageParams(url);
  const search = url.searchParams.get("search")?.trim();
  if (search && search.length > 100) throw new HttpError(422, "Recherche trop longue.");
  const like = search ? `%${search}%` : null;
  const filter = like
    ? sql`and (e.matricule ilike ${like} or e.nom ilike ${like} or e.prenom ilike ${like} or (e.prenom || ' ' || e.nom) ilike ${like})`
    : sql``;
  const [{ total }] = await sql<{ total: number }[]>`
    select count(*)::int as total from operix.employees e where e.tenant_id = ${ctx.tenant.id} ${filter}`;
  const rows = await sql<Record<string, unknown>[]>`
    select e.id, e.matricule, e.nom, e.prenom, e.poste, e.type_contrat, e.date_embauche, e.is_active,
           e.department_id, d.name as department_name
      from operix.employees e
      left join operix.departments d on d.id = e.department_id
     where e.tenant_id = ${ctx.tenant.id} ${filter}
     order by e.nom, e.prenom
     limit ${perPage} offset ${offset}`;
  return json({
    data: rows.map(({ department_id, department_name, ...e }) => ({
      ...e,
      department: department_id ? { id: department_id, name: department_name } : null,
    })),
    meta: pageMeta(total, perPage, page),
  });
}
