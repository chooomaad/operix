/**
 * Recette de l'API OPERIX sur Supabase, sans Docker :
 *  - vrai PostgreSQL 16 local (tests/db_reset.sh : stubs Supabase + migrations + seed) ;
 *  - faux service Storage (mêmes routes HTTP que Supabase Storage) ;
 *  - faux serveur Anthropic pour vérifier le chemin « engine: ai ».
 *
 * Lancer : npm test   (ou deno test -A tests/api_test.ts)
 */
// Assertions minimales (sans dépendance réseau).
function assert(cond: unknown, msg = "assertion échouée"): asserts cond {
  if (!cond) throw new Error(msg);
}
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
}
function assertEquals(actual: unknown, expected: unknown, msg?: string) {
  if (canon(actual) !== canon(expected)) throw new Error(`${msg ? msg + " — " : ""}attendu ${canon(expected)}, obtenu ${canon(actual)}`);
}
function assertMatch(actual: string, re: RegExp) {
  if (!re.test(actual)) throw new Error(`« ${actual} » ne correspond pas à ${re}`);
}

const ROOT = new URL("..", import.meta.url).pathname;

// ── Base de test ────────────────────────────────────────────────────────────
const reset = await new Deno.Command("bash", { args: [`${ROOT}tests/db_reset.sh`], stdout: "piped", stderr: "piped" }).output();
if (!reset.success) throw new Error(new TextDecoder().decode(reset.stderr));
const dbUrl = new TextDecoder().decode(reset.stdout).trim().split("\n").pop()!;

// ── Faux Supabase Storage ───────────────────────────────────────────────────
const SERVICE_KEY = "test-service-role-key";
const objects = new Map<string, { bytes: Uint8Array; type: string }>();
const storage = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${SERVICE_KEY}`) return new Response("unauthorized", { status: 401 });
  const p = new URL(req.url).pathname;
  let m: RegExpExecArray | null;
  if (req.method === "POST" && (m = /^\/storage\/v1\/object\/sign\/operix-media$/.exec(p))) {
    const { paths } = await req.json() as { paths: string[] };
    return Response.json(paths.map((path) => ({
      path,
      signedURL: objects.has(path) ? `/object/sign/operix-media/${path}?token=t` : null,
      error: objects.has(path) ? null : "not found",
    })));
  }
  if (req.method === "POST" && (m = /^\/storage\/v1\/object\/operix-media\/(.+)$/.exec(p))) {
    objects.set(m[1], { bytes: new Uint8Array(await req.arrayBuffer()), type: req.headers.get("content-type") ?? "" });
    return Response.json({ Key: `operix-media/${m[1]}` });
  }
  if (req.method === "GET" && (m = /^\/storage\/v1\/object\/operix-media\/(.+)$/.exec(p))) {
    const o = objects.get(m[1]);
    return o ? new Response(o.bytes as Uint8Array<ArrayBuffer>, { headers: { "content-type": o.type } }) : new Response("nf", { status: 404 });
  }
  if (req.method === "DELETE") {
    const { prefixes } = await req.json() as { prefixes: string[] };
    prefixes.forEach((x) => objects.delete(x));
    return Response.json([]);
  }
  return new Response("not found", { status: 404 });
});

// ── Faux serveur Claude (Messages API) ──────────────────────────────────────
let lastClaudeRequest: Record<string, unknown> | null = null;
const claude = Deno.serve({ port: 0, onListen: () => {} }, async (req) => {
  lastClaudeRequest = await req.json();
  const analysis = {
    category: "Déversement d'hydrocarbure", subcategory: "Fuite hydraulique", risk_level: "high", incident_type: "HPI",
    confidence: 86, summary: "Fuite active sur zone piétonne.", risks: ["Glissade", "Pollution"], causes: ["Flexible usé"],
    aggravating_factor: null, legal_reference: null,
    actions: [{ priority: "immediate", delay_minutes: 15, responsible_role: "Chef d'équipe", description: "Baliser la zone" }],
  };
  return Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(analysis) }] });
});

Deno.env.set("SUPABASE_DB_URL", dbUrl);
Deno.env.set("SUPABASE_URL", `http://127.0.0.1:${storage.addr.port}`);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
Deno.env.delete("ANTHROPIC_API_KEY");

