# OPERIX — portail d’administration

Portail web séparé pour gérer les utilisateurs et leurs accès OPERIX. L’interface
communique exclusivement avec l’API ; aucune clé privilégiée Supabase n’est utilisée
dans le navigateur.

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
Seuls les comptes qui disposent de la permission `users.manage` peuvent ouvrir le portail.

## Configuration et build

Définissez `VITE_API_URL` dans `.env` avec l’URL complète de l’API, par exemple :

```dotenv
VITE_API_URL=https://<REF_DU_PROJET>.supabase.co/functions/v1/api/v1
```

Puis vérifiez et générez les fichiers statiques :

```powershell
npm run build
npm run preview
```

Publiez le contenu généré dans `dist/` sur un hébergement web statique. Configurez
`VITE_API_URL` avant le build de production et autorisez le domaine du portail dans la
configuration CORS du backend.

Le jeton de session reste en mémoire dans l’onglet et est supprimé à la déconnexion.
Les PIN ne sont jamais renvoyés par l’API ; ils sont hachés côté serveur.
