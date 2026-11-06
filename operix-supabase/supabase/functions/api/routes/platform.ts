import { makeCtx, type Ctx, type Tenant } from "../lib/auth.ts";
import { db } from "../lib/db.ts";
import { HttpError, json, notFound, type Body } from "../lib/http.ts";
import { pageMeta, pageParams } from "../lib/paging.ts";
import { RISK_LEVELS } from "../lib/ai.ts";
import { Validator } from "../lib/validate.ts";

interface CompanyRow extends Tenant {
  created_at: Date;
}

function requirePlatformAdmin(ctx: Ctx): void {
  ctx.require("platform.manage");
}

export async function platformTenantContext(ctx: Ctx, tenantId: number): Promise<Ctx> {
  requirePlatformAdmin(ctx);
  if (!Number.isSafeInteger(tenantId) || tenantId < 1) throw new HttpError(422, "L’entreprise sélectionnée est invalide.");
  const [tenant] = await db()<Tenant[]>`select * from operix.tenants where id = ${tenantId}`;
  if (!tenant) throw notFound("Entreprise introuvable.");
  return makeCtx({ ...ctx.user, tenant_id: tenantId }, tenant, ctx.tokenId);
}

function companyShape(company: CompanyRow) {
  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    short_name: company.short_name,
    status: company.status,
    country: company.country,
    timezone: company.timezone,
    created_at: company.created_at.toISOString(),
  };
}

export async function listPlatformCompanies(ctx: Ctx): Promise<Response> {
  requirePlatformAdmin(ctx);
  const rows = await db()<CompanyRow[]>`
    select id, slug, name, short_name, status, country, timezone, created_at
      from operix.tenants order by name, id`;
  return json({ data: rows.map(companyShape) });
}

function companyFields(body: Body, partial: boolean) {
  const v = new Validator(body.fields);
  const slug = v.string("slug", { required: !partial || v.has("slug"), min: 2, max: 80 });
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    v.add("slug", "Utilisez uniquement des lettres minuscules, chiffres et tirets.");
  }
  const name = v.string("name", { required: !partial || v.has("name"), min: 2, max: 150 });
  const shortName = v.string("short_name", { max: 80 });
  const country = v.string("country", { max: 100 });
  const timezone = v.string("timezone", { min: 1, max: 80 });
  const status = v.oneOf("status", ["active", "suspended", "expired"] as const, { required: partial && v.has("status") });
  v.done();
  return { slug: slug?.trim(), name: name?.trim(), shortName: shortName?.trim() || null, country: country?.trim() || null, timezone: timezone?.trim(), status };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function createPlatformCompany(ctx: Ctx, body: Body): Promise<Response> {
  requirePlatformAdmin(ctx);
  const fields = companyFields(body, false);
  try {
    const company = await db().begin(async (tx) => {
      const [created] = await tx<CompanyRow[]>`
        insert into operix.tenants (slug, name, short_name, country, timezone)
        values (${fields.slug!}, ${fields.name!}, ${fields.shortName}, ${fields.country}, ${fields.timezone || "UTC"})
        returning id, slug, name, short_name, status, country, timezone, created_at`;
      await tx`
        insert into operix.sites (tenant_id, name, code, is_active)
        values (${created.id}, 'Principal', 'MAIN', true)`;
      return created;
    });
    return json(companyShape(company), 201);
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "Une entreprise utilise déjà ce nom ou cet identifiant.");
    throw error;
  }
}

export async function updatePlatformCompany(ctx: Ctx, tenantId: number, body: Body): Promise<Response> {
  requirePlatformAdmin(ctx);
  const fields = companyFields(body, true);
  const changes = Object.fromEntries(Object.entries({
    name: fields.name,
    short_name: body.fields.short_name === undefined ? undefined : fields.shortName,
    country: body.fields.country === undefined ? undefined : fields.country,
    timezone: fields.timezone,
    status: fields.status,
  }).filter(([, value]) => value !== undefined));
  if (!Object.keys(changes).length) throw new HttpError(422, "Aucune modification à enregistrer.");
  try {
    const [company] = await db()<CompanyRow[]>`
      update operix.tenants
         set ${db()(changes)}
       where id = ${tenantId}
       returning id, slug, name, short_name, status, country, timezone, created_at`;
    if (!company) throw notFound("Entreprise introuvable.");
    return json(companyShape(company));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error)) throw new HttpError(409, "Une entreprise utilise déjà ce nom.");
    throw error;
  }
}

export async function suspendPlatformCompany(ctx: Ctx, tenantId: number): Promise<Response> {
  requirePlatformAdmin(ctx);
  const [company] = await db()<CompanyRow[]>`
    update operix.tenants set status = 'suspended'
     where id = ${tenantId}
     returning id, slug, name, short_name, status, country, timezone, created_at`;
  if (!company) throw notFound("Entreprise introuvable.");
  return json(companyShape(company));
}

interface BreachRow {
  id: number;
  tenant_id: number;
  reference: string;
  employee_id: number | null;
  employee_name: string | null;
  location: string | null;
  date: string;
  type: string;
  severity: string;
  description: string;
  sanction: string | null;
  status: string;
}

function breachShape(row: BreachRow) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    reference: row.reference,
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    location: row.location,
    date: row.date,
    type: row.type,
    severity: row.severity,
    description: row.description,
    sanction: row.sanction,
    status: row.status,
  };
}

async function findBreach(ctx: Ctx, id: number): Promise<BreachRow> {
  const [row] = await db()<BreachRow[]>`
    select b.id, b.tenant_id, b.reference, b.employee_id,
           case when e.id is null then null else concat_ws(' ', e.prenom, e.nom) end as employee_name,
           b.location, b.date, b.type, b.severity, b.description, b.sanction, b.status
      from operix.breaches b
      left join operix.employees e on e.id = b.employee_id and e.tenant_id = b.tenant_id
     where b.id = ${id} and b.tenant_id = ${ctx.tenant.id} and b.deleted_at is null`;
  if (!row) throw notFound("Violation introuvable.");
  return row;
}