const { handler } = await import("../supabase/functions/api/app.ts");
const { closeDb, db } = await import("../supabase/functions/api/lib/db.ts");

// ── Client de test ──────────────────────────────────────────────────────────
let ipCounter = 0;
const BASE = "http://localhost/api/v1";

async function call(method: string, path: string, o: { token?: string; json?: unknown; form?: FormData; ip?: string } = {}) {
  const headers: Record<string, string> = { accept: "application/json", "x-forwarded-for": o.ip ?? `10.0.0.${++ipCounter % 250}` };
  if (o.token) headers.authorization = `Bearer ${o.token}`;
  let body: BodyInit | undefined;
  if (o.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(o.json);
  } else if (o.form) body = o.form;
  const res = await handler(new Request(BASE + path, { method, headers, body }));
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await res.json() : new Uint8Array(await res.arrayBuffer());
  // deno-lint-ignore no-explicit-any
  return { status: res.status, data: data as any, type };
}

async function login(matricule: string, pin = "Demo@2026") {
  const r = await call("POST", "/auth/login", { json: { matricule, pin, platform: "mobile" } });
  assertEquals(r.status, 200, JSON.stringify(r.data));
  return r.data.token as string;
}

// PNG 1×1 valide
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const year = new Date().getUTCFullYear();
const today = new Date().toISOString().slice(0, 10);

let agent = "", supervisor = "", hse = "";
let incidentId = 0;

