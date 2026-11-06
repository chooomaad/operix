import { type Ctx } from "../lib/auth.ts";
import { db, type Db } from "../lib/db.ts";
import { HttpError, json, notFound, type Body } from "../lib/http.ts";
import { pageMeta, pageParams } from "../lib/paging.ts";
import { ROLES } from "../lib/permissions.ts";
import { Validator } from "../lib/validate.ts";

interface AdminUser {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  matricule: string;
  email: string | null;
  role: string;
  is_active: boolean;
  last_login_at: Date | null;
  site_id: number | null;
  site_name: string | null;
}

interface AdminEmployee {
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
  department_id: number | null;
  department_name: string | null;
}

function requireAdmin(ctx: Ctx): void {
  ctx.require("users.manage");
}

function requireEmployeeManager(ctx: Ctx): void {
  ctx.require("employees.manage");
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function employeeShape(employee: AdminEmployee) {
  return {
    id: employee.id,
    matricule: employee.matricule,
    nom: employee.nom,
    prenom: employee.prenom,
    poste: employee.poste,
    type_contrat: employee.type_contrat,
    gender: employee.gender,
    date_embauche: employee.date_embauche,
    nationalite: employee.nationalite,
    is_active: employee.is_active,
    department: employee.department_id === null
      ? null
      : { id: employee.department_id, name: employee.department_name },
  };
}

function parseStatus(value: string | null): boolean | null {
  if (value === null || value === "") return null;
  if (value === "active") return true;
  if (value === "inactive") return false;
  throw new HttpError(422, "Le filtre status est invalide.");
}

async function siteBelongsToTenant(sql: Db, tenantId: number, siteId: number, activeOnly = true): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    select id from operix.sites
     where id = ${siteId} and tenant_id = ${tenantId}
       and (${activeOnly}::boolean = false or is_active)`;
  return rows.length > 0;
}

function userShape(user: AdminUser) {
  return {
    id: user.id,
    name: user.name,
    first_name: user.first_name,
    last_name: user.last_name,
    matricule: user.matricule,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    last_login_at: user.last_login_at?.toISOString() ?? null,
    site: user.site_id === null ? null : { id: user.site_id, name: user.site_name },
  };
}

export async function listAdminUsers(ctx: Ctx, url: URL): Promise<Response> {
  requireAdmin(ctx);
  const { page, perPage, offset } = pageParams(url);
  const search = url.searchParams.get("search")?.trim().slice(0, 100) || null;
  const role = url.searchParams.get("role") || null;
  const siteValue = url.searchParams.get("site_id");
  const status = parseStatus(url.searchParams.get("status"));

  if (role && !(ROLES as readonly string[]).includes(role)) throw new HttpError(422, "Le filtre role est invalide.");
  let siteId: number | null = null;
  if (siteValue) {
    siteId = Number(siteValue);
    if (!Number.isSafeInteger(siteId) || siteId < 1) throw new HttpError(422, "Le filtre site_id est invalide.");
    if (!(await siteBelongsToTenant(db(), ctx.user.tenant_id, siteId, false))) {
      throw new HttpError(422, "Le site sélectionné est invalide.");
    }
  }

  const sql = db();
  const where = sql`
    u.tenant_id = ${ctx.user.tenant_id}
    and (${search}::text is null or u.matricule ilike ${search ? `%${search}%` : null}
      or u.first_name ilike ${search ? `%${search}%` : null}
      or u.last_name ilike ${search ? `%${search}%` : null}
      or u.name ilike ${search ? `%${search}%` : null})
    and (${role}::text is null or u.role = ${role})
    and (${siteId}::bigint is null or u.site_id = ${siteId})
    and (${status}::boolean is null or u.is_active = ${status})`;
  const [{ total }] = await sql<{ total: number }[]>`
    select count(*)::int as total from operix.users u where ${where}`;
  const rows = await sql<AdminUser[]>`
    select u.id, u.name, u.first_name, u.last_name, u.matricule, u.email, u.role,
           u.is_active, u.last_login_at, u.site_id, s.name as site_name
      from operix.users u
      left join operix.sites s on s.id = u.site_id and s.tenant_id = u.tenant_id
     where ${where}
     order by u.last_name, u.first_name, u.id
     limit ${perPage} offset ${offset}`;
  const sites = await sql<{ id: number; name: string; code: string | null; is_active: boolean }[]>`
    select id, name, code, is_active from operix.sites
     where tenant_id = ${ctx.user.tenant_id}
     order by name`;

  return json({ data: rows.map(userShape), meta: pageMeta(total, perPage, page), sites, tenant: ctx.tenant });
}

export async function listAdminSites(ctx: Ctx): Promise<Response> {
  requireAdmin(ctx);
  const sites = await db()<{ id: number; name: string; code: string | null; is_active: boolean }[]>`
    select id, name, code, is_active from operix.sites
     where tenant_id = ${ctx.user.tenant_id}
     order by name`;
  return json({ data: sites });
}

export async function listAdminEmployees(ctx: Ctx, url: URL): Promise<Response> {
  requireEmployeeManager(ctx);
  const { page, perPage, offset } = pageParams(url);
  const search = url.searchParams.get("search")?.trim().slice(0, 100) || null;
  const status = parseStatus(url.searchParams.get("status"));
  const sql = db();
  const where = sql`
    e.tenant_id = ${ctx.user.tenant_id}
    and (${search}::text is null or e.matricule ilike ${search ? `%${search}%` : null}
      or e.nom ilike ${search ? `%${search}%` : null}
      or e.prenom ilike ${search ? `%${search}%` : null}
      or e.poste ilike ${search ? `%${search}%` : null})
    and (${status}::boolean is null or e.is_active = ${status})`;
  const [{ total }] = await sql<{ total: number }[]>`
    select count(*)::int as total from operix.employees e where ${where}`;
  const rows = await sql<AdminEmployee[]>`
    select e.id, e.matricule, e.nom, e.prenom, e.poste, e.type_contrat,
           e.gender, e.date_embauche, e.nationalite, e.is_active,
           e.department_id, d.name as department_name
      from operix.employees e
      left join operix.departments d on d.id = e.department_id and d.tenant_id = e.tenant_id
     where ${where}
     order by e.nom, e.prenom, e.id
     limit ${perPage} offset ${offset}`;
  return json({ data: rows.map(employeeShape), meta: pageMeta(total, perPage, page) });
}

function employeeFields(body: Body, partial: boolean) {
  const v = new Validator(body.fields);
  const nom = v.string("nom", { required: !partial || v.has("nom"), min: 1, max: 100 });
  const prenom = v.string("prenom", { required: !partial || v.has("prenom"), max: 100 });
  const matricule = v.string("matricule", { max: 100 });
  const poste = v.string("poste", { max: 150 });
  const typeContrat = v.string("type_contrat", { max: 100 });
  const gender = v.string("gender", { max: 50 });
  const dateEmbauche = v.date("date_embauche");
  const nationalite = v.string("nationalite", { max: 100 });
  const department = v.string("department", { max: 150 });
  const isActive = body.fields.is_active;
  if ((!partial || v.has("is_active")) && typeof isActive !== "boolean") {
    v.add("is_active", "Le statut de l'employé est obligatoire.");
  }
  v.done();
  return {
    nom,
    prenom,
    matricule: matricule?.trim().toUpperCase() || null,
    poste: poste || null,
    typeContrat: typeContrat || null,
    gender: gender || null,
    dateEmbauche: dateEmbauche || null,
    nationalite: nationalite || null,
    department: department || null,
    isActive: typeof isActive === "boolean" ? isActive : undefined,
  };
}

async function employeeDepartmentId(sql: Db, tenantId: number, name: string | null): Promise<number | null> {
  if (!name) return null;
  const [{ id }] = await sql<{ id: number }[]>`
    insert into operix.departments (tenant_id, name)
    values (${tenantId}, ${name})
    on conflict (tenant_id, name) do update set name = excluded.name
    returning id`;
  return id;
}

async function getAdminEmployee(tenantId: number, employeeId: number): Promise<ReturnType<typeof employeeShape>> {
  const rows = await db()<AdminEmployee[]>`
    select e.id, e.matricule, e.nom, e.prenom, e.poste, e.type_contrat,
           e.gender, e.date_embauche, e.nationalite, e.is_active,
           e.department_id, d.name as department_name
      from operix.employees e
      left join operix.departments d on d.id = e.department_id and d.tenant_id = e.tenant_id
     where e.id = ${employeeId} and e.tenant_id = ${tenantId}`;
  if (!rows[0]) throw notFound();
  return employeeShape(rows[0]);
}

export async function createAdminEmployee(ctx: Ctx, body: Body): Promise<Response> {
  requireEmployeeManager(ctx);
  const fields = employeeFields(body, false);
  const sql = db();
  try {
    const [{ id }] = await sql<{ id: number }[]>`
      insert into operix.employees
        (tenant_id, department_id, matricule, nom, prenom, poste, type_contrat,
         gender, date_embauche, nationalite, is_active)
      values (
        ${ctx.user.tenant_id},
        ${await employeeDepartmentId(sql, ctx.user.tenant_id, fields.department)},
        ${fields.matricule}, ${fields.nom!}, ${fields.prenom ?? ""},
        ${fields.poste}, ${fields.typeContrat}, ${fields.gender},
        ${fields.dateEmbauche}, ${fields.nationalite}, ${fields.isActive}
      )
      returning id`;
    return json(await getAdminEmployee(ctx.user.tenant_id, id), 201);
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "Ce matricule existe déjà pour cette entreprise.");
    throw error;
  }
}

export async function importAdminEmployees(ctx: Ctx, body: Body): Promise<Response> {
  requireEmployeeManager(ctx);
  const rows = body.fields.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new HttpError(422, "Le fichier ne contient aucun employé à importer.");
  }
  if (rows.length > 500) {
    throw new HttpError(422, "Import limité à 500 employés par fichier.");
  }

  const validated: ReturnType<typeof employeeFields>[] = [];
  const errors: string[] = [];
  const matricules = new Map<string, number>();

  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      errors.push(`Ligne ${index + 2} : données invalides.`);
      continue;
    }
    try {
      const employee = employeeFields({ fields: row as Record<string, unknown>, files: {} }, false);
      if (employee.matricule) {
        const previousRow = matricules.get(employee.matricule);
        if (previousRow !== undefined) {
          errors.push(`Ligne ${index + 2} : matricule ${employee.matricule} en double (déjà présent ligne ${previousRow + 2}).`);
        } else {
          matricules.set(employee.matricule, index);
        }
      }
      validated.push(employee);
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      errors.push(`Ligne ${index + 2} : ${error.message}`);
    }
  }
  if (errors.length) {
    throw new HttpError(422, `Import annulé : ${errors.slice(0, 10).join(" ")}`, { rows: errors });
  }

  const sql = db();
  try {
    await sql.begin(async (tx) => {
      for (const [index, employee] of validated.entries()) {
        if (employee.matricule) {
          const duplicate = await tx<{ id: number }[]>`
            select id from operix.employees
             where tenant_id = ${ctx.user.tenant_id} and lower(matricule) = lower(${employee.matricule})
             limit 1`;
          if (duplicate.length) {
            throw new HttpError(409, `Import annulé : le matricule ${employee.matricule} de la ligne ${index + 2} existe déjà.`);
          }
        }
        const departmentId = await employeeDepartmentId(tx, ctx.user.tenant_id, employee.department ?? null);
        await tx`
          insert into operix.employees
            (tenant_id, department_id, matricule, nom, prenom, poste, type_contrat,
             gender, date_embauche, nationalite, is_active)
          values (
            ${ctx.user.tenant_id}, ${departmentId}, ${employee.matricule},
            ${employee.nom!}, ${employee.prenom ?? ""}, ${employee.poste},
            ${employee.typeContrat}, ${employee.gender}, ${employee.dateEmbauche},
            ${employee.nationalite}, ${employee.isActive}
          )`;
      }
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "Import annulé : un matricule existe déjà. Aucune ligne du fichier n'a été importée.");
    }
    throw error;
  }
  return json({ imported: validated.length });
}

export async function updateAdminEmployee(ctx: Ctx, employeeId: number, body: Body): Promise<Response> {
  requireEmployeeManager(ctx);
  const fields = employeeFields(body, true);
  const sql = db();
  try {
    await sql.begin(async (tx) => {
      const currentRows = await tx<AdminEmployee[]>`
        select e.id, e.matricule, e.nom, e.prenom, e.poste, e.type_contrat,
               e.gender, e.date_embauche, e.nationalite, e.is_active,
               e.department_id, d.name as department_name
          from operix.employees e
          left join operix.departments d on d.id = e.department_id and d.tenant_id = e.tenant_id
         where e.id = ${employeeId} and e.tenant_id = ${ctx.user.tenant_id}
         for update of e`;
      const current = currentRows[0];
      if (!current) throw notFound();
      const departmentId = fields.department === undefined
        ? current.department_id
        : await employeeDepartmentId(tx, ctx.user.tenant_id, fields.department);
      await tx`
        update operix.employees
           set department_id = ${departmentId},
               matricule = ${fields.matricule === undefined ? current.matricule : fields.matricule},
               nom = ${fields.nom === undefined ? current.nom : fields.nom},
               prenom = ${fields.prenom === undefined ? current.prenom : fields.prenom},
               poste = ${fields.poste === undefined ? current.poste : fields.poste},
               type_contrat = ${fields.typeContrat === undefined ? current.type_contrat : fields.typeContrat},
               gender = ${fields.gender === undefined ? current.gender : fields.gender},
               date_embauche = ${fields.dateEmbauche === undefined ? current.date_embauche : fields.dateEmbauche},
               nationalite = ${fields.nationalite === undefined ? current.nationalite : fields.nationalite},
               is_active = ${fields.isActive === undefined ? current.is_active : fields.isActive}
         where id = ${employeeId} and tenant_id = ${ctx.user.tenant_id}`;
    });
    return json(await getAdminEmployee(ctx.user.tenant_id, employeeId));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error)) throw new HttpError(409, "Ce matricule existe déjà pour cette entreprise.");
    throw error;
  }
}

export async function createAdminUser(ctx: Ctx, body: Body): Promise<Response> {
  requireAdmin(ctx);
  const v = new Validator(body.fields);
  const firstName = v.string("first_name", { required: true, min: 1, max: 100 });
  const lastName = v.string("last_name", { required: true, min: 1, max: 100 });
  const matriculeInput = v.string("matricule", { required: true, min: 1, max: 100 });
  const pin = v.string("pin", { required: true, min: 6, max: 50 });
  const pinConfirmation = v.string("pin_confirmation", { required: true, min: 6, max: 50 });
  const role = v.oneOf("role", ROLES, { required: true });
  const email = v.string("email", { max: 255 });
  const siteId = v.number("site_id", { required: true, integer: true, min: 1 });
  const isActive = body.fields.is_active;
  if (typeof isActive !== "boolean") v.add("is_active", "Le statut du compte est obligatoire.");
  if (pin !== pinConfirmation) v.add("pin_confirmation", "La confirmation du PIN ne correspond pas.");
  v.done();

  const matricule = matriculeInput!.trim().toUpperCase();
  const name = `${firstName!.trim()} ${lastName!.trim()}`;
  const sql = db();
  if (!(await siteBelongsToTenant(sql, ctx.user.tenant_id, siteId!))) {
    throw new HttpError(422, "Le site sélectionné est invalide.");
  }

  try {
    const userId = await sql.begin(async (tx) => {
      const duplicates = await tx<{ id: number }[]>`
        select id from operix.users where lower(matricule) = lower(${matricule}) limit 1`;
      if (duplicates.length) throw new HttpError(409, "Ce matricule existe déjà.");

      const [{ id }] = await tx<{ id: number }[]>`
        select operix.create_user(
          ${ctx.tenant.slug}, ${matricule}, ${pin!}, ${name}, ${role!}, ${email || null}
        ) as id`;
      await tx`
        update operix.users
           set first_name = ${firstName!.trim()},
               last_name = ${lastName!.trim()},
               site_id = ${siteId!},
               is_active = ${isActive as boolean}
         where id = ${id} and tenant_id = ${ctx.user.tenant_id}`;
      return id;
    });

    return json(await getAdminUser(ctx.user.tenant_id, userId), 201);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error)) throw new HttpError(409, "Ce matricule ou cette adresse e-mail existe déjà.");
    throw error;
  }
}

async function getAdminUser(tenantId: number, userId: number): Promise<ReturnType<typeof userShape>> {
  const rows = await db()<AdminUser[]>`
    select u.id, u.name, u.first_name, u.last_name, u.matricule, u.email, u.role,
           u.is_active, u.last_login_at, u.site_id, s.name as site_name
      from operix.users u
      left join operix.sites s on s.id = u.site_id and s.tenant_id = u.tenant_id
     where u.id = ${userId} and u.tenant_id = ${tenantId}`;
  if (!rows[0]) throw notFound();
  return userShape(rows[0]);
}

export async function updateAdminUser(ctx: Ctx, userId: number, body: Body): Promise<Response> {
  requireAdmin(ctx);
  const v = new Validator(body.fields);
  const firstName = v.string("first_name", { required: v.has("first_name"), min: 1, max: 100 });
  const lastName = v.string("last_name", { required: v.has("last_name"), min: 1, max: 100 });
  const matriculeInput = v.string("matricule", { required: v.has("matricule"), min: 1, max: 100 });
  const pin = v.string("pin", { min: 6, max: 50 });
  const pinConfirmation = v.string("pin_confirmation", { min: 6, max: 50 });
  const role = v.oneOf("role", ROLES, { required: v.has("role") });
  const email = v.string("email", { max: 255 });
  const siteId = v.number("site_id", { integer: true, min: 1 });
  const isActive = body.fields.is_active;
  if (v.has("is_active") && typeof isActive !== "boolean") v.add("is_active", "Le statut du compte est invalide.");
  if (pin !== undefined && pin !== null && pinConfirmation !== pin) {
    v.add("pin_confirmation", "La confirmation du PIN ne correspond pas.");
  }
  if (pinConfirmation !== undefined && pinConfirmation !== null && pin === undefined) {
    v.add("pin", "Le PIN est obligatoire pour sa confirmation.");
  }
  v.done();

  const sql = db();
  try {
    await sql.begin(async (tx) => {
      const users = await tx<AdminUser[]>`
        select id, name, first_name, last_name, matricule, email, role, is_active,
               last_login_at, site_id, null::text as site_name
          from operix.users
         where id = ${userId} and tenant_id = ${ctx.user.tenant_id}
         for update`;
      const current = users[0];
      if (!current) throw notFound();

      const nextMatricule = matriculeInput === undefined ? current.matricule : matriculeInput!.toUpperCase();
      const nextFirstName = firstName === undefined ? current.first_name : firstName ?? "";
      const nextLastName = lastName === undefined ? current.last_name : lastName ?? "";
      const nextRole = role === undefined ? current.role : role ?? current.role;
      const nextActive = typeof isActive === "boolean" ? isActive : current.is_active;
      const nextSiteId = siteId === undefined ? current.site_id : siteId;

      if (nextSiteId !== null
        && !(await siteBelongsToTenant(tx, ctx.user.tenant_id, nextSiteId, nextSiteId === current.site_id))) {
        throw new HttpError(422, "Le site sélectionné est invalide.");
      }

      const duplicate = await tx<{ id: number }[]>`
        select id from operix.users
         where lower(matricule) = lower(${nextMatricule}) and id <> ${userId}
         limit 1`;
      if (duplicate.length) throw new HttpError(409, "Ce matricule existe déjà.");

      if (current.role === "company_admin" && current.is_active
        && (nextRole !== "company_admin" || !nextActive)) {
        const [{ total }] = await tx<{ total: number }[]>`
          select count(*)::int as total from operix.users
           where tenant_id = ${ctx.user.tenant_id}
             and role = 'company_admin' and is_active and id <> ${userId}`;
        if (total === 0) throw new HttpError(409, "La société doit conserver au moins un administrateur actif.");
      }

      await tx`
        update operix.users
           set first_name = ${nextFirstName},
               last_name = ${nextLastName},
               name = ${`${nextFirstName} ${nextLastName}`.trim()},
               matricule = ${nextMatricule},
               email = ${email === undefined ? current.email : email},
               role = ${nextRole},
               site_id = ${nextSiteId},
               is_active = ${nextActive}
         where id = ${userId} and tenant_id = ${ctx.user.tenant_id}`;

      if (current.is_active && !nextActive) {
        await tx`delete from operix.api_tokens where user_id = ${userId}`;
      }

      if (pin) {
        await tx`
          update auth.users a
             set encrypted_password = extensions.crypt(${pin}, extensions.gen_salt('bf')),
                 updated_at = now()
            from operix.users u
           where u.id = ${userId} and u.auth_user_id = a.id`;
      }
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error)) throw new HttpError(409, "Ce matricule ou cette adresse e-mail existe déjà.");
    throw error;
  }

  return json(await getAdminUser(ctx.user.tenant_id, userId));
}
