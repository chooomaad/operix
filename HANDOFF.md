# HANDOFF — OPERIX Mobile + operix-api

Ce fichier passe la main à une nouvelle session Claude Code, sur un poste où PHP,
Composer, PostgreSQL, Node et Android sont installés.

## 0. Contexte en 30 secondes

- **operix-api** (Laravel 13, Sanctum, PostgreSQL, multi-tenant) est le backend existant.
  Repo : `github.com/chooomaad/operix-api`, branche **`phase-5-realtime`**.
- **operix-mobile** (Expo SDK 54, Expo Router, NativeWind, TypeScript strict) est la nouvelle
  application terrain. Repo : `github.com/chooomaad/operix-mobile`, branche `main`.
- **Objectif :** démo devant un jury (BAMA Startup 2026). Le parcours suivi est login → accueil →
  déclarer → photo → analyse Operix AI → validation des actions → fiche incident avec chronologie
  → insights.
- **⚠️ Rien n'a jamais été exécuté.** L'ancien poste n'avait ni PHP ni Node : aucun test,
  aucun `tsc`, aucun build. Ta mission est de **faire tourner, tester et corriger**.

## 1. Règles à respecter (consignes de l'utilisateur)

- **Ne pas recréer, casser ni supprimer l'existant du backend.** Les changements sont additifs.
- **Ne pas deviner les endpoints :** lis `routes/api.php`.
- **Aucune fausse donnée** comme source principale. Tout vient de l'API ; les indicateurs
  calculés affichent leur formule.
- **Honnêteté IA :** le champ `engine` (`ai` ou `rules`) est toujours affiché. Ne jamais mettre
  de clé IA dans l'app mobile.
- **TypeScript strict**, pas de `any`.
- **Langue :** l'utilisateur parle français. Réponds en français.
- **Git :** commit uniquement si l'utilisateur le demande, avec cette ligne finale :
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## 2. Ce qui a été ajouté au backend (commit `e10c380`)

| Fichier | Rôle |
|---|---|
| `database/migrations/2026_10_18_100000_create_incident_ai_and_actions.php` | colonne `safety_incidents.ai_analysis` (jsonb) + table `incident_actions` |
| `app/Models/IncidentAction.php` | modèle (BelongsToTenant, Auditable) |
| `app/Models/SafetyIncident.php` | `ai_analysis` fillable et casté, relation `actions()` |
| `app/Services/Ai/IncidentAnalysisSchema.php` | JSON schema + `normalize()` |
| `app/Services/Ai/ClaudeIncidentAnalyzer.php` | appel Claude via `anthropic-ai/sdk` (structured outputs, image en base64) |
| `app/Services/Ai/RuleBasedIncidentAnalyzer.php` | repli par mots-clés, certitude ≤ 70 % |
| `app/Services/Ai/IncidentAnalysisService.php` | Claude si clé présente, sinon règles ; ajoute `engine`, `model`, `duration_ms`, `analyzed_at` |
| `app/Http/Controllers/Api/IncidentAiController.php` | `POST /ai/incidents/analyze` (aucune écriture en base) |
| `app/Http/Controllers/Api/IncidentActionController.php` | `deploy`, `index`, `update`, `open` |
| `app/Http/Resources/IncidentResource.php` | ajoute `ai_analysis`, `actions_summary`, `created_at_iso` |
| `IncidentController::show` | charge `actions` |
| `config/services.php`, `.env.example` | `ANTHROPIC_API_KEY`, `OPERIX_AI_MODEL` (défaut `claude-opus-5-5`) |
| `composer.json` | `"anthropic-ai/sdk": "*"`, **`composer.lock` pas encore mis à jour** |
| `tests/Feature/Api/IncidentAiActionsTest.php` | 3 tests |