export async function listPlatformBreaches(ctx: Ctx, url: URL): Promise<Response> {
  ctx.require("breaches.manage");
  const { page, perPage, offset } = pageParams(url);
  const search = url.searchParams.get("search")?.trim().slice(0, 100) || null;
  const status = url.searchParams.get("status");
  if (status && !["open", "in_progress", "closed"].includes(status)) throw new HttpError(422, "Le filtre status est invalide.");
  const where = db()`
    b.tenant_id = ${ctx.tenant.id} and b.deleted_at is null
    and (${search}::text is null or b.reference ilike ${search ? `%${search}%` : null}
      or b.description ilike ${search ? `%${search}%` : null}
      or coalesce(b.location, '') ilike ${search ? `%${search}%` : null})
    and (${status}::text is null or b.status = ${status})`;
  const [{ total }] = await db()<{ total: number }[]>`select count(*)::int as total from operix.breaches b where ${where}`;
  const rows = await db()<BreachRow[]>`
    select b.id, b.tenant_id, b.reference, b.employee_id,
           case when e.id is null then null else concat_ws(' ', e.prenom, e.nom) end as employee_name,
           b.location, b.date, b.type, b.severity, b.description, b.sanction, b.status
      from operix.breaches b
      left join operix.employees e on e.id = b.employee_id and e.tenant_id = b.tenant_id
     where ${where}
     order by b.date desc, b.id desc limit ${perPage} offset ${offset}`;
  return json({ data: rows.map(breachShape), meta: pageMeta(total, perPage, page) });
}

function breachFields(body: Body, partial: boolean) {
  const v = new Validator(body.fields);
  const employeeId = v.number("employee_id", { integer: true, min: 1 });
  const location = v.string("location", { max: 255 });
  const date = v.date("date", { required: !partial || v.has("date") });
  const type = v.string("type", { required: !partial || v.has("type"), min: 1, max: 100 });
  const severity = v.oneOf("severity", RISK_LEVELS, { required: !partial || v.has("severity") });
  const description = v.string("description", { required: !partial || v.has("description"), min: 1, max: 10000 });
  const sanction = v.string("sanction", { max: 5000 });
  const status = v.oneOf("status", ["open", "in_progress", "closed"] as const, { required: partial && v.has("status") });
  v.done();
  return { employeeId, location, date, type, severity, description, sanction, status };
}

async function checkBreachEmployee(ctx: Ctx, employeeId: number | null | undefined): Promise<void> {
  if (employeeId === undefined || employeeId === null) return;
  const [employee] = await db()<[{ id: number }]>`
    select id from operix.employees where id = ${employeeId} and tenant_id = ${ctx.tenant.id} and is_active`;
  if (!employee) throw new HttpError(422, "L’employé sélectionné n’est pas actif dans cette entreprise.");
}

async function createBreachRow(ctx: Ctx, fields: ReturnType<typeof breachFields>) {
  const year = new Date().getUTCFullYear();
  return db().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`${ctx.tenant.id}:INF:${year}`}))`;
    const [{ max_number }] = await tx<{ max_number: number | null }[]>`
      select max(substring(reference from ${`^INF-${year}-([0-9]+)$`})::integer) as max_number
        from operix.breaches where tenant_id = ${ctx.tenant.id}`;
    const reference = `INF-${year}-${String((max_number ?? 0) + 1).padStart(4, "0")}`;
    const [created] = await tx<{ id: number }[]>`
      insert into operix.breaches
        (tenant_id, reference, employee_id, location, date, type, severity, description, sanction, status, created_by)
      values (${ctx.tenant.id}, ${reference}, ${fields.employeeId ?? null}, ${fields.location || null},
        ${fields.date!}, ${fields.type!}, ${fields.severity!}, ${fields.description!}, ${fields.sanction || null},
        ${fields.status ?? "open"}, ${ctx.user.id})
      returning id`;
    return created.id;
  });
}

export async function createPlatformBreach(ctx: Ctx, body: Body): Promise<Response> {
  ctx.require("breaches.manage");
  const fields = breachFields(body, false);
  await checkBreachEmployee(ctx, fields.employeeId);
  const id = await createBreachRow(ctx, fields);
  return json(breachShape(await findBreach(ctx, id)), 201);
}

export async function updatePlatformBreach(ctx: Ctx, id: number, body: Body): Promise<Response> {
  ctx.require("breaches.manage");
  const fields = breachFields(body, true);
  await findBreach(ctx, id);
  await checkBreachEmployee(ctx, fields.employeeId);
  const changes = Object.fromEntries(Object.entries({
    employee_id: fields.employeeId,
    location: fields.location,
    date: fields.date,
    type: fields.type,
    severity: fields.severity,
    description: fields.description,
    sanction: fields.sanction,
    status: fields.status,
  }).filter(([, value]) => value !== undefined));
  if (Object.keys(changes).length) {
    await db()`update operix.breaches set ${db()(changes)} where id = ${id} and tenant_id = ${ctx.tenant.id}`;
  }
  return json(breachShape(await findBreach(ctx, id)));
}

export async function deletePlatformBreach(ctx: Ctx, id: number): Promise<Response> {
  ctx.require("breaches.manage");
  await findBreach(ctx, id);
  await db()`update operix.breaches set deleted_at = now() where id = ${id} and tenant_id = ${ctx.tenant.id}`;
  return json({ message: "Violation archivée." });
}
