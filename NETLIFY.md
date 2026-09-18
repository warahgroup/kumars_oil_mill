# Deploy Kumar Oil Mill on Netlify

## Build settings (also in `netlify.toml`)

| Setting        | Value           |
|----------------|-----------------|
| Build command  | `npm run build` |
| Publish folder | `dist`          |

## Environment variables (Site settings → Environment variables)

Add these for **Production** (and **Deploy previews** if you use PR previews):

| Key | Notes |
|-----|--------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key |
| `VITE_SINGLE_USER_EMAIL` | Auto sign-in email |
| `VITE_SINGLE_USER_PASSWORD` | Must be **≥ 6 characters** (Supabase rule) |

Do **not** commit real secrets to Git. Set them only in the Netlify UI.

After changing env vars, trigger **Deploys → Trigger deploy → Clear cache and deploy site**.

## Connect repository

1. Push this project to GitHub/GitLab/Bitbucket.
2. [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**.
3. Select the repo; Netlify reads `netlify.toml` automatically.
4. Add the four environment variables above.
5. Deploy.

## SPA routing

React Router is supported via `netlify.toml` redirects and `public/_redirects` (copied into `dist` on build).

## Local production check

```bash
npm run build
npm run preview
```
