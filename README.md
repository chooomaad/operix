# OPERIX Mobile

Application terrain HSSE (Expo / React Native / TypeScript) branchée sur **operix-api**.
« Report • Understand • Prevent »

## Démarrer

```bash
npm install
npx expo install --fix          # aligne les versions natives sur le SDK Expo installé
cp .env.example .env            # EXPO_PUBLIC_API_URL=http://<ip-du-poste>:8000/api/v1
npx expo prebuild && npx expo run:android
```

La dictée vocale (`expo-speech-recognition`) et la biométrie sont des modules natifs :
utiliser un **development build**, pas Expo Go.

APK de démonstration : `npm run build:apk` (EAS, profil `preview`).

## Côté serveur (operix-api)

```bash
composer update anthropic-ai/sdk   # dépendance ajoutée au composer.json
php artisan migrate                # table incident_actions + colonne ai_analysis
# .env : ANTHROPIC_API_KEY=...     (vide = moteur de règles, signalé dans l'app)
php artisan test --filter=IncidentAiActionsTest
```

Comptes démo (DemoTenantSeeder) : `DEMO-AGT-001` / `DEMO-SUP-001` / `DEMO-HSE-001`, PIN `Demo@2026`.

## Architecture

| Dossier | Rôle |
|---|---|
| `app/` | Routes Expo Router : `login`, `(tabs)` (Accueil, Sécurité, Insights, Profil), `declare/` (saisie → analyse → succès), `incidents/`, `near-miss`, `actions`, `notifications`, `employees`, `settings` |
| `components/` | Design system (`ui/`) + composants métier (IncidentCard, ActionCard, AIInsightCard, BottomNavigation…) |
| `features/` | Logique par domaine : auth, déclaration, timeline, insights |
| `services/` | Un fichier par domaine API, client Axios unique (`api.ts`), file hors-ligne |
| `hooks/` | `useQuery` (cache SWR mémoire), pagination, réseau, GPS |
| `types/` | Contrats JSON recopiés des Resources Laravel |
| `constants/` | Tokens de design, configuration |

## Endpoints utilisés

Tous existants dans `routes/api.php`, sauf les trois marqués ★ (ajoutés) :

- `POST /auth/login` (`platform: mobile`), `GET /auth/me`, `POST /auth/logout`
- `GET /dashboard`, `/dashboard/recent-activity`, `/dashboard/top-zones`, `/dashboard/incident-stats`, `/safety-tracker` (encadrement)
- `GET|POST /incidents`, `GET /incidents/{id}`, `PUT /incidents/{id}` (statut)
- `GET|POST /near-miss`, `POST /breaches` (encadrement HSSE)
- ★ `POST /ai/incidents/analyze` — analyse sans écriture
- ★ `POST /incidents/{id}/actions/deploy`, `GET /incidents/{id}/actions`, `PUT /incidents/{id}/actions/{actionId}`, `GET /incident-actions`
- `GET /notifications`, `/notifications/unread-count`, `PUT /notifications/{id}/read`, `POST /notifications/read-all`
- `GET /agent/employees/search` (agent) ou `GET /employees` (encadrement)
- `GET /reports/incidents/{id}` (PDF, encadrement)

## Choix assumés

- **Aucune donnée fictive** : chaque chiffre vient de l'API ; les indicateurs dérivés (indice de
  prévention, projection) affichent leur formule.
- **IA honnête** : `engine = ai | rules` est toujours affiché. Sans clé serveur, le moteur de règles
  répond avec une certitude plafonnée à 70 %.
- **Hors-ligne réel** : incidents et near-miss sont mis en file locale (photo copiée) et rejoués
  au retour du réseau. L'analyse IA exige le réseau.
- **Une photo par déclaration** : l'API stocke une image par incident (`image`, 5 Mo).
- **Clôture** : exige un rapport PDF côté API → faite depuis le web.