Nouvelles routes, toutes sous `auth:sanctum` :
- `POST /api/v1/ai/incidents/analyze` (permission `incidents.create`, throttle 20/min)
- `GET /api/v1/incident-actions` (`incidents.view`)
- `GET /api/v1/incidents/{id}/actions` (`incidents.view`)
- `POST /api/v1/incidents/{id}/actions/deploy` (`incidents.create`, réservé au déclarant ou à
  quelqu'un qui a `incidents.update`, une seule fois par incident sinon 409)
- `PUT /api/v1/incidents/{id}/actions/{actionId}` (`incidents.update`)

## 3. Étapes à faire, dans l'ordre

### A. Backend
```bash
cd operix-api && git pull origin phase-5-realtime
composer update anthropic-ai/sdk          # met à jour composer.lock
php artisan migrate
php artisan test                          # TOUTE la suite : vérifier qu'aucune régression n'apparaît
php artisan test --filter=IncidentAiActionsTest
php artisan db:seed --class=DemoTenantSeeder   # si la base de démo est vide
php artisan serve --host=0.0.0.0 --port=8000
```

**Points fragiles à vérifier en premier :**
1. **API du SDK PHP Anthropic** dans `ClaudeIncidentAnalyzer.php` : les arguments nommés
   (`maxTokens`, `system`, `outputConfig`, `messages`), l'accès `$block->type` / `$block->text`
   et le nom de propriété `stopReason` ou `stop_reason`. Compare avec le code installé dans
   `vendor/anthropic-ai/sdk`.
2. **`Auditable` sur `IncidentAction`** : vérifie que le trait fonctionne pour un modèle sans
   `reference`.
3. **`$request->user()->can('incidents.update')`** dans `deploy` : confirme que cela passe par
   spatie/permission comme le middleware `permission:`.
4. **Tests** : les rôles sont-ils bien affectés par la seule colonne `role` (`agent`,
   `supervisor`…) ? Regarde comment `PermissionMatrixTest` crée ses utilisateurs.
5. **Test avec Claude réel** (si l'utilisateur fournit une clé) :
   ```bash
   curl -X POST http://localhost:8000/api/v1/ai/incidents/analyze \
     -H "Authorization: Bearer <token>" -H "Accept: application/json" \
     -F description="Fuite d'huile hydraulique au pied du portique, sol glissant" \
     -F location="Quai Môle 4A" -F event_type=incident
   ```
   Le jeton s'obtient par `POST /api/v1/auth/login` avec
   `{"matricule":"DEMO-AGT-001","pin":"Demo@2026","platform":"mobile"}`.
   Attendu : `engine: "ai"`, sinon lire `storage/logs/laravel.log` (warning « repli »).

### B. Mobile
```bash
cd operix-mobile
npm install
npx expo install --fix      # les versions SDK 54 ont été écrites de mémoire
npm run typecheck           # corriger toutes les erreurs
echo "EXPO_PUBLIC_API_URL=http://<IP_LAN_DU_PC>:8000/api/v1" > .env
npx expo run:android        # build natif obligatoire, pas Expo Go
```

**Points fragiles côté mobile :**
1. **`expo-speech-recognition`** (`features/declare/VoiceButton.tsx`) : version, nom des
   événements, plugin dans `app.json`. Si cela bloque, la dictée peut être retirée sans casser
   le reste.
2. **`Stack.Protected`** dans `app/_layout.tsx` : requiert expo-router 5 ou plus.
3. **NativeWind v4** : `className` sur des composants tiers ; `SafeAreaView` est déjà passé en
   `style`. Vérifier que les classes s'appliquent bien (`bg-green`, `font-semibold`…).
4. **`expo-file-system/legacy`** (`services/offlineQueue.ts`, `app/incidents/[id].tsx`).
5. **`@react-navigation/bottom-tabs`** importé pour le type `BottomTabBarProps`.
6. **Android en HTTP clair** : si les requêtes échouent alors que l'URL est bonne, il faut
   autoriser le trafic HTTP en clair (`usesCleartextTraffic`, via `expo-build-properties`) pour
   une API locale non HTTPS.

## 4. Recette fonctionnelle (à valider sur un vrai téléphone Android)

| # | Scénario | Attendu |
|---|---|---|
| 1 | Splash puis login `DEMO-AGT-001` / `Demo@2026` | accueil avec le prénom et le nom du tenant |
| 2 | Mauvais PIN | message « Matricule ou PIN incorrect. » |
| 3 | Accueil | KPIs réels (`/dashboard`), activité récente, aucun crash si la base est vide |
| 4 | **+** central | ouvre `Déclarer`, type Incident sélectionné, GPS affiché |
| 5 | Photo caméra puis galerie, Reprendre, Retirer | aperçu correct |
| 6 | Description + **Analyser** | écran d'analyse : catégorie, risque, causes, actions, badge moteur |
| 7 | Ajuster le risque puis **Valider & Déployer** | succès avec référence `INC-2026-xxxx` et liste des actions |
| 8 | **Voir les recommandations & timeline** | fiche avec photo, analyse, plan 0/N, chronologie |
| 9 | Re-déployer le même incident (curl) | 409 |
| 10 | Connexion `DEMO-SUP-001` | statuts d'action modifiables, passage en investigation, PDF téléchargeable |
| 11 | Mode avion + déclaration | « Enregistrer localement », bannière hors-ligne |
| 12 | Retour du réseau | synchronisation automatique, incident visible côté web |
| 13 | Insights 7J / 30J / Trimestre / Année | indice, courbe, zones, causes ; aucun NaN |
| 14 | Notifications | liste, marquer lu, ouvrir l'incident lié |
| 15 | Employés (agent) | recherche ≥ 2 caractères via `/agent/employees/search` |
| 16 | Déconnexion, puis relance | retour au login ; biométrie proposée si elle est configurée |
| 17 | 401 forcé (supprimer le jeton en base) | retour automatique au login |
| 18 | Écrans 360 / 390 / 412 px | aucun débordement horizontal |

## 5. Limites connues (assumées, ne pas « corriger » en inventant)

- **Une photo par déclaration :** l'API ne stocke qu'une image par incident et
  `/media` n'a pas d'endpoint de liste.
- **La clôture d'un incident exige un PDF :** elle se fait côté web.
- **L'agent ne peut pas créer de violation** (`breaches.manage`) : le bouton est grisé.
- **Pas de push FCM** côté backend (bloquant B6 de `docs/MOBILE_API_READINESS.md`).
- **Volontairement absents :** météo et photo du terminal (aucune source de données).

## 6. Quand tu as fini

Fais à l'utilisateur un rapport court : ce qui marche, ce que tu as corrigé (fichiers), ce qui
reste cassé (avec l'erreur exacte). Propose de committer les correctifs.
