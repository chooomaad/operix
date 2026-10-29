/** Réponses et erreurs au format de l'ancienne API Laravel (le mobile les lit telles quelles). */

export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, accept, x-client-info, apikey",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export const unauthenticated = () => new HttpError(401, "Unauthenticated.");
export const forbidden = (message = "This action is unauthorized.") => new HttpError(403, message);
export const notFound = (message = "Ressource introuvable.") => new HttpError(404, message);
export const tooManyRequests = () => new HttpError(429, "Trop de tentatives. Réessayez dans une minute.");

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS, ...headers },
  });
}

export function errorResponse(e: HttpError): Response {
  const body: Record<string, unknown> = { message: e.message };
  if (e.errors) body.errors = e.errors;
  return json(body, e.status);
}

/** Corps de requête normalisé : champs (JSON ou formulaire) + fichiers éventuels. */
export interface Body {
  fields: Record<string, unknown>;
  files: Record<string, File>;
}

export async function readBody(req: Request): Promise<Body> {
  const type = req.headers.get("content-type") ?? "";
  const fields: Record<string, unknown> = {};
  const files: Record<string, File> = {};

  if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new HttpError(400, "Corps de requête illisible.");
    }
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") fields[key] = value;
      else if (value.size > 0) files[key] = value;
    }
    return { fields, files };
  }

  const text = await req.text();
  if (!text.trim()) return { fields, files };
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { fields: parsed as Record<string, unknown>, files };
    }
  } catch {
    // traité ci-dessous
  }
  throw new HttpError(400, "JSON invalide.");
}
