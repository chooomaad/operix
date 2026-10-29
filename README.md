# OPERIX — backend Supabase

Backend de l'application mobile **OPERIX** (HSSE terrain) sur **Supabase**.
Il reproduit à l'identique les routes `/api/v1` de l'ancienne API Laravel utilisées par
`operix-mobile` : l'application fonctionne sans modification de code, seule l'URL change.

| Brique | Rôle |
|---|---|
| **PostgreSQL** (schéma privé `operix`) | entreprises, comptes, incidents, near-miss, infractions, plans d'actions, notifications, jetons |
| **Supabase Auth** | comptes utilisateurs ; le **PIN est le mot de passe** du compte (bcrypt) |
| **Supabase Storage** (bucket privé `operix-media`) | photos terrain, servies en URLs signées 24 h |
| **Edge Function `api`** (Deno / TypeScript) | toutes les routes, permissions par rôle, isolation par entreprise, Operix AI, fiche PDF |
| **Claude** (clé côté serveur uniquement) | analyse des déclarations ; moteur de règles de secours sans clé |

## Déployer (≈ 10 minutes)

Prérequis : un projet créé sur [supabase.com](https://supabase.com) et Node.js.

```bash
npm install                                    # installe la CLI Supabase et Deno
npx supabase login
npx supabase link --project-ref <REF_DU_PROJET>

npx supabase db push                           # crée le schéma operix et le bucket photos
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # optionnel : sans clé, moteur de règles
npx supabase functions deploy api --no-verify-jwt

curl https://<REF_DU_PROJET>.supabase.co/functions/v1/api/v1/health   # → {"status":"ok"}
```

Puis dans `operix-mobile/.env` :

```bash
EXPO_PUBLIC_API_URL=https://<REF_DU_PROJET>.supabase.co/functions/v1/api/v1
```

L'API étant servie en HTTPS, le blocage Android du trafic HTTP en clair (point 6 du HANDOFF)
ne se pose plus.

### Données

- **Démo (recette, jury)** : `npx supabase db push --include-seed` ou coller `supabase/seed.sql`
  dans le SQL Editor. Crée l'organisation TCN et la « Demo Company » avec les comptes
  `DEMO-ADM-001`, `DEMO-HSE-001`, `DEMO-SUP-001`, `DEMO-AGT-001` (PIN `Demo@2026`).
  **Jamais en production.**
- **Vrais comptes** : dans le SQL Editor,

  ```sql
  select operix.create_user('tcn', 'TCN-ADM-001', 'PinSecret', 'Prénom Nom', 'company_admin', 'admin@exemple.mr');
  ```

  Rôles : `company_admin`, `hsse_manager`, `supervisor`, `agent`. Le PIN doit faire **au moins
  6 caractères** (règle Supabase Auth). Les comptes apparaissent dans *Authentication* ; y changer
  le mot de passe change le PIN.

## Routes servies

Toutes sous `/functions/v1/api/v1`, jeton `Authorization: Bearer <token>` sauf la connexion.

| Domaine | Routes |
|---|---|
| Auth | `POST /auth/login` · `GET /auth/me` · `POST /auth/logout` |
| Tableau de bord | `GET /dashboard` · `/dashboard/recent-activity` · `/dashboard/top-zones` · `/dashboard/incident-stats` · `/safety-tracker` |
| Incidents | `GET /incidents` (search, type, severity, status, from, to, page, per_page) · `POST /incidents` (multipart, photo) · `GET /incidents/{id}` · `PUT /incidents/{id}` |
| Operix AI | `POST /ai/incidents/analyze` (sans écriture) |
| Plans d'actions | `POST /incidents/{id}/actions/deploy` (une fois, sinon 409) · `GET /incidents/{id}/actions` · `PUT /incidents/{id}/actions/{actionId}` · `GET /incident-actions` |
| Near-miss, infractions | `GET /near-miss` · `POST /near-miss` · `GET /near-miss/{id}` · `POST /breaches` |
| Notifications | `GET /notifications` · `/notifications/unread-count` · `PUT /notifications/{id}/read` · `POST /notifications/read-all` |
| Employés | `GET /agent/employees/search?q=` (agent) · `GET /employees` (encadrement) |
| Rapports | `GET /reports/incidents/{id}` (fiche d'audit PDF) |

Les permissions reprennent la matrice de `operix-api` (`app/Support/Permissions.php`), renvoyée
au mobile dans `abilities`.

## Sécurité

- Le schéma `operix` **n'est pas exposé** par l'API REST auto-générée de Supabase ; RLS y est
  activée sans policy (tout accès direct est refusé). Seule la fonction `api` y accède.
- Jetons d'API : seule leur empreinte SHA-256 est stockée ; la déconnexion révoque le jeton.
- Chaque requête est filtrée par l'entreprise de l'utilisateur (testé : un compte TCN ne voit
  aucune donnée de Demo Company).
- Connexion limitée à 5 tentatives par minute et par IP ; analyse IA à 20 par minute.
- Photos dans un bucket privé ; la clé Claude n'est jamais envoyée à l'application.

## Tester en local (sans Docker)

```bash
npm test
```

Lance un PostgreSQL local avec les schémas Supabase reproduits (`tests/supabase_stubs.sql`),
applique migrations et seed, puis déroule 24 scénarios de la recette du HANDOFF : connexion,
KPIs, analyse (règles et Claude simulé), déclaration avec photo et GPS, déploiement du plan et
409, statuts d'actions, notifications, near-miss, infractions, filtres, numérotation concurrente,
rejeu hors-ligne, employés, PDF, isolation des entreprises, déconnexion, compte désactivé,
anti force brute. Requiert les binaires PostgreSQL 16 (`PGBIN` pour un autre chemin).

Avec Docker, `npx supabase start` puis `npx supabase functions serve api --no-verify-jwt`
lance la pile Supabase complète.

## Écarts assumés avec l'API Laravel

- **Périmètre mobile uniquement** : RH, permis de travail, formations, visiteurs, environnement,
  exports… restent sur `operix-api`.
- `GET /dashboard` ne renvoie que les blocs `safety` et `employees` (ceux que lit le mobile).
- `/agent/employees/search` renvoie aussi `id` (le mobile s'en sert comme clé de liste ; l'ancienne
  API ne l'envoyait pas, ce qui donnait des clés en double).
- Pas de diffusion temps réel (Reverb) : les notifications sont écrites en base et lues par
  l'app ; Supabase Realtime pourra être branché plus tard.
- `involved_people` est toujours vide (non saisi par le mobile). La clôture avec rapport PDF
  reste une fonction du web.
