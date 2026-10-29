// OPERIX — API mobile sur Supabase Edge Functions.
// Déploiement : supabase functions deploy api --no-verify-jwt
import { handler } from "./app.ts";

Deno.serve(handler);
