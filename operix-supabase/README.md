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
| **Gemini** (clé côté serveur uniquement) | analyse des déclarations ; Claude optionnel et moteur de règles de secours |

## Déployer (≈ 10 minutes)

Prérequis : un projet créé sur [supabase.com](https://supabase.com) et Node.js.

```bash
npm install                                    # installe la CLI Supabase et Deno
npx supabase login
npx supabase link --project-ref <REF_DU_PROJET>

npx supabase db push                           # applique les migrations, dont le GPS des infractions
npx supabase functions deploy api --no-verify-jwt

curl https://<REF_DU_PROJET>.supabase.co/functions/v1/api/v1/health   # → {"status":"ok"}
```

### Activer Gemini (offre gratuite limitée)

1. Créez une clé dans [Google AI Studio](https://aistudio.google.com/api-keys).
2. Dans Supabase, ouvrez **Edge Functions → Secrets** et ajoutez `GEMINI_API_KEY` avec
   cette clé comme valeur. La clé reste côté serveur; ne la mettez jamais dans le mobile.
3. Configurez `OPERIX_AI_PROVIDER=gemini` et (facultatif)
   `OPERIX_GEMINI_MODEL=gemini-3.5-flash-lite` comme secrets, puis redéployez `api`.

Le niveau gratuit a des quotas et modèles disponibles qui peuvent évoluer; consultez
[les tarifs Gemini](https://ai.google.dev/gemini-api/docs/pricing) avant usage. Google
indique que les données du niveau gratuit peuvent être utilisées pour améliorer ses
produits : **n'envoyez pas de données réelles ou confidentielles d'employés/incidents via
ce niveau gratuit**. Utilisez des descriptions fictives pour tester. Le badge
`OPERIX AI ENGINE` indique que le modèle a répondu; `MOTEUR DE RÈGLES` indique un repli
(clé manquante, quota dépassé ou erreur du fournisseur).

Claude reste disponible en option avec `OPERIX_AI_PROVIDER=anthropic`,
`ANTHROPIC_API_KEY` et `OPERIX_AI_MODEL`. Sans clé configurée, le moteur de règles reste
utilisable.

### Mise à jour manuelle du GPS des infractions

Si les migrations ne sont pas déployées avec la CLI, ouvrez **SQL Editor** dans Supabase
et exécutez une fois le contenu de
[`supabase/migrations/20261105000001_breach_geolocation.sql`](./supabase/migrations/20261105000001_breach_geolocation.sql).
Puis déployez la version mise à jour de la fonction `api` et reconstruisez l'application
mobile. Le GPS de premier plan sera alors enregistré aussi pour les violations. Une
permission refusée n'empêche pas la déclaration; aucun suivi continu n'est effectué.

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
| Administration | `GET /admin/sites` · `GET /admin/users` (search, role, site_id, status, page, per_page) · `POST /admin/users` · `PUT /admin/users/{id}` · `GET /admin/employees` (search, status, page, per_page) · `POST /admin/employees` · `POST /admin/employees/import` (500 employés maximum, insertion atomique) · `PUT /admin/employees/{id}` |
| Tableau de bord | `GET /dashboard` · `/dashboard/recent-activity` · `/dashboard/top-zones` · `/dashboard/incident-stats` · `/safety-tracker` |
| Incidents | `GET /incidents` (search, type, severity, status, from, to, page, per_page) · `POST /incidents` (multipart, photo) · `GET /incidents/{id}` · `PUT /incidents/{id}` (clôture avec `incidents.close`) |
| Operix AI | `POST /ai/incidents/analyze` (sans écriture) |
| Plans d'actions | `POST /incidents/{id}/actions/deploy` (une fois, sinon 409) · `GET /incidents/{id}/actions` · `PUT /incidents/{id}/actions/{actionId}` · `GET /incident-actions` |
| Near-miss, infractions | `GET /near-miss` · `POST /near-miss` · `GET /near-miss/{id}` · `POST /breaches` |
| Notifications | `GET /notifications` · `/notifications/unread-count` · `PUT /notifications/{id}/read` · `POST /notifications/read-all` |
| Employés | `GET /agent/employees/search?q=` (agent) · `GET /employees` (encadrement) |
| Rapports | `GET /reports/incidents/{id}` (fiche d'audit PDF) |

Les permissions reprennent la matrice de `operix-api` (`app/Support/Permissions.php`), renvoyée
au mobile dans `abilities`.

La clôture d'un incident (`status: "closed"`) exige la permission `incidents.close`,
réservée aux administrateurs de société et responsables HSSE. Déployez la fonction `api`
après toute mise à jour des routes; le statut est stocké dans la base partagée par le web
et le mobile.

Le portail d’administration séparé se lance et se configure selon
[`../operix-admin/README.md`](../operix-admin/README.md). Il nécessite un compte ayant la
permission `users.manage` ; ses opérations restent limitées à la société du compte connecté,
sauf pour les comptes explicitement autorisés à gérer la plateforme.

### Activer l’administration multi-sociétés

Sans Supabase CLI, ouvrez le **SQL Editor** :

1. Exécutez [`supabase/migrations/20261106000001_platform_admins.sql`](./supabase/migrations/20261106000001_platform_admins.sql).
2. Dans [`supabase/platform_admin_setup.sql`](./supabase/platform_admin_setup.sql), remplacez
   `REMPLACER_PAR_VOTRE_MATRICULE` par le matricule de votre compte `company_admin` actif,
   puis exécutez le script.
3. Déployez la version mise à jour de l'Edge Function `api` avec votre processus habituel.
   La migration et le déploiement backend sont requis avant que les nouvelles fonctions web
   soient utilisables.

Le compte plateforme reste aussi administrateur de sa société; son accès global est accordé
séparément dans `operix.platform_admins`. Il peut créer et suspendre des sociétés, gérer leurs
comptes, employés, incidents, presqu'accidents et violations. La suspension conserve les
données; l'archivage des dossiers est logique et conserve l'historique.

### Déployer l'Edge Function depuis GitHub

Le workflow [Deploy Supabase API](../.github/workflows/deploy-supabase-api.yml) déploie
`api` sans installer ni connecter la CLI sur votre ordinateur. Dans les paramètres du
dépôt GitHub, créez le secret d'action `SUPABASE_ACCESS_TOKEN` à partir d'un access token
Supabase. Ne mettez jamais ce token dans le dépôt ni dans un message. Ensuite, ouvrez
**Actions → Deploy Supabase API → Run workflow**; les changements ultérieurs sous
`operix-supabase/supabase/functions/` se déploieront lors d'un push sur `main`.

## Sécurité

- Le schéma `operix` **n'est pas exposé** par l'API REST auto-générée de Supabase ; RLS y est
  activée sans policy (tout accès direct est refusé). Seule la fonction `api` y accède.
- Jetons d'API : seule leur empreinte SHA-256 est stockée ; la déconnexion révoque le jeton.
- Chaque requête est filtrée par l'entreprise de l'utilisateur (testé : un compte TCN ne voit
  aucune donnée de Demo Company).
- Les fiches employés sont consultables et modifiables depuis l'administration uniquement
  avec la permission `employees.manage`; les départements sont associés à leur entreprise.
- Le GPS de premier plan est joint aux incidents, near-miss et infractions quand l'utilisateur
  autorise la localisation; aucun suivi continu en arrière-plan n'est activé.
- Connexion limitée à 5 tentatives par minute et par IP ; analyse IA à 20 par minute.
- Photos dans un bucket privé ; les clés des fournisseurs IA ne sont jamais envoyées à l'application.

## Tester sur un téléphone Android en USB, tout en local (Windows)

Prérequis sur le PC : **Node.js 20+**, **Docker Desktop** (démarré), **Android Studio**
(SDK). Sur le téléphone : options développeur → **Débogage USB** activé, câble branché.

**Terminal 1 : le backend** (dossier `operix-supabase`)

```powershell
npm install
copy supabase\functions\.env.example supabase\functions\.env
npx supabase start                  # 1re fois : télécharge les images Docker (~5 min)
npx supabase db reset               # tables + comptes démo (PIN Demo@2026)
npx supabase functions serve api --no-verify-jwt
```

**Terminal 2 : le câble USB**

```powershell
adb devices                          # le téléphone doit apparaître en « device »
adb reverse tcp:54321 tcp:54321      # le téléphone joint le PC via localhost (à refaire après chaque rebranchement)
```

**Terminal 3 : l'app** (dossier `operix-mobile`, de préférence dans un chemin court comme `C:\dev\`)

```powershell
Set-Content .env "EXPO_PUBLIC_API_URL=http://localhost:54321/functions/v1/api/v1" -Encoding ascii
npm install
npx expo run:android                 # 1er build ~10-15 min, puis l'app s'ouvre sur le téléphone
```

Connexion : `DEMO-AGT-001` / `Demo@2026` (agent) ou `DEMO-SUP-001` (superviseur).
Studio Supabase local (pour voir les tables, les photos) : http://localhost:54323.

## Tester en local (sans Docker)

```bash
npm test
```

Lance un PostgreSQL local avec les schémas Supabase reproduits (`tests/supabase_stubs.sql`),
applique migrations et seed, puis déroule la recette du HANDOFF : connexion,
KPIs, analyse (règles et fournisseurs IA simulés), déclaration avec photo et GPS, déploiement du plan et
409, statuts d'actions, notifications, near-miss, infractions, filtres, numérotation concurrente,
rejeu hors-ligne, employés, PDF, gestion des utilisateurs (droits, création, recherche,
modification et désactivation), isolation des entreprises, déconnexion, compte désactivé,
anti force brute. Requiert les binaires PostgreSQL 17 (`PGBIN` pour un autre chemin).
Sur Windows, la recette utilise Git Bash. Avec PostgreSQL 17 installé dans son chemin
par défaut, configurez le terminal PowerShell avant de lancer les tests :

```powershell
$env:PATH = 'C:\Program Files\Git\bin;C:\Program Files\PostgreSQL\17\bin;' + $env:PATH
$env:PGBIN = '/c/Program Files/PostgreSQL/17/bin'
npm test
```

Avec Docker, `npx supabase start` puis `npx supabase functions serve api --no-verify-jwt`
lance la pile Supabase complète.

### Brancher l'app mobile sur le backend local

```bash
tests/db_reset.sh                                                         # base + données démo
npx deno run -A --config supabase/functions/api/deno.json tests/dev_server.ts
```

Le serveur imite les URLs d'un projet Supabase sur le port 54321 (photos comprises). Dans
`operix-mobile/.env` : `EXPO_PUBLIC_API_URL=http://<IP_DU_PC>:54321/functions/v1/api/v1`
(téléphone sur le même Wi-Fi), ou `http://127.0.0.1:54321/...` pour `npx expo start --web`.
En HTTP clair, Android bloque les requêtes dans un build de production : utiliser un build
de développement, ou le projet Supabase en ligne (HTTPS).

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
