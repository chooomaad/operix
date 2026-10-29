/**
 * Photos terrain dans Supabase Storage (bucket privé `operix-media`).
 * L'Edge Function écrit avec la clé service_role ; le mobile ne reçoit que des
 * URLs signées à durée limitée, jamais un accès direct au bucket.
 */
export const BUCKET = "operix-media";
const SIGNED_URL_TTL = 60 * 60 * 24; // 24 h : le temps d'une consultation terrain

function base(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL manquant");
  return url.replace(/\/$/, "");
}

function serviceKey(): string {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant");
  return key;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = serviceKey();
  return { authorization: `Bearer ${key}`, apikey: key, ...extra };
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

/** Envoie un fichier et renvoie son chemin dans le bucket : `<tenant>/<dossier>/<uuid>.<ext>`. */
export async function storeFile(tenantId: number, folder: string, file: File): Promise<string> {
  const type = (file.type || "application/octet-stream").toLowerCase();
  const path = `${tenantId}/${folder}/${crypto.randomUUID()}.${EXTENSIONS[type] ?? "bin"}`;
  const res = await fetch(`${base()}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: headers({ "content-type": type, "x-upsert": "false" }),
    body: file,
  });
  if (!res.ok) throw new Error(`Storage upload ${res.status}: ${await res.text()}`);
  return path;
}

/** Suppression best-effort (annulation d'une création qui a échoué en base). */
export async function deleteFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await fetch(`${base()}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: headers({ "content-type": "application/json" }),
      body: JSON.stringify({ prefixes: paths }),
    });
  } catch (e) {
    console.error("Storage delete", e);
  }
}

/** URLs signées pour une liste de chemins (un seul appel réseau). Chemin inconnu → absent de la Map. */
export async function signedUrls(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  try {
    const res = await fetch(`${base()}/storage/v1/object/sign/${BUCKET}`, {
      method: "POST",
      headers: headers({ "content-type": "application/json" }),
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL, paths: unique }),
    });
    if (!res.ok) throw new Error(`Storage sign ${res.status}: ${await res.text()}`);
    const items = (await res.json()) as { path: string; signedURL: string | null; error: string | null }[];
    for (const it of items) {
      if (it.signedURL) out.set(it.path, `${base()}/storage/v1${it.signedURL}`);
    }
  } catch (e) {
    // Une photo indisponible ne doit pas empêcher d'afficher l'incident.
    console.error("Storage sign", e);
  }
  return out;
}

export async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  return (await signedUrls([path])).get(path) ?? null;
}

/** Contenu d'un fichier (photo à joindre au PDF). */
export async function downloadFile(path: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    const res = await fetch(`${base()}/storage/v1/object/${BUCKET}/${path}`, { headers: headers() });
    if (!res.ok) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "" };
  } catch {
    return null;
  }
}
