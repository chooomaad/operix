import postgres from "postgres";

/**
 * Connexion directe à la base du projet. Supabase injecte SUPABASE_DB_URL dans
 * chaque Edge Function : on lit et écrit le schéma privé `operix` sans passer
 * par PostgREST, avec de vraies transactions (références, déploiement de plan).
 */
export type Sql = postgres.Sql<Record<string, unknown>>;
export type Tx = postgres.TransactionSql<Record<string, unknown>>;
export type Db = Sql | Tx;

let client: Sql | null = null;

export function db(): Sql {
  if (client) return client;
  const url = Deno.env.get("SUPABASE_DB_URL") ?? Deno.env.get("DATABASE_URL");
  if (!url) throw new Error("SUPABASE_DB_URL manquant");
  client = postgres(url, {
    // Le pooler de Supabase (mode transaction) n'accepte pas les requêtes préparées.
    prepare: false,
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
    transform: { undefined: null },
    types: {
      // int8 (identifiants, count) : nombres JS, comme dans l'API Laravel.
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: number | bigint) => String(x),
        parse: (x: string) => Number(x),
      },
      // date : gardée en texte 'YYYY-MM-DD' (jamais de décalage horaire).
      date: {
        to: 1082,
        from: [1082],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
    },
  }) as unknown as Sql;
  return client;
}

/** Ferme la connexion (tests). */
export async function closeDb(): Promise<void> {
  if (client) await client.end({ timeout: 5 });
  client = null;
}
