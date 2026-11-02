/**
 * Serveur de développement local, sans Docker : imite les URLs d'un projet Supabase
 * sur un seul port, pour brancher l'app mobile (ou un navigateur) dessus.
 *
 *   /functions/v1/api/...  → l'Edge Function `api` (le vrai code)
 *   /storage/v1/...        → un Storage en mémoire (mêmes routes que Supabase)
 *
 * Usage :
 *   tests/db_reset.sh                              # base locale + seed démo
 *   deno run -A --config supabase/functions/api/deno.json tests/dev_server.ts
 *   → EXPO_PUBLIC_API_URL=http://<ip-du-poste>:54321/functions/v1/api/v1
 */
const PORT = Number(Deno.env.get("PORT") ?? 54321);
const SERVICE_KEY = "local-service-role-key";

Deno.env.set("SUPABASE_DB_URL", Deno.env.get("SUPABASE_DB_URL") ?? "postgres://postgres@127.0.0.1:54329/operix_test");
Deno.env.set("SUPABASE_URL", Deno.env.get("PUBLIC_URL") ?? `http://127.0.0.1:${PORT}`);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);

const { handler } = await import("../supabase/functions/api/app.ts");

const objects = new Map<string, { bytes: Uint8Array<ArrayBuffer>; type: string }>();
const tokens = new Map<string, string>();

async function storage(req: Request, path: string): Promise<Response> {
  let m: RegExpExecArray | null;
  // Lecture publique d'une URL signée (ce que charge l'app pour afficher la photo).
  if (req.method === "GET" && (m = /^\/storage\/v1\/object\/sign\/operix-media\/(.+)$/.exec(path))) {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    const o = tokens.get(token) === m[1] ? objects.get(m[1]) : undefined;
    return o ? new Response(o.bytes, { headers: { "content-type": o.type } }) : new Response("Not found", { status: 404 });
  }
  if (req.headers.get("authorization") !== `Bearer ${SERVICE_KEY}`) return new Response("Unauthorized", { status: 401 });
  if (req.method === "POST" && /^\/storage\/v1\/object\/sign\/operix-media$/.test(path)) {
    const { paths } = await req.json() as { paths: string[] };
    return Response.json(paths.map((p) => {
      if (!objects.has(p)) return { path: p, signedURL: null, error: "Not found" };
      const token = crypto.randomUUID();
      tokens.set(token, p);
      return { path: p, signedURL: `/object/sign/operix-media/${p}?token=${token}`, error: null };
    }));
  }
  if (req.method === "POST" && (m = /^\/storage\/v1\/object\/operix-media\/(.+)$/.exec(path))) {
    objects.set(m[1], { bytes: new Uint8Array(await req.arrayBuffer()), type: req.headers.get("content-type") ?? "" });
    return Response.json({ Key: `operix-media/${m[1]}` });
  }
  if (req.method === "GET" && (m = /^\/storage\/v1\/object\/operix-media\/(.+)$/.exec(path))) {
    const o = objects.get(m[1]);
    return o ? new Response(o.bytes, { headers: { "content-type": o.type } }) : new Response("Not found", { status: 404 });
  }
  if (req.method === "DELETE") {
    const { prefixes } = await req.json() as { prefixes: string[] };
    prefixes.forEach((p) => objects.delete(p));
    return Response.json([]);
  }
  return new Response("Not found", { status: 404 });
}

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, async (req) => {
  const path = new URL(req.url).pathname;
  const started = performance.now();
  const res = path.startsWith("/storage/v1/") ? await storage(req, path) : await handler(req);
  if (!path.startsWith("/storage/")) {
    console.log(`${req.method} ${path} → ${res.status} (${Math.round(performance.now() - started)} ms)`);
  }
  return res;
});
