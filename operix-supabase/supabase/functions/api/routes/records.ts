import type { Ctx } from "../lib/auth.ts";
import { db, type Db } from "../lib/db.ts";
import { type Body, json, notFound } from "../lib/http.ts";
import { INCIDENT_TYPES, RISK_LEVELS } from "../lib/ai.ts";
import { deleteFiles, signedUrls, storeFile } from "../lib/storage.ts";
import { iso, ymdHi } from "../lib/time.ts";
import { pageMeta, pageParams } from "../lib/paging.ts";
import { checkImage, Validator } from "../lib/validate.ts";
import { notifyHseEvent } from "./notifications.ts";

const STATUSES = ["open", "in_progress", "closed"] as const;
const NEAR_MISS_SEVERITIES = ["low", "medium", "high"] as const;
const MAX_ACCURACY_METERS = 5000;

// ── Lignes et formats de réponse ────────────────────────────────────────────

interface GeoRow {
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_captured_at: Date | null;
}

interface RecordRow extends GeoRow {
  id: number;
  reference: string;
  date: string;
  time: string | null;
  location: string;
  severity: string;
  description: string;
  corrective_action: string | null;
  corrective_action_due: string | null;
  status: string;
  image: string | null;
  reported_by: number | null;
  reporter_name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface IncidentRow extends RecordRow {
  type: string;
  immediate_cause: string | null;
  root_cause: string | null;
  ai_analysis: Record<string, unknown> | null;
}

export interface NearMissRow extends RecordRow {
  potential_consequence: string | null;
}

function locationPoint(r: GeoRow) {
  if (r.latitude === null) return null;
  return { latitude: r.latitude, longitude: r.longitude, accuracy: r.location_accuracy, captured_at: iso(r.location_captured_at) };
}

function geoFromRecord(row: Record<string, unknown>): GeoRow {
  return {
    latitude: typeof row.latitude === "number" ? row.latitude : null,
    longitude: typeof row.longitude === "number" ? row.longitude : null,
    location_accuracy: typeof row.location_accuracy === "number" ? row.location_accuracy : null,
    location_captured_at: row.location_captured_at instanceof Date ? row.location_captured_at : null,
  };
}

function common(r: RecordRow) {
  return {
    id: r.id,
    reference: r.reference,
    date: r.date,
    time: r.time,
    location: r.location,
  };
}

function tail(r: RecordRow, urls: Map<string, string>) {
  return {
    corrective_action: r.corrective_action,
    corrective_action_due: r.corrective_action_due,
    status: r.status,
    involved_people: [] as unknown[],
    image: r.image,
    image_url: r.image ? urls.get(r.image) ?? null : null,
    report_file: null,
    report_file_url: null,
    ...(r.reported_by && r.reporter_name !== null ? { reported_by: { id: r.reported_by, name: r.reporter_name } } : {}),
    location_point: locationPoint(r),
  };
}

export function incidentResource(r: IncidentRow, urls: Map<string, string>, actions?: { total: number; done: number }) {
  return {
    ...common(r),
    type: r.type,
    severity: r.severity,
    description: r.description,
    immediate_cause: r.immediate_cause,
    root_cause: r.root_cause,
    ...tail(r, urls),
    closure_report: null,
    closure_report_url: null,
    ai_analysis: r.ai_analysis,
    ...(actions ? { actions_summary: actions } : {}),
    created_at: ymdHi(r.created_at),
    created_at_iso: iso(r.created_at),
    updated_at: ymdHi(r.updated_at),
  };
}

export function nearMissResource(r: NearMissRow, urls: Map<string, string>) {
  return {
    ...common(r),
    severity: r.severity,
    description: r.description,
    potential_consequence: r.potential_consequence,
    ...tail(r, urls),
    created_at: ymdHi(r.created_at),
    updated_at: ymdHi(r.updated_at),
  };
}

// ── Références INC-2026-0001 (verrou par entreprise, préfixe et année) ──────

async function nextReference(tx: Db, tenantId: number, prefix: "INC" | "NM" | "INF", table: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  await tx`select pg_advisory_xact_lock(hashtext(${`${tenantId}:${prefix}:${year}`}))`;
  const pattern = `^${prefix}-${year}-[0-9]+$`;
  const offset = `${prefix}-${year}-`.length + 1;
  // Le MAX numérique (et non un count) : robuste aux suppressions et au-delà de 9999.
  const [{ m }] = await tx.unsafe<{ m: number | null }[]>(
    `select max(cast(substr(reference, $1) as integer)) as m from operix.${table} where tenant_id = $2 and reference ~ $3`,
    [offset, tenantId, pattern],
  );
  return `${prefix}-${year}-${String((m ?? 0) + 1).padStart(4, "0")}`;
}

// ── Champs communs (ValidatesGeolocation) ───────────────────────────────────

function geoFields(v: Validator) {
  const latitude = v.number("latitude", { min: -90, max: 90 });
  const longitude = v.number("longitude", { min: -180, max: 180 });
  if ((latitude ?? null) === null && (longitude ?? null) !== null) v.add("latitude", "Le champ latitude est obligatoire quand longitude est présent.");
  if ((longitude ?? null) === null && (latitude ?? null) !== null) v.add("longitude", "Le champ longitude est obligatoire quand latitude est présent.");
  const location_accuracy = v.number("location_accuracy", { min: 0, max: MAX_ACCURACY_METERS });
  // L'horloge de l'appareil peut dériver : on tolère 5 minutes d'avance, pas de borne dans le passé
  // (une déclaration hors-ligne synchronisée plus tard porte une capture ancienne).
  const location_captured_at = v.dateTime("location_captured_at", { notAfter: new Date(Date.now() + 5 * 60_000) });
  return { latitude, longitude, location_accuracy, location_captured_at };
}

function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// ── Lecture ─────────────────────────────────────────────────────────────────

const INCIDENT_SELECT = `
  select i.*, u.name as reporter_name
    from operix.safety_incidents i
    left join operix.users u on u.id = i.reported_by`;

const NEAR_MISS_SELECT = `
  select n.*, u.name as reporter_name
    from operix.safety_near_miss n
    left join operix.users u on u.id = n.reported_by`;

export async function findIncident(sql: Db, tenantId: number, id: number): Promise<IncidentRow> {
  const [row] = await sql.unsafe<IncidentRow[]>(`${INCIDENT_SELECT} where i.tenant_id = $1 and i.id = $2 and i.deleted_at is null`, [tenantId, id]);
  if (!row) throw notFound("Incident introuvable.");
  return row;
}

async function findNearMiss(sql: Db, tenantId: number, id: number): Promise<NearMissRow> {
  const [row] = await sql.unsafe<NearMissRow[]>(`${NEAR_MISS_SELECT} where n.tenant_id = $1 and n.id = $2 and n.deleted_at is null`, [tenantId, id]);
  if (!row) throw notFound("Presqu'accident introuvable.");
  return row;
}

/** Filtres communs de liste (search, severity, status, from, to [, type]). */
function listFilters(url: URL, alias: string, withType: boolean, searchReference: boolean) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length + 1}`; // $1 est réservé au tenant
  };
  const q = url.searchParams;
  const search = q.get("search")?.trim();
  if (search) {
    const like = p(`%${search}%`);
    const parts = [`${alias}.description ilike ${like}`, `${alias}.location ilike ${like}`];
    if (searchReference) parts.push(`${alias}.reference ilike ${like}`);
    clauses.push(`(${parts.join(" or ")})`);
  }
  if (withType && q.get("type")) clauses.push(`${alias}.type = ${p(q.get("type"))}`);
  if (q.get("severity")) clauses.push(`${alias}.severity = ${p(q.get("severity"))}`);
  if (q.get("status")) clauses.push(`${alias}.status = ${p(q.get("status"))}`);
  for (const [key, op] of [["from", ">="], ["to", "<="]] as const) {
    const d = q.get(key)?.trim();
    if (d && /^\d{4}-\d{2}-\d{2}/.test(d)) clauses.push(`${alias}.date ${op} ${p(d.slice(0, 10))}::date`);
  }
  return { where: clauses.map((c) => ` and ${c}`).join(""), params };
}

// ── Incidents ───────────────────────────────────────────────────────────────

export async function listIncidents(ctx: Ctx, url: URL): Promise<Response> {
  ctx.require("incidents.view");
  const sql = db();
  const { perPage, page, offset } = pageParams(url);
  const f = listFilters(url, "i", true, true);
  const base = `from operix.safety_incidents i where i.tenant_id = $1 and i.deleted_at is null${f.where}`;
  const [{ total }] = await sql.unsafe<{ total: number }[]>(`select count(*)::int as total ${base}`, [ctx.tenant.id, ...f.params]);
  const rows = await sql.unsafe<IncidentRow[]>(
    `select i.*, u.name as reporter_name from operix.safety_incidents i left join operix.users u on u.id = i.reported_by
      where i.tenant_id = $1 and i.deleted_at is null${f.where}
      order by i.date desc, i.id desc limit ${perPage} offset ${offset}`,
    [ctx.tenant.id, ...f.params],
  );
  const urls = await signedUrls(rows.map((r) => r.image));
  return json({ data: rows.map((r) => incidentResource(r, urls)), meta: pageMeta(total, perPage, page) });
}

export async function showIncident(ctx: Ctx, id: number): Promise<Response> {
  ctx.require("incidents.view");
  const sql = db();
  const row = await findIncident(sql, ctx.tenant.id, id);
  const [summary] = await sql<{ total: number; done: number }[]>`
    select count(*)::int as total, count(*) filter (where status = 'done')::int as done
      from operix.incident_actions where incident_id = ${id}`;
  const urls = await signedUrls([row.image]);
  return json(incidentResource(row, urls, summary));
}

export async function createIncident(ctx: Ctx, body: Body): Promise<Response> {
  ctx.require("incidents.create");
  const v = new Validator(body.fields);
  const data = {
    date: v.date("date", { required: true }),
    time: v.string("time", { max: 20 }),
    location: v.string("location", { required: true, max: 255 }),
    type: v.oneOf("type", INCIDENT_TYPES, { required: true }),
    severity: v.oneOf("severity", RISK_LEVELS, { required: true }),
    description: v.string("description", { required: true, max: 10000 }),
    immediate_cause: v.string("immediate_cause", { max: 5000 }),
    root_cause: v.string("root_cause", { max: 5000 }),
    corrective_action: v.string("corrective_action", { max: 5000 }),
    corrective_action_due: v.date("corrective_action_due"),
    status: v.oneOf("status", STATUSES) ?? undefined,
    ...geoFields(v),
  };
  const image = checkImage(v, "image", body.files.image);
  v.done();

  const imagePath = image ? await storeFile(ctx.tenant.id, "incidents", image) : null;
  let row: IncidentRow;
  try {
    row = await db().begin(async (tx) => {
      const reference = await nextReference(tx, ctx.tenant.id, "INC", "safety_incidents");
      const values = compact({ ...data, tenant_id: ctx.tenant.id, reference, image: imagePath, reported_by: ctx.user.id });
      const [created] = await tx<{ id: number }[]>`insert into operix.safety_incidents ${tx(values)} returning id`;
      await notifyHseEvent(tx, ctx, "incident", { id: created.id, reference, type: data.type!, severity: data.severity!, location: data.location! });
      return await findIncident(tx, ctx.tenant.id, created.id);
    }) as IncidentRow;
  } catch (e) {
    if (imagePath) await deleteFiles([imagePath]);
    throw e;
  }
  return json(incidentResource(row, await signedUrls([row.image])), 201);
}

export async function updateIncident(ctx: Ctx, id: number, body: Body): Promise<Response> {
  ctx.require("incidents.update");
  const sql = db();
  await findIncident(sql, ctx.tenant.id, id);
  const v = new Validator(body.fields);
  const changes = compact({
    date: v.has("date") ? v.date("date", { required: true }) : undefined,
    time: v.string("time", { max: 20 }),
    location: v.has("location") ? v.string("location", { required: true, max: 255 }) : undefined,
    type: v.has("type") ? v.oneOf("type", INCIDENT_TYPES, { required: true }) : undefined,
    severity: v.has("severity") ? v.oneOf("severity", RISK_LEVELS, { required: true }) : undefined,
    description: v.has("description") ? v.string("description", { required: true, max: 10000 }) : undefined,
    immediate_cause: v.string("immediate_cause", { max: 5000 }),
    root_cause: v.string("root_cause", { max: 5000 }),
    corrective_action: v.string("corrective_action", { max: 5000 }),
    corrective_action_due: v.date("corrective_action_due"),
    status: v.has("status") ? v.oneOf("status", STATUSES, { required: true }) : undefined,
    ...geoFields(v),
  });
  v.done();
  if (changes.status === "closed") ctx.require("incidents.close");
  if (Object.keys(changes).length > 0) {
    await sql`update operix.safety_incidents set ${sql(changes)} where id = ${id} and tenant_id = ${ctx.tenant.id}`;
  }
  const row = await findIncident(sql, ctx.tenant.id, id);
  return json(incidentResource(row, await signedUrls([row.image])));
}

// ── Near-miss ───────────────────────────────────────────────────────────────

export async function listNearMiss(ctx: Ctx, url: URL): Promise<Response> {
  ctx.require("near_miss.view");
  const sql = db();
  const { perPage, page, offset } = pageParams(url);
  const f = listFilters(url, "n", false, false);
  const [{ total }] = await sql.unsafe<{ total: number }[]>(
    `select count(*)::int as total from operix.safety_near_miss n where n.tenant_id = $1 and n.deleted_at is null${f.where}`,
    [ctx.tenant.id, ...f.params],
  );
  const rows = await sql.unsafe<NearMissRow[]>(
    `${NEAR_MISS_SELECT} where n.tenant_id = $1 and n.deleted_at is null${f.where}
      order by n.date desc, n.id desc limit ${perPage} offset ${offset}`,
    [ctx.tenant.id, ...f.params],
  );
  const urls = await signedUrls(rows.map((r) => r.image));
  return json({ data: rows.map((r) => nearMissResource(r, urls)), meta: pageMeta(total, perPage, page) });
}

export async function showNearMiss(ctx: Ctx, id: number): Promise<Response> {
  ctx.require("near_miss.view");
  const row = await findNearMiss(db(), ctx.tenant.id, id);
  return json(nearMissResource(row, await signedUrls([row.image])));
}

export async function createNearMiss(ctx: Ctx, body: Body): Promise<Response> {
  ctx.require("near_miss.create");
  const v = new Validator(body.fields);
  const data = {
    date: v.date("date", { required: true }),
    time: v.string("time", { max: 20 }),
    location: v.string("location", { required: true, max: 255 }),
    severity: v.oneOf("severity", NEAR_MISS_SEVERITIES, { required: true }),
    description: v.string("description", { required: true, max: 10000 }),
    potential_consequence: v.string("potential_consequence", { max: 5000 }),
    corrective_action: v.string("corrective_action", { max: 5000 }),
    corrective_action_due: v.date("corrective_action_due"),
    status: v.oneOf("status", STATUSES) ?? undefined,
    ...geoFields(v),
  };
  const image = checkImage(v, "image", body.files.image);
  v.done();

  const imagePath = image ? await storeFile(ctx.tenant.id, "near-miss", image) : null;
  let row: NearMissRow;
  try {
    row = await db().begin(async (tx) => {
      const reference = await nextReference(tx, ctx.tenant.id, "NM", "safety_near_miss");
      const values = compact({ ...data, tenant_id: ctx.tenant.id, reference, image: imagePath, reported_by: ctx.user.id });
      const [created] = await tx<{ id: number }[]>`insert into operix.safety_near_miss ${tx(values)} returning id`;
      await notifyHseEvent(tx, ctx, "near_miss", { id: created.id, reference, type: null, severity: data.severity!, location: data.location! });
      return await findNearMiss(tx, ctx.tenant.id, created.id);
    }) as NearMissRow;
  } catch (e) {
    if (imagePath) await deleteFiles([imagePath]);
    throw e;
  }
  return json(nearMissResource(row, await signedUrls([row.image])), 201);
}

export async function updateNearMiss(ctx: Ctx, id: number, body: Body): Promise<Response> {
  ctx.require("near_miss.update");
  const sql = db();
  await findNearMiss(sql, ctx.tenant.id, id);
  const v = new Validator(body.fields);
  const changes = compact({
    date: v.has("date") ? v.date("date", { required: true }) : undefined,
    time: v.string("time", { max: 20 }),
    location: v.has("location") ? v.string("location", { required: true, max: 255 }) : undefined,
    severity: v.has("severity") ? v.oneOf("severity", NEAR_MISS_SEVERITIES, { required: true }) : undefined,
    description: v.has("description") ? v.string("description", { required: true, max: 10000 }) : undefined,
    potential_consequence: v.string("potential_consequence", { max: 5000 }),
    corrective_action: v.string("corrective_action", { max: 5000 }),
    corrective_action_due: v.date("corrective_action_due"),
    status: v.has("status") ? v.oneOf("status", STATUSES, { required: true }) : undefined,
    ...geoFields(v),
  });
  v.done();
  if (changes.status === "closed") ctx.require("near_miss.close");
  if (Object.keys(changes).length > 0) {
    await sql`update operix.safety_near_miss set ${sql(changes)} where id = ${id} and tenant_id = ${ctx.tenant.id}`;
  }
  const row = await findNearMiss(sql, ctx.tenant.id, id);
  return json(nearMissResource(row, await signedUrls([row.image])));
}

export async function deleteIncident(ctx: Ctx, id: number): Promise<Response> {
  ctx.require("incidents.delete");
  await findIncident(db(), ctx.tenant.id, id);
  await db()`update operix.safety_incidents set deleted_at = now() where id = ${id} and tenant_id = ${ctx.tenant.id}`;
  return json({ message: "Incident archivé." });
}

export async function deleteNearMiss(ctx: Ctx, id: number): Promise<Response> {
  ctx.require("near_miss.delete");
  await findNearMiss(db(), ctx.tenant.id, id);
  await db()`update operix.safety_near_miss set deleted_at = now() where id = ${id} and tenant_id = ${ctx.tenant.id}`;
  return json({ message: "Presqu’accident archivé." });
}

// ── Infractions (encadrement HSSE) ──────────────────────────────────────────

export async function createBreach(ctx: Ctx, body: Body): Promise<Response> {
  ctx.require("breaches.manage");
  const v = new Validator(body.fields);
  const data = {
    employee_id: v.number("employee_id", { integer: true, min: 1 }),
    location: v.string("location", { max: 255 }),
    ...geoFields(v),
    date: v.date("date", { required: true }),
    type: v.string("type", { required: true, max: 100 }),
    severity: v.oneOf("severity", RISK_LEVELS, { required: true }),
    description: v.string("description", { required: true, max: 10000 }),
    sanction: v.string("sanction", { max: 5000 }),
  };
  v.done();

  const sql = db();
  if (data.employee_id) {
    const [emp] = await sql`select 1 from operix.employees where id = ${data.employee_id} and tenant_id = ${ctx.tenant.id}`;
    if (!emp) {
      v.add("employee_id", "L'employé sélectionné est invalide.");
      v.done();
    }
  }

  const row = await sql.begin(async (tx) => {
    const reference = await nextReference(tx, ctx.tenant.id, "INF", "breaches");
    const values = compact({ ...data, tenant_id: ctx.tenant.id, reference, created_by: ctx.user.id });
    const [created] = await tx<Record<string, unknown>[]>`insert into operix.breaches ${tx(values)} returning *`;
    return created;
  }) as Record<string, unknown>;

  return json({
    id: row.id,
    reference: row.reference,
    employee_id: row.employee_id,
    location: row.location,
    date: row.date,
    type: row.type,
    severity: row.severity,
    description: row.description,
    location_point: locationPoint(geoFromRecord(row)),
    sanction: row.sanction,
    status: row.status,
    created_at: ymdHi(row.created_at as Date),
  }, 201);
}
