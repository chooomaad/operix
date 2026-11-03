import { analyze, normalize, PRIORITIES } from "../lib/ai.ts";
import { type Ctx, throttle } from "../lib/auth.ts";
import { db } from "../lib/db.ts";
import { type Body, forbidden, HttpError, json, notFound } from "../lib/http.ts";
import { iso } from "../lib/time.ts";
import { checkImage, Validator } from "../lib/validate.ts";
import { findIncident } from "./records.ts";

const ACTION_STATUSES = ["todo", "in_progress", "done"] as const;

interface ActionRow {
  id: number;
  incident_id: number;
  position: number;
  description: string;
  priority: string;
  delay_minutes: number | null;
  due_at: Date | null;
  responsible_role: string | null;
  status: string;
  source: string;
  done_at: Date | null;
  done_by: number | null;
  done_by_name: string | null;
  created_at: Date;
  inc_reference?: string;
  inc_location?: string;
  inc_severity?: string;
}

function format(a: ActionRow, withIncident = false) {
  return {
    id: a.id,
    incident_id: a.incident_id,
    position: a.position,
    description: a.description,
    priority: a.priority,
    delay_minutes: a.delay_minutes,
    due_at: iso(a.due_at),
    responsible_role: a.responsible_role,
    status: a.status,
    source: a.source,
    is_overdue: a.status !== "done" && a.due_at !== null && a.due_at.getTime() < Date.now(),
    done_at: iso(a.done_at),
    done_by: a.done_by && a.done_by_name !== null ? { id: a.done_by, name: a.done_by_name } : null,
    created_at: iso(a.created_at),
    ...(withIncident
      ? { incident: { id: a.incident_id, reference: a.inc_reference, location: a.inc_location, severity: a.inc_severity } }
      : {}),
  };
}

const SELECT = `
  select a.*, d.name as done_by_name
    from operix.incident_actions a
    left join operix.users d on d.id = a.done_by`;

/** POST /ai/incidents/analyze — analyse SANS écriture en base ; le déclarant valide ensuite. */
export async function analyzeIncident(ctx: Ctx, body: Body): Promise<Response> {
  ctx.require("incidents.create");
  await throttle(`ai:${ctx.user.id}`, 20, 60);
  const v = new Validator(body.fields);
  const description = v.string("description", { required: true, min: 10, max: 5000 });
  const location = v.string("location", { max: 255 });
  const eventType = v.oneOf("event_type", ["incident", "near_miss", "violation"] as const);
  const image = checkImage(v, "image", body.files.image);
  v.done();
  return json(await analyze({ description: description!, location: location ?? null, eventType: eventType ?? null, image }));
}

/** GET /incidents/{id}/actions */
export async function listIncidentActions(ctx: Ctx, incidentId: number): Promise<Response> {
  ctx.require("incidents.view");
  const sql = db();
  await findIncident(sql, ctx.tenant.id, incidentId);
  const rows = await sql.unsafe<ActionRow[]>(`${SELECT} where a.incident_id = $1 order by a.position, a.id`, [incidentId]);
  return json({ data: rows.map((r) => format(r)) });
}

/** GET /incident-actions — actions du site pour l'écran « Actions correctives ». */
export async function listOpenActions(ctx: Ctx, url: URL): Promise<Response> {
  ctx.require("incidents.view");
  const status = url.searchParams.get("status");
  const params: unknown[] = [ctx.tenant.id];
  let filter = "";
  if (status) {
    params.push(status);
    filter = " and a.status = $2";
  }
  const rows = await db().unsafe<ActionRow[]>(
    `select a.*, d.name as done_by_name, i.reference as inc_reference, i.location as inc_location, i.severity as inc_severity
       from operix.incident_actions a
       join operix.safety_incidents i on i.id = a.incident_id and i.deleted_at is null
       left join operix.users d on d.id = a.done_by
      where a.tenant_id = $1${filter}
      order by case a.status when 'in_progress' then 0 when 'todo' then 1 else 2 end, a.due_at nulls last
      limit 100`,
    params,
  );
  return json({ data: rows.map((r) => format(r, true)) });
}

