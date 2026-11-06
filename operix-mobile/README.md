# OPERIX Mobile

Application terrain HSSE (Expo / React Native / TypeScript) branchée sur **operix-supabase** (backend Supabase).
« Report • Understand • Prevent »

## Démarrer

```bash
npm install
cp .env.example .env            # EXPO_PUBLIC_API_URL=https://<REF>.supabase.co/functions/v1/api/v1
npx expo prebuild && npx expo run:android
```

La dictée vocale (`expo-speech-recognition`) et la biométrie sont des modules natifs :
utiliser un **development build**, pas Expo Go.

Après l'ajout ou la modification d'un module natif, reconstruisez et réinstallez l'APK
(`npm run build:apk`). Une mise à jour JavaScript seule ou Expo Go ne peut pas ajouter
`expo-speech-recognition` à une application Android déjà installée.

Sur iPhone, les permissions microphone et reconnaissance vocale sont configurées dans
`app.json`. Il faut aussi créer et installer un build iOS natif (`npm run build:ios`) :
un APK Android ne peut pas être installé sur iPhone. Un build iOS de distribution
interne nécessite un compte Apple Developer et l'enregistrement de l'appareil auprès
d'Expo/EAS.

APK de démonstration : `npm run build:apk` (EAS, profil `preview`).

### Tester sur iPhone (SDK 58)

Expo Go installé depuis l'App Store iOS prend en charge au maximum le SDK 54. Pour tester
ce projet en SDK 58 sur un iPhone, utilisez le client de développement :

```bash
npx eas-cli build --platform ios --profile development
npx expo start --dev-client --lan
```

Installez sur l'iPhone le build iOS fourni par EAS, puis ouvrez le projet avec ce client
de développement. La compilation iOS EAS nécessite un compte Expo et un compte Apple
Developer.

Version navigateur (démo sur ordinateur, recette) : `npx expo start --web`. Le jeton y est
gardé dans le stockage du navigateur au lieu du coffre sécurisé du téléphone.

Dans **Paramètres → Apparence**, le thème clair/sombre est mémorisé sur l'appareil; le thème
sombre utilise des tons anthracite. La déclaration demande la position GPS au premier plan
sans demander de lieu à saisir. Si la permission est refusée ou le GPS indisponible, la
déclaration reste possible. **Décrire vocalement** dicte le texte dans le constat; aucun
fichier audio n'est envoyé à l'API OPERIX.

## Côté serveur

Le backend est **operix-supabase** (Supabase : Postgres, Auth, Storage, Edge Function `api`).
Il sert les mêmes routes `/api/v1` que l'ancienne API Laravel : voir son README pour le
déploiement. Comptes démo : `DEMO-AGT-001` / `DEMO-SUP-001` / `DEMO-HSE-001`, PIN `Demo@2026`.

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

Servis par l'Edge Function `api` d'operix-supabase (identiques à l'ancienne API Laravel) :

- `POST /auth/login` (`platform: mobile`), `GET /auth/me`, `POST /auth/logout`
- `GET /dashboard`, `/dashboard/recent-activity`, `/dashboard/top-zones`, `/dashboard/incident-stats`, `/safety-tracker` (encadrement)
- `GET|POST /incidents`, `GET /incidents/{id}`, `PUT /incidents/{id}` (statut)
- `GET|POST /near-miss`, `POST /breaches` (encadrement HSSE)
- ★ `POST /ai/incidents/analyze` — analyse sans écriture
- ★ `POST /incidents/{id}/actions/deploy`, `GET /incidents/{id}/actions`, `PUT /incidents/{id}/actions/{actionId}`, `GET /incident-actions`
- `GET /notifications`, `/notifications/unread-count`, `PUT /notifications/{id}/read`, `POST /notifications/read-all`
- `GET /agent/employees/search` (agent, recherche par matricule/nom à partir de 2 caractères) ou `GET /employees` (encadrement autorisé, liste initiale et recherche avec pagination)
- `GET /reports/incidents/{id}` (PDF, encadrement)

## Choix assumés

- **Aucune donnée fictive** : chaque chiffre vient de l'API ; les indicateurs dérivés (indice de
  prévention, projection) affichent leur formule.
- **IA honnête** : `engine = ai | rules` est toujours affiché. Sans clé serveur, le moteur de règles
  répond avec une certitude plafonnée à 70 %.
- **Hors-ligne réel** : incidents et near-miss sont mis en file locale (photo copiée) et rejoués
  au retour du réseau. L'analyse IA exige le réseau.
- **Une photo par déclaration** : l'API stocke une image par incident (`image`, 5 Mo).
- **Clôture** : réservée au portail web aux rôles autorisés; l'état est partagé avec le
  mobile et visible après actualisation. La fiche d'audit PDF est téléchargeable séparément.
