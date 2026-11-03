import type { Ctx } from "../lib/auth.ts";
import { db, type Db } from "../lib/db.ts";
import { json, notFound } from "../lib/http.ts";
import { rolesFor } from "../lib/permissions.ts";
import { iso } from "../lib/time.ts";
import { pageParams } from "../lib/paging.ts";

const VIEW_PERMISSION = { incident: "incidents.view", near_miss: "near_miss.view" } as const;
const RESOURCE_PATH = { incident: "/incidents", near_miss: "/near-miss" } as const;

/**
 * Notifie l'encadrement et les collègues habilités qu'un événement vient d'être
 * déclaré (port de SendHseEventNotifications). L'auteur n'est pas notifié.
 * Écrit dans la même transaction que l'événement : pas d'événement sans alerte.
 */
export async function notifyHseEvent(
  tx: Db,
  ctx: Ctx,
  kind: "incident" | "near_miss",
  ev: { id: number; reference: string; type: string | null; severity: string; location: string },
): Promise<void> {
  const label = kind === "incident" ? "Nouvel incident" : "Nouveau presqu'accident";
  const data = {
    title: ev.type ? `${label} — ${ev.type}` : label,
    body: [ev.reference, ev.location].filter(Boolean).join(" · ") || "Un nouvel evenement a ete declare.",
    type: ev.severity === "critical" || ev.severity === "high" ? "alert" : ev.severity === "medium" ? "warning" : "info",
    resource_kind: kind,
    resource_id: ev.id,
    severity: ev.severity,
    link: `${RESOURCE_PATH[kind]}/${ev.id}`,
  };
  await tx`
    insert into operix.notifications (tenant_id, user_id, type, data)
    select ${ctx.tenant.id}, u.id, ${data.type}, ${tx.json(data)}
      from operix.users u
     where u.tenant_id = ${ctx.tenant.id}
       and u.is_active
       and u.role in ${tx(rolesFor(VIEW_PERMISSION[kind]))}
       and u.id <> ${ctx.user.id}`;
}

interface NotificationRow {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: Date | null;
  created_at: Date;
}

const format = (n: NotificationRow) => ({ id: n.id, type: n.type, data: n.data, read_at: iso(n.read_at), created_at: iso(n.created_at) });

export async function listNotifications(ctx: Ctx, url: URL): Promise<Response> {
  ctx.require("notifications.view");
  const sql = db();
  const { perPage, page, offset } = pageParams(url, 20);
  const [{ total, unread }] = await sql<{ total: number; unread: number }[]>`
    select count(*)::int as total, count(*) filter (where read_at is null)::int as unread
      from operix.notifications where user_id = ${ctx.user.id}`;
  const rows = await sql<NotificationRow[]>`
    select id, type, data, read_at, created_at from operix.notifications
     where user_id = ${ctx.user.id}
     order by created_at desc limit ${perPage} offset ${offset}`;
  return json({
    data: rows.map(format),
    meta: { current_page: page, last_page: Math.max(1, Math.ceil(total / perPage)), total, unread_count: unread },
  });
}

export async function unreadCount(ctx: Ctx): Promise<Response> {
  ctx.require("notifications.view");
  const [{ count }] = await db()<{ count: number }[]>`
    select count(*)::int as count from operix.notifications where user_id = ${ctx.user.id} and read_at is null`;
  return json({ count });
}

export async function markRead(ctx: Ctx, id: string): Promise<Response> {
  ctx.require("notifications.view");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("Notification introuvable.");
  const rows = await db()`
    update operix.notifications set read_at = coalesce(read_at, now())
     where id = ${id} and user_id = ${ctx.user.id} returning id`;
  if (rows.length === 0) throw notFound("Notification introuvable.");
  return json({ message: "Notification marquée comme lue." });
}

export async function markAllRead(ctx: Ctx): Promise<Response> {
  ctx.require("notifications.view");
  const rows = await db()`
    update operix.notifications set read_at = now() where user_id = ${ctx.user.id} and read_at is null returning id`;
  return json({ message: `${rows.length} notification(s) marquée(s) comme lues.` });
}