/** POST /incidents/{id}/actions/deploy — fige l'analyse et crée le plan (une seule fois). */
export async function deployActions(ctx: Ctx, incidentId: number, body: Body): Promise<Response> {
  ctx.require("incidents.create");
  const v = new Validator(body.fields);
  const analysisIn = v.object("analysis", { required: true });
  const actionsIn = v.array("actions", { required: true, min: 1, max: 6 });
  const actions = (actionsIn ?? []).map((raw, i) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const av = new Validator(item);
    const out = {
      description: av.string("description", { required: true, max: 500 }),
      priority: av.oneOf("priority", PRIORITIES, { required: true }),
      delay_minutes: av.number("delay_minutes", { integer: true, min: 0, max: 43200 }),
      responsible_role: av.string("responsible_role", { max: 120 }),
    };
    for (const [field, messages] of Object.entries(av.errors)) {
      for (const m of messages) v.add(`actions.${i}.${field}`, m);
    }
    return out;
  });
  v.done();

  const sql = db();
  const incident = await findIncident(sql, ctx.tenant.id, incidentId);
  // Seul le déclarant (ou l'encadrement) valide le plan de SON incident.
  if (incident.reported_by !== ctx.user.id && !ctx.can("incidents.update")) {
    throw forbidden("Seul le déclarant peut déployer ce plan.");
  }

  const a = analysisIn!;
  const engine = a.engine === "ai" || a.engine === "rules" ? a.engine : "manual";
  const now = new Date();
  const analyzedAt = typeof a.analyzed_at === "string" && !Number.isNaN(Date.parse(a.analyzed_at)) ? a.analyzed_at : iso(now);
  const analysis = {
    ...normalize(a),
    engine,
    model: typeof a.model === "string" ? a.model : null,
    duration_ms: Math.trunc(Number(a.duration_ms) || 0),
    analyzed_at: analyzedAt,
    deployed_at: iso(now),
    deployed_by: ctx.user.id,
  };

  const created = await sql.begin(async (tx) => {
    // Verrou de ligne : deux déploiements simultanés ne créent pas deux plans.
    const [locked] = await tx<{ ai_analysis: unknown; immediate_cause: string | null; corrective_action: string | null; status: string }[]>`
      select ai_analysis, immediate_cause, corrective_action, status
        from operix.safety_incidents where id = ${incidentId} and tenant_id = ${ctx.tenant.id} for update`;
    if (locked.ai_analysis !== null) throw new HttpError(409, "Le plan de cet incident a déjà été déployé.");

    await tx`
      update operix.safety_incidents set
        ai_analysis       = ${tx.json(analysis as unknown as Parameters<typeof tx.json>[0])},
        immediate_cause   = ${locked.immediate_cause || analysis.causes[0] || null},
        corrective_action = ${locked.corrective_action || actions.map((x) => x.description).join("\n")},
        status            = ${locked.status === "open" ? "in_progress" : locked.status}
      where id = ${incidentId}`;

    for (const [i, x] of actions.entries()) {
      const delay = x.delay_minutes ?? null;
      await tx`
        insert into operix.incident_actions
          (tenant_id, incident_id, position, description, priority, delay_minutes, due_at, responsible_role, source, created_by)
        values
          (${ctx.tenant.id}, ${incidentId}, ${i}, ${x.description!}, ${x.priority!}, ${delay},
           ${delay === null ? null : new Date(now.getTime() + delay * 60_000)}, ${x.responsible_role ?? null}, ${engine}, ${ctx.user.id})`;
    }
    return await tx.unsafe<ActionRow[]>(`${SELECT} where a.incident_id = $1 order by a.position, a.id`, [incidentId]);
  }) as ActionRow[];

  return json({ analysis, data: created.map((r) => format(r)) }, 201);
}

/** PUT /incidents/{id}/actions/{actionId} — changement de statut (encadrement). */
export async function updateAction(ctx: Ctx, incidentId: number, actionId: number, body: Body): Promise<Response> {
  ctx.require("incidents.update");
  const v = new Validator(body.fields);
  const status = v.oneOf("status", ACTION_STATUSES, { required: true });
  v.done();

  const sql = db();
  const done = status === "done";
  const rows = await sql`
    update operix.incident_actions set
      status  = ${status!},
      done_at = ${done ? sql`coalesce(done_at, now())` : null},
      done_by = ${done ? sql`coalesce(done_by, ${ctx.user.id})` : null}
    where id = ${actionId} and incident_id = ${incidentId} and tenant_id = ${ctx.tenant.id}
    returning id`;
  if (rows.length === 0) throw notFound("Action introuvable.");
  const [row] = await sql.unsafe<ActionRow[]>(`${SELECT} where a.id = $1`, [actionId]);
  return json(format(row));
}
