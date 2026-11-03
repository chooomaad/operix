import { HttpError } from "./http.ts";

/**
 * Validation minimale, messages en français, erreurs 422 au format Laravel :
 * { message, errors: { champ: [messages] } } — le mobile affiche le premier.
 *
 * Chaque méthode renvoie la valeur nettoyée, `null` si le champ est vide et
 * autorisé à l'être, ou `undefined` s'il est absent (pour les mises à jour
 * partielles). Appeler `done()` à la fin : lève l'erreur 422 s'il y en a.
 */
export class Validator {
  readonly errors: Record<string, string[]> = {};

  constructor(private readonly data: Record<string, unknown>) {}

  private fail(field: string, message: string): undefined {
    (this.errors[field] ??= []).push(message);
    return undefined;
  }

  has(field: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.data, field);
  }

  private raw(field: string): unknown {
    return this.data[field];
  }

  private isEmpty(v: unknown): boolean {
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  }

  string(field: string, o: { required?: boolean; min?: number; max?: number } = {}): string | null | undefined {
    const v = this.raw(field);
    if (this.isEmpty(v)) {
      if (o.required) return this.fail(field, `Le champ ${field} est obligatoire.`);
      return this.has(field) ? null : undefined;
    }
    if (typeof v !== "string" && typeof v !== "number") return this.fail(field, `Le champ ${field} doit être une chaîne.`);
    const s = String(v).trim();
    if (o.min !== undefined && s.length < o.min) return this.fail(field, `Le champ ${field} doit contenir au moins ${o.min} caractères.`);
    if (o.max !== undefined && s.length > o.max) return this.fail(field, `Le champ ${field} ne doit pas dépasser ${o.max} caractères.`);
    return s;
  }

  oneOf<T extends string>(field: string, allowed: readonly T[], o: { required?: boolean } = {}): T | null | undefined {
    const s = this.string(field, o);
    if (s === null || s === undefined) return s;
    if (!(allowed as readonly string[]).includes(s)) return this.fail(field, `La valeur du champ ${field} est invalide.`);
    return s as T;
  }

  /** Date au format YYYY-MM-DD (une date-heure ISO est ramenée à sa date). */
  date(field: string, o: { required?: boolean } = {}): string | null | undefined {
    const s = this.string(field, o);
    if (s === null || s === undefined) return s;
    const m = /^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/.exec(s);
    if (!m || Number.isNaN(Date.parse(`${m[1]}T00:00:00Z`)) || new Date(`${m[1]}T00:00:00Z`).toISOString().slice(0, 10) !== m[1]) {
      return this.fail(field, `Le champ ${field} n'est pas une date valide.`);
    }
    return m[1];
  }

  /** Date-heure ISO 8601, renvoyée en objet Date. */
  dateTime(field: string, o: { required?: boolean; notAfter?: Date } = {}): Date | null | undefined {
    const s = this.string(field, o);
    if (s === null || s === undefined) return s;
    const t = Date.parse(s);
    if (Number.isNaN(t)) return this.fail(field, `Le champ ${field} n'est pas une date valide.`);
    if (o.notAfter && t > o.notAfter.getTime()) return this.fail(field, `Le champ ${field} ne peut pas être dans le futur.`);
    return new Date(t);
  }

  number(field: string, o: { required?: boolean; min?: number; max?: number; integer?: boolean } = {}): number | null | undefined {
    const v = this.raw(field);
    if (this.isEmpty(v)) {
      if (o.required) return this.fail(field, `Le champ ${field} est obligatoire.`);
      return this.has(field) ? null : undefined;
    }
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (!Number.isFinite(n)) return this.fail(field, `Le champ ${field} doit être un nombre.`);
    if (o.integer && !Number.isInteger(n)) return this.fail(field, `Le champ ${field} doit être un entier.`);
    if (o.min !== undefined && n < o.min) return this.fail(field, `Le champ ${field} doit être supérieur ou égal à ${o.min}.`);
    if (o.max !== undefined && n > o.max) return this.fail(field, `Le champ ${field} doit être inférieur ou égal à ${o.max}.`);
    return n;
  }

  object(field: string, o: { required?: boolean } = {}): Record<string, unknown> | undefined {
    const v = this.raw(field);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    if (o.required || v !== undefined) return this.fail(field, `Le champ ${field} doit être un objet.`);
    return undefined;
  }

  array(field: string, o: { required?: boolean; min?: number; max?: number } = {}): unknown[] | undefined {
    const v = this.raw(field);
    if (!Array.isArray(v)) {
      if (o.required || v !== undefined) return this.fail(field, `Le champ ${field} doit être une liste.`);
      return undefined;
    }
    if (o.min !== undefined && v.length < o.min) return this.fail(field, `Le champ ${field} doit contenir au moins ${o.min} élément(s).`);
    if (o.max !== undefined && v.length > o.max) return this.fail(field, `Le champ ${field} ne doit pas contenir plus de ${o.max} éléments.`);
    return v;
  }

  /** Ajoute une erreur trouvée par une règle propre à l'appelant. */
  add(field: string, message: string): void {
    this.fail(field, message);
  }

  done(): void {
    const fields = Object.keys(this.errors);
    if (fields.length === 0) return;
    const first = this.errors[fields[0]][0];
    const more = fields.length > 1 ? ` (et ${fields.length - 1} autre(s) erreur(s))` : "";
    throw new HttpError(422, first + more, this.errors);
  }
}

/** Contrôle d'un fichier image envoyé en multipart (max 5 Mo, comme l'ancienne API). */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function checkImage(v: Validator, field: string, file: File | undefined): File | undefined {
  if (!file) return undefined;
  const type = (file.type || "").toLowerCase();
  if (!IMAGE_TYPES.includes(type)) {
    v.add(field, `Le champ ${field} doit être une image (JPEG, PNG, WebP ou HEIC).`);
    return undefined;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    v.add(field, `Le champ ${field} ne doit pas dépasser 5 Mo.`);
    return undefined;
  }
  return file;
}
