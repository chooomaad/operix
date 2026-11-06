# OPERIX — portail d’administration

Portail web séparé pour gérer les sociétés, leurs comptes utilisateurs, les fiches
employés, incidents, presqu’accidents et violations. L’interface communique exclusivement
avec l’API ; aucune clé privilégiée Supabase n’est utilisée dans le navigateur.

## Lancer en local

Démarrez d’abord le backend Supabase local comme décrit dans
[`../operix-supabase/README.md`](../operix-supabase/README.md). L’API doit être joignable
à `http://localhost:54321/functions/v1/api/v1`.

Dans un autre terminal :

```powershell
cd operix-admin
npm install
Copy-Item .env.example .env
npm run dev
```

Ouvrez l’URL affichée par Vite, généralement `http://localhost:5173`. Avec les données
de démonstration du backend, connectez-vous avec `DEMO-ADM-001` et le PIN `Demo@2026`.
Les administrateurs de société peuvent gérer les données de leur propre entreprise.
L’accès multi-sociétés est réservé aux administrateurs plateforme explicitement
enregistrés dans `operix.platform_admins`.

### Activer le compte administrateur plateforme

1. Appliquez `../operix-supabase/supabase/migrations/20261106000001_platform_admins.sql`
   dans Supabase SQL Editor.
2. Ouvrez `../operix-supabase/supabase/platform_admin_setup.sql`, remplacez
   `REMPLACER_PAR_VOTRE_MATRICULE` par le matricule de votre compte
   `company_admin` actif, puis exécutez ce script dans SQL Editor.
3. Déployez la nouvelle Edge Function `api` avant de vous reconnecter au portail.

Le compte conservera son rôle d’administrateur de société et recevra séparément le droit
`platform.manage`. Les comptes société ne peuvent pas appeler les routes plateforme.

## Configuration et build

Le fichier `.env` local configure `VITE_API_URL` vers le projet Supabase OPERIX.
Pour cibler un autre environnement, définissez la variable avec l’URL complète de l’API, par exemple :

```dotenv
VITE_API_URL=https://vnsuwwglgbqumizqsvoy.supabase.co/functions/v1/api/v1
```

Puis vérifiez et générez les fichiers statiques :

```powershell
npm run build
npm run preview
```

Publiez le contenu généré dans `dist/` sur un hébergement web statique. Configurez
`VITE_API_URL` avant le build de production et autorisez le domaine du portail dans la
configuration CORS du backend. Le portail permet de créer et modifier les comptes OPERIX
ainsi que de gérer les fiches employés (matricule, poste, département, contrat et statut).
Les routes de gestion des fiches nécessitent le droit `employees.manage`.

### Déployer sur Vercel

Importez le dépôt GitHub `chooomaad/operix` dans Vercel et configurez le projet ainsi :

- **Root Directory** : `operix-admin`
- **Framework Preset** : Vite
- **Build Command** : `npm run build`
- **Output Directory** : `dist`
- **Environment Variable** : `VITE_API_URL=https://vnsuwwglgbqumizqsvoy.supabase.co/functions/v1/api/v1`

Le fichier `vercel.json` configure le fallback SPA. L’API OPERIX actuelle accepte les
requêtes cross-origin; l’authentification et les permissions sont contrôlées côté serveur.

Dans **Employés**, utilisez **Télécharger le modèle CSV** pour obtenir les en-têtes
acceptés, puis **Importer un CSV** pour vérifier les lignes avant confirmation.
Le fichier doit être en UTF-8, avec `prenom` et `nom` obligatoires. Les colonnes
facultatives sont `matricule`, `poste`, `department`, `type_contrat`, `gender`,
`date_embauche`, `nationalite` et `is_active`. Le séparateur virgule ou point-virgule
est détecté automatiquement; les dates acceptent `AAAA-MM-JJ` ou `JJ/MM/AAAA`.
Un import est limité à 500 employés et 5 Mo. Les matricules présents dans le fichier
ou déjà utilisés pour la société sont refusés; aucune ligne n'est insérée si une erreur
est détectée. L'API doit être redéployée avec la route `POST /admin/employees/import`
avant de lancer un import.

Le jeton de session reste en mémoire dans l’onglet et est supprimé à la déconnexion.
Les PIN ne sont jamais renvoyés par l’API ; ils sont hachés côté serveur.

Les administrateurs plateforme peuvent créer plusieurs sociétés et sélectionner une
société à gérer. Chaque société reçoit un site principal; créez ensuite son administrateur
depuis l’écran Utilisateurs. Les dossiers ont une référence société et sont consultés avec
un contexte société explicite. Incidents, presqu’accidents et violations peuvent être
créés, modifiés et archivés (archivage réversible côté base, sans suppression destructive).
Les états partagés par le mobile et le portail sont stockés dans la même API.

La clôture des incidents reste réservée aux comptes autorisés par `incidents.close`.
Les PIN sont hachés côté serveur et ne sont jamais renvoyés au portail. Le thème clair ou
sombre est mémorisé dans le navigateur.