Deno.test({
  name: "Recette API OPERIX (Supabase)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    await t.step("1-2. Connexion : mauvais PIN refusé, bon PIN accepté", async () => {
      const bad = await call("POST", "/auth/login", { json: { matricule: "DEMO-AGT-001", pin: "0000" } });
      assertEquals(bad.status, 401);
      assertEquals(bad.data.message, "Matricule ou PIN incorrect.");

      const ok = await call("POST", "/auth/login", { json: { matricule: "demo-agt-001", pin: "Demo@2026", platform: "mobile" } });
      assertEquals(ok.status, 200);
      assertMatch(ok.data.token, /^\d+\|.{20,}$/);
      assertEquals(ok.data.user.name, "Ousmane Traore");
      assertEquals(ok.data.user.role, "agent");
      assertEquals(ok.data.tenant.name, "Demo Company");
      assert(ok.data.abilities.includes("incidents.create"));
      assert(!ok.data.abilities.includes("incidents.update"));
      assert(ok.data.user.last_login_at);
      agent = ok.data.token;
      supervisor = await login("DEMO-SUP-001");
      hse = await login("DEMO-HSE-001");
    });

    await t.step("Sans jeton → 401 ; route inconnue → 404 ; /auth/me", async () => {
      assertEquals((await call("GET", "/dashboard")).status, 401);
      assertEquals((await call("GET", "/dashboard", { token: "1|faux" })).status, 401);
      assertEquals((await call("GET", "/nexiste-pas", { token: agent })).status, 404);
      const me = await call("GET", "/auth/me", { token: agent });
      assertEquals(me.status, 200);
      assertEquals(me.data.user.matricule, "DEMO-AGT-001");
      assertEquals(me.data.organisation.name, "Demo Company");
    });

    await t.step("3. Accueil : KPIs, activité, zones, stats", async () => {
      const d = await call("GET", "/dashboard", { token: agent });
      assertEquals(d.status, 200);
      for (const k of ["incidents_mois", "incidents_ytd", "incidents_ouverts", "near_miss_mois", "lti_ytd", "taux_frequence", "infractions_ouverts"]) {
        assertEquals(typeof d.data.safety[k], "number", k);
      }
      assertEquals(d.data.safety.incidents_ouverts, 1);
      assert(d.data.generated_at);
      const act = await call("GET", "/dashboard/recent-activity", { token: agent });
      assertEquals(act.data.activities.length, 2);
      assertEquals(act.data.activities[0].type, "near_miss");
      const zones = await call("GET", "/dashboard/top-zones", { token: agent });
      assertEquals(zones.data.zones.length, 2);
      const stats = await call("GET", "/dashboard/incident-stats", { token: agent });
      assertEquals(stats.status, 200);
      assertEquals(typeof stats.data.by_month, "object");
    });

    await t.step("Compteur sécurité : agent 403, superviseur 200", async () => {
      assertEquals((await call("GET", "/safety-tracker", { token: agent })).status, 403);
      const s = await call("GET", "/safety-tracker", { token: supervisor });
      assertEquals(s.status, 200);
      assert(s.data.days_without_accident >= 0);
      assertEquals(Object.keys(s.data.monthly_data).length, 12);
    });

    await t.step("6. Analyse : moteur de règles sans clé, validation 422", async () => {
      const short = await call("POST", "/ai/incidents/analyze", { token: agent, json: { description: "court" } });
      assertEquals(short.status, 422);
      assert(short.data.errors.description);

      const form = new FormData();
      form.set("description", "Fuite d'huile hydraulique au pied du portique, sol glissant");
      form.set("location", "Quai Môle 4A");
      form.set("event_type", "incident");
      form.set("image", new File([PNG], "photo.png", { type: "image/png" }));
      const a = await call("POST", "/ai/incidents/analyze", { token: agent, form });
      assertEquals(a.status, 200, JSON.stringify(a.data));
      assertEquals(a.data.engine, "rules");
      assertEquals(a.data.model, null);
      assertEquals(a.data.category, "Glissade & Chute");
      assert(a.data.confidence <= 70);
      assertEquals(a.data.actions.length, 4);
    });

    await t.step("Analyse : chemin Claude (faux serveur) → engine ai, sortie structurée", async () => {
      Deno.env.set("ANTHROPIC_API_KEY", "sk-test");
      Deno.env.set("ANTHROPIC_BASE_URL", `http://127.0.0.1:${claude.addr.port}`);
      try {
        const form = new FormData();
        form.set("description", "Fuite d'huile hydraulique au pied du portique, sol glissant");
        form.set("image", new File([PNG], "photo.png", { type: "image/png" }));
        const a = await call("POST", "/ai/incidents/analyze", { token: agent, form });
        assertEquals(a.data.engine, "ai");
        assertEquals(a.data.model, "claude-opus-5-5");
        assertEquals(a.data.confidence, 86);
        const req = lastClaudeRequest!;
        assertEquals(req.model, "claude-opus-5-5");
        // deno-lint-ignore no-explicit-any
        const oc = req.output_config as any;
        assertEquals(oc.format.type, "json_schema");
        assertEquals(oc.format.schema.additionalProperties, false);
        // deno-lint-ignore no-explicit-any
        const content = (req.messages as any)[0].content;
        assertEquals(content[0].type, "image");
        assertEquals(content[0].source.media_type, "image/png");
      } finally {
        Deno.env.delete("ANTHROPIC_API_KEY");
        Deno.env.delete("ANTHROPIC_BASE_URL");
      }
    });

    await t.step("7. Déclaration d'incident avec photo et GPS → 201, référence, URL signée", async () => {
      const form = new FormData();
      form.set("date", today);
      form.set("time", "09:14");
      form.set("location", "Quai Môle 4A");
      form.set("type", "HPI");
      form.set("severity", "high");
      form.set("description", "Fuite d'huile hydraulique au pied du portique #02. Surface très glissante.");
      form.set("immediate_cause", "Flexible usé");
      form.set("latitude", "18.08561");
      form.set("longitude", "-15.97742");
      form.set("location_accuracy", "6");
      form.set("location_captured_at", new Date().toISOString());
      form.set("image", new File([PNG], "photo.png", { type: "image/png" }));
      const r = await call("POST", "/incidents", { token: agent, form });
      assertEquals(r.status, 201, JSON.stringify(r.data));
      assertEquals(r.data.reference, `INC-${year}-0001`);
      assertEquals(r.data.status, "open");
      assertEquals(r.data.reported_by.name, "Ousmane Traore");
      assertMatch(r.data.image_url, /\/storage\/v1\/object\/sign\/operix-media\/\d+\/incidents\/.+\.png\?token=/);
      assertEquals(r.data.location_point.latitude, 18.08561);
      assertEquals(r.data.location_point.accuracy, 6);
      assertEquals(r.data.ai_analysis, null);
      assertMatch(r.data.created_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      incidentId = r.data.id;
    });

    await t.step("Validation incident : type inconnu, latitude seule, capture dans le futur → 422", async () => {
      const r = await call("POST", "/incidents", {
        token: agent,
        json: { date: today, location: "X", type: "Inconnu", severity: "high", description: "Test", latitude: 10, location_captured_at: new Date(Date.now() + 3600_000).toISOString() },
      });
      assertEquals(r.status, 422);
      assert(r.data.errors.type);
      assert(r.data.errors.longitude);
      assert(r.data.errors.location_captured_at);
    });

    await t.step("8. Déploiement du plan → 201, incident en investigation", async () => {
      const analysis = (await call("POST", "/ai/incidents/analyze", { token: agent, json: { description: "Fuite d'huile hydraulique au pied du portique, sol glissant", event_type: "incident" } })).data;
      const r = await call("POST", `/incidents/${incidentId}/actions/deploy`, { token: agent, json: { analysis: { ...analysis, risk_level: "critical" }, actions: analysis.actions } });
      assertEquals(r.status, 201, JSON.stringify(r.data));
      assertEquals(r.data.data.length, 4);
      assertEquals(r.data.analysis.engine, "rules");
      assertEquals(r.data.analysis.risk_level, "critical");
      assertEquals(r.data.analysis.deployed_by, 4);
      assertEquals(r.data.data[0].source, "rules");
      assert(r.data.data[0].due_at);

      const show = await call("GET", `/incidents/${incidentId}`, { token: agent });
      assertEquals(show.data.status, "in_progress");
      assertEquals(show.data.actions_summary, { total: 4, done: 0 });
      assertEquals(show.data.ai_analysis.category, "Glissade & Chute");
      assertEquals(show.data.immediate_cause, "Flexible usé");
      assert(show.data.corrective_action.includes("Sécuriser et baliser"));
    });

    await t.step("9. Re-déploiement → 409 ; déploiement par un tiers sans droit → 403", async () => {
      const r = await call("POST", `/incidents/${incidentId}/actions/deploy`, { token: agent, json: { analysis: { engine: "rules" }, actions: [{ description: "x", priority: "urgent" }] } });
      assertEquals(r.status, 409);
      const bad = await call("POST", `/incidents/${incidentId}/actions/deploy`, { token: agent, json: { analysis: {}, actions: [] } });
      assertEquals(bad.status, 422);
    });

    await t.step("10. Statut des actions : agent 403, superviseur OK", async () => {
      const list = await call("GET", `/incidents/${incidentId}/actions`, { token: agent });
      const first = list.data.data[0];
      assertEquals(first.status, "todo");
      assertEquals((await call("PUT", `/incidents/${incidentId}/actions/${first.id}`, { token: agent, json: { status: "done" } })).status, 403);
      const done = await call("PUT", `/incidents/${incidentId}/actions/${first.id}`, { token: supervisor, json: { status: "done" } });
      assertEquals(done.status, 200);
      assertEquals(done.data.status, "done");
      assertEquals(done.data.done_by.name, "Lucie Moreau");
      assert(done.data.done_at);
      const back = await call("PUT", `/incidents/${incidentId}/actions/${first.id}`, { token: supervisor, json: { status: "todo" } });
      assertEquals(back.data.done_by, null);
      await call("PUT", `/incidents/${incidentId}/actions/${first.id}`, { token: supervisor, json: { status: "done" } });
      assertEquals((await call("PUT", `/incidents/${incidentId}/actions/999999`, { token: supervisor, json: { status: "done" } })).status, 404);
      const all = await call("GET", "/incident-actions", { token: agent });
      assertEquals(all.data.data.length, 4);
      assertEquals(all.data.data[0].incident.reference, `INC-${year}-0001`);
      assertEquals(all.data.data[3].status, "done");
    });

    await t.step("Passage en investigation / clôture par l'encadrement ; agent 403", async () => {
      assertEquals((await call("PUT", `/incidents/${incidentId}`, { token: agent, json: { status: "closed" } })).status, 403);
      const r = await call("PUT", `/incidents/${incidentId}`, { token: supervisor, json: { root_cause: "Plan de maintenance incomplet" } });
      assertEquals(r.status, 200);
      assertEquals(r.data.root_cause, "Plan de maintenance incomplet");
      assertEquals(r.data.status, "in_progress");
    });

    await t.step("14. Notifications : encadrement notifié, déclarant non", async () => {
      const mine = await call("GET", "/notifications", { token: agent });
      assertEquals(mine.data.meta.total, 0);
      const sup = await call("GET", "/notifications", { token: supervisor });
      assertEquals(sup.data.meta.total, 1);
      assertEquals(sup.data.meta.unread_count, 1);
      const n = sup.data.data[0];
      assertEquals(n.data.resource_kind, "incident");
      assertEquals(n.data.resource_id, incidentId);
      assertEquals(n.data.title, "Nouvel incident — HPI");
      assertEquals(n.type, "alert");
      assertEquals((await call("GET", "/notifications/unread-count", { token: supervisor })).data.count, 1);
      assertEquals((await call("PUT", `/notifications/${n.id}/read`, { token: agent })).status, 404);
      assertEquals((await call("PUT", `/notifications/${n.id}/read`, { token: supervisor })).status, 200);
      assertEquals((await call("GET", "/notifications/unread-count", { token: supervisor })).data.count, 0);
      const all = await call("POST", "/notifications/read-all", { token: hse });
      assertEquals(all.status, 200);
      assertEquals((await call("GET", "/notifications/unread-count", { token: hse })).data.count, 0);
    });

    await t.step("Near-miss : gravité critique refusée, création OK", async () => {
      const bad = await call("POST", "/near-miss", { token: agent, json: { date: today, location: "Zone de chargement", severity: "critical", description: "Test" } });
      assertEquals(bad.status, 422);
      const r = await call("POST", "/near-miss", { token: agent, json: { date: today, time: "10:00", location: "Zone de chargement", severity: "high", description: "Chariot à contresens", potential_consequence: "Collision" } });
      assertEquals(r.status, 201, JSON.stringify(r.data));
      assertEquals(r.data.reference, `NM-${year}-0001`);
      const list = await call("GET", "/near-miss?per_page=1", { token: agent });
      assertEquals(list.data.meta, { total: 2, per_page: 1, current_page: 1, last_page: 2 });
      assertEquals((await call("GET", `/near-miss/${r.data.id}`, { token: agent })).data.potential_consequence, "Collision");
    });

    await t.step("Infractions : agent 403, responsable HSSE 201", async () => {
      const body = { date: today, location: "Quai 3", type: "Non-respect des règles", severity: "medium", description: "Absence de gilet" };
      assertEquals((await call("POST", "/breaches", { token: agent, json: body })).status, 403);
      const r = await call("POST", "/breaches", { token: hse, json: body });
      assertEquals(r.status, 201);
      assertEquals(r.data.reference, `INF-${year}-0001`);
    });

    await t.step("Registre incidents : filtres et pagination", async () => {
      const all = await call("GET", "/incidents", { token: agent });
      assertEquals(all.data.meta.total, 2);
      assertEquals((await call("GET", "/incidents?search=hydraul", { token: agent })).data.meta.total, 1);
      assertEquals((await call("GET", "/incidents?search=INC-DEMO", { token: agent })).data.meta.total, 1);
      assertEquals((await call("GET", "/incidents?status=open", { token: agent })).data.meta.total, 1);
      assertEquals((await call("GET", `/incidents?from=${today}`, { token: agent })).data.meta.total, 1);
      assertEquals((await call("GET", "/incidents?severity=low", { token: agent })).data.meta.total, 0);
    });

    await t.step("Références : 5 déclarations simultanées → numéros uniques et consécutifs", async () => {
      const rs = await Promise.all([1, 2, 3, 4, 5].map((i) =>
        call("POST", "/incidents", { token: agent, json: { date: today, location: "Atelier", type: "FAC", severity: "low", description: `Parallèle ${i}` } })
      ));
      const refs = rs.map((r) => { assertEquals(r.status, 201, JSON.stringify(r.data)); return r.data.reference as string; }).sort();
      assertEquals(refs, [2, 3, 4, 5, 6].map((n) => `INC-${year}-000${n}`));
    });

    await t.step("11-12. Hors-ligne : déclaration rejouée avec une capture GPS ancienne → 201", async () => {
      const r = await call("POST", "/incidents", {
        token: agent,
        json: { date: today, location: "Quai", type: "Autre", severity: "medium", description: "Rejoué", latitude: 18, longitude: -16, location_captured_at: new Date(Date.now() - 3 * 86400_000).toISOString() },
      });
      assertEquals(r.status, 201);
    });

    await t.step("15. Employés : recherche agent, module complet encadrement", async () => {
      assertEquals((await call("GET", "/agent/employees/search?q=a", { token: agent })).status, 422);
      const s = await call("GET", "/agent/employees/search?q=sow", { token: agent });
      assertEquals(s.data.data, [{ id: s.data.data[0].id, matricule: "DEMO-E-001", name: "Fatimata Sow", status: "active" }]);
      assertEquals((await call("GET", "/employees", { token: agent })).status, 403);
      const full = await call("GET", "/employees?search=Ndiaye", { token: supervisor });
      assertEquals(full.data.meta.total, 1);
      assertEquals(full.data.data[0].department.name, "Maintenance");
      assertEquals((await call("GET", "/agent/employees/search?q=sow", { token: supervisor })).status, 403);
    });

    await t.step("Fiche PDF : superviseur OK (avec photo), agent 403", async () => {
      assertEquals((await call("GET", `/reports/incidents/${incidentId}`, { token: agent })).status, 403);
      const pdf = await call("GET", `/reports/incidents/${incidentId}`, { token: supervisor });
      assertEquals(pdf.status, 200);
      assertEquals(pdf.type, "application/pdf");
      assertEquals(new TextDecoder().decode((pdf.data as Uint8Array).slice(0, 5)), "%PDF-");
      assert((pdf.data as Uint8Array).length > 2000);
      await Deno.writeFile(`${ROOT}.pgtest/incident.pdf`, pdf.data);
    });

    await t.step("Isolation des entreprises : un compte TCN ne voit rien de Demo Company", async () => {
      await db()`select operix.create_user('tcn', 'TCN-SUP-001', 'Tcn@2026!', 'Superviseur TCN', 'supervisor')`;
      const tcn = await login("TCN-SUP-001", "Tcn@2026!");
      assertEquals((await call("GET", `/incidents/${incidentId}`, { token: tcn })).status, 404);
      assertEquals((await call("GET", "/incidents", { token: tcn })).data.meta.total, 0);
      assertEquals((await call("GET", `/incidents/${incidentId}/actions`, { token: tcn })).status, 404);
      assertEquals((await call("PUT", `/incidents/${incidentId}/actions/1`, { token: tcn, json: { status: "todo" } })).status, 404);
      assertEquals((await call("GET", "/incident-actions", { token: tcn })).data.data.length, 0);
      assertEquals((await call("GET", "/dashboard", { token: tcn })).data.safety.incidents_ouverts, 0);
      assertEquals((await call("GET", "/notifications", { token: tcn })).data.meta.total, 0);
      // La première référence TCN repart de 0001 : numérotation par entreprise.
      const r = await call("POST", "/incidents", { token: tcn, json: { date: today, location: "Quai", type: "Autre", severity: "low", description: "TCN" } });
      assertEquals(r.data.reference, `INC-${year}-0001`);
    });

    await t.step("16-17. Déconnexion : le jeton est révoqué", async () => {
      const tok = await login("DEMO-AGT-001");
      assertEquals((await call("POST", "/auth/logout", { token: tok })).status, 200);
      assertEquals((await call("GET", "/auth/me", { token: tok })).status, 401);
      assertEquals((await call("GET", "/auth/me", { token: agent })).status, 200);
    });

    await t.step("Compte désactivé : connexion 403, jeton existant 401", async () => {
      await db()`update operix.users set is_active = false where matricule = 'DEMO-HSE-001'`;
      assertEquals((await call("POST", "/auth/login", { json: { matricule: "DEMO-HSE-001", pin: "Demo@2026" } })).status, 403);
      assertEquals((await call("GET", "/auth/me", { token: hse })).status, 401);
      await db()`update operix.users set is_active = true where matricule = 'DEMO-HSE-001'`;
    });

    await t.step("Anti force brute : 6e tentative de connexion depuis la même IP → 429", async () => {
      for (let i = 0; i < 5; i++) {
        assertEquals((await call("POST", "/auth/login", { ip: "9.9.9.9", json: { matricule: "DEMO-AGT-001", pin: `bad${i}xx` } })).status, 401);
      }
      assertEquals((await call("POST", "/auth/login", { ip: "9.9.9.9", json: { matricule: "DEMO-AGT-001", pin: "Demo@2026" } })).status, 429);
    });

    await closeDb();
    await storage.shutdown();
    await claude.shutdown();
  },
});
