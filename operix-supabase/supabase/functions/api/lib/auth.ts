import { db, type Db } from "./db.ts";
import { forbidden, HttpError, tooManyRequests, unauthenticated } from "./http.ts";
import { abilitiesFor, roleCan } from "./permissions.ts";
import { iso } from "./time.ts";

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  short_name: string | null;
  status: string;
  logo_url: string | null;
  primary_color: string | null;
  locale: string | null;
  country: string | null;
  timezone: string;
  settings: Record<string, unknown>;
}

export interface User {
  id: number;
  tenant_id: number;
  name: string;
  email: string | null;
  role: string;
  matricule: string;
  phone: string | null;
  avatar: string | null;
  is_active: boolean;
  last_login_at: Date | null;
}

/** Contexte d'une requête authentifiée. */
export interface Ctx {
  user: User;
  tenant: Tenant;
  tokenId: number;
  can(permission: string): boolean;
  /** Lève 403 si la permission manque (équivalent du middleware `permission:`). */
  require(permission: string): void;
}

// ── Jetons ──────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** Crée un jeton d'API ; seule son empreinte SHA-256 est stockée. Format « id|secret » comme Sanctum. */
export async function issueToken(sql: Db, userId: number, name: string): Promise<string> {
  const secret = randomToken();
  const [row] = await sql<{ id: number }[]>`
    insert into operix.api_tokens (user_id, token_hash, name)
    values (${userId}, ${await sha256(secret)}, ${name})
    returning id`;
  return `${row.id}|${secret}`;
}

export async function revokeToken(sql: Db, tokenId: number): Promise<void> {
  await sql`delete from operix.api_tokens where id = ${tokenId}`;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

export function makeCtx(user: User, tenant: Tenant, tokenId: number): Ctx {
  const can = (p: string) => roleCan(user.role, p);
  return {
    user,
    tenant,
    tokenId,
    can,
    require(p: string) {
      if (!can(p)) throw forbidden();
    },
  };
}

/** Résout l'utilisateur à partir du jeton Bearer (équivalent de auth:sanctum + tenant). */
export async function authenticate(req: Request): Promise<Ctx> {
  const token = bearer(req);
  if (!token) throw unauthenticated();
  const sep = token.indexOf("|");
  const secret = sep >= 0 ? token.slice(sep + 1) : token;
  if (!secret) throw unauthenticated();

  const sql = db();
  const rows = await sql<(User & { token_id: number; token_last_used: Date | null; t: Tenant })[]>`
    select u.id, u.tenant_id, u.name, u.email, u.role, u.matricule, u.phone, u.avatar,
           u.is_active, u.last_login_at, k.id as token_id, k.last_used_at as token_last_used,
           row_to_json(t.*) as t
      from operix.api_tokens k
      join operix.users u on u.id = k.user_id
      join operix.tenants t on t.id = u.tenant_id
     where k.token_hash = ${await sha256(secret)}
       and (k.expires_at is null or k.expires_at > now())`;
  const row = rows[0];
  if (!row || !row.is_active) throw unauthenticated();
  if (row.t.status !== "active") throw forbidden("Votre accès à cette entreprise est suspendu ou a expiré.");

  // Trace d'usage, au plus une écriture par minute et par jeton.
  if (!row.token_last_used || Date.now() - row.token_last_used.getTime() > 60_000) {
    sql`update operix.api_tokens set last_used_at = now() where id = ${row.token_id}`.catch(() => undefined);
  }

  const { token_id, token_last_used: _unused, t, ...user } = row;
  return makeCtx(user, { ...t, id: Number(t.id) }, token_id);
}

// ── Limitation de débit ─────────────────────────────────────────────────────

/** Compte une tentative ; lève 429 au-delà de `max` dans la fenêtre. */
export async function throttle(key: string, max: number, windowSeconds: number): Promise<void> {
  const sql = db();
  const [{ n }] = await sql<{ n: number }[]>`
    with ins as (insert into operix.rate_hits (key) values (${key}))
    select count(*)::int as n from operix.rate_hits
     where key = ${key} and at > now() - make_interval(secs => ${windowSeconds})`;
  if (Math.random() < 0.02) {
    sql`delete from operix.rate_hits where at < now() - interval '1 hour'`.catch(() => undefined);
  }
  // `n` ne compte pas la ligne insérée par la même requête.
  if (n >= max) throw tooManyRequests();
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

// ── Formats de réponse (AuthController Laravel) ─────────────────────────────

export function formatUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    matricule: u.matricule,
    phone: u.phone,
    avatar: u.avatar,
    is_active: u.is_active,
    last_login_at: iso(u.last_login_at),
  };
}

export function tenantInfo(t: Tenant) {
  return {
    id: t.id,
    name: t.name,
    short_name: t.short_name,
    logo_url: t.logo_url,
    primary_color: t.primary_color,
    locale: t.locale,
    country: t.country,
    timezone: t.timezone,
  };
}

export function orgInfo(t: Tenant) {
  const { id: _id, ...rest } = tenantInfo(t);
  return rest;
}

export function sessionPayload(ctx: Ctx) {
  return {
    user: formatUser(ctx.user),
    tenant: tenantInfo(ctx.tenant),
    abilities: abilitiesFor(ctx.user.role),
    organisation: orgInfo(ctx.tenant),
  };
}

export { HttpError };
