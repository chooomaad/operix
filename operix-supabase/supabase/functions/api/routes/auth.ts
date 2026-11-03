import { clientIp, type Ctx, issueToken, makeCtx, revokeToken, sessionPayload, type Tenant, throttle, type User } from "../lib/auth.ts";
import { db } from "../lib/db.ts";
import { type Body, forbidden, HttpError, json } from "../lib/http.ts";
import { Validator } from "../lib/validate.ts";

/**
 * POST /auth/login — matricule + PIN.
 * Le PIN est vérifié contre le mot de passe Supabase Auth du compte lié
 * (bcrypt, via crypt()), puis un jeton d'API révocable est délivré.
 */
export async function login(req: Request, body: Body): Promise<Response> {
  const v = new Validator(body.fields);
  const matricule = v.string("matricule", { required: true, max: 100 });
  const pin = v.string("pin", { required: true, min: 4, max: 50 });
  v.done();

  // 5 tentatives par minute et par IP, comme l'ancienne API (le PIN est court par nature).
  await throttle(`login:${clientIp(req)}`, 5, 60);

  const sql = db();
  const rows = await sql<(User & { pin_ok: boolean; t: Tenant })[]>`
    select u.id, u.tenant_id, u.name, u.email, u.role, u.matricule, u.phone, u.avatar, u.is_active, u.last_login_at,
           (a.encrypted_password is not null
             and a.encrypted_password = extensions.crypt(${pin!}, a.encrypted_password)) as pin_ok,
           row_to_json(t.*) as t
      from operix.users u
      join auth.users a on a.id = u.auth_user_id
      join operix.tenants t on t.id = u.tenant_id
     where lower(u.matricule) = lower(${matricule!})`;
  const row = rows[0];
  if (!row || !row.pin_ok) throw new HttpError(401, "Matricule ou PIN incorrect.");
  if (!row.is_active) throw forbidden("Votre compte est en attente de validation par l'administrateur.");
  if (row.t.status === "suspended") throw forbidden("Votre compte est suspendu. Contactez support@operix-app.com");
  if (row.t.status !== "active") throw forbidden("Votre acces a cette entreprise a expire.");

  const platform = typeof body.fields.platform === "string" ? body.fields.platform : "web";
  const token = await issueToken(sql, row.id, platform === "mobile" ? "operix-mobile" : "operix-web");
  const [{ last_login_at }] = await sql<{ last_login_at: Date }[]>`
    update operix.users set last_login_at = now() where id = ${row.id} returning last_login_at`;

  const { pin_ok: _ok, t, ...user } = row;
  const ctx = makeCtx({ ...user, last_login_at }, { ...t, id: Number(t.id) }, 0);
  return json({ token, ...sessionPayload(ctx) });
}

/** GET /auth/me */
export function me(ctx: Ctx): Response {
  return json(sessionPayload(ctx));
}

/** POST /auth/logout — révoque le jeton courant uniquement. */
export async function logout(ctx: Ctx): Promise<Response> {
  await revokeToken(db(), ctx.tokenId);
  return json({ message: "Déconnecté avec succès." });
}
