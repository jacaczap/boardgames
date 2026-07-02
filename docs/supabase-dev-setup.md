# DEV Supabase setup (Phase 0)

Stands up a **separate DEV Supabase project** so local/emulator and Play internal
builds stop hitting prod. Two parts: a few **guided** dashboard steps, then one
**IaC** script that applies everything else.

## 1. Create the project (guided)

1. Supabase dashboard → **New project**, name `boardgames-dev` (free tier is fine).
2. When ready, from the project's **Settings**:
   - **API keys** → copy the **publishable** key (`sb_publishable_…`, for the app)
     and the **secret** key (`sb_secret_…`, for the backend).
   - **Data API** → note the Project URL `https://<ref>.supabase.co`; `<ref>` is
     the project ref.

> New projects use the new key format and don't auto-expose tables to the Data
> API — both are already handled (grants migration + `apikey` header in
> `invoke_edge_function`). Nothing to configure for that here.

## 2. Configure local secrets

```bash
cp .env.dev.example .env.dev   # gitignored
```

Fill `.env.dev` with the values from step 1 (`DEV_PROJECT_REF`, `DEV_PROJECT_URL`,
`DEV_SECRET_KEY`).

> Two different env files — don't mix them up:
> - **`.env.dev`** — backend/admin config, read **only** by the setup script
>   (bash). Expo never loads it.
> - **`.env.local`** — the app's runtime env, auto-loaded by **Expo**; holds only
>   `EXPO_PUBLIC_*` (step 5). Putting `EXPO_PUBLIC_*` in `.env.dev` has no effect.

## 3. Apply the backend (IaC)

```bash
npm run supabase:setup:dev
```

This links to the dev project, pushes all migrations (schema, grants, RLS,
pg_cron), and deploys all edge functions (`verify_jwt = false` from
`supabase/config.toml`). It finishes by printing the two pg_cron Vault secrets
**with your values already filled in** — paste that output **once** into the dev
project's **SQL editor**. Reprint it anytime with:

```bash
npm run supabase:secrets:dev
```

The printed SQL looks like (with real values substituted):

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<sb_secret_…>', 'service_role_key');
```

Granular re-runs: `db:push:dev`, `functions:deploy:dev`, `supabase:link:dev`.

> Vault secrets go through the SQL editor on purpose. The direct DB host
> (`db.<ref>.supabase.co`) is IPv6-only on new projects, so `psql` from most
> networks fails with "could not translate host name". The SQL editor always
> works and keeps the DB password out of local files. pg_cron can't invoke edge
> functions until these two secrets exist.

## 4. Auth configuration (guided)

Dashboard → **Authentication → Providers/Settings** (matches prod for now):
disable social/OAuth and anonymous sign-in. (Open self-signup + email
verification land in Phase 1.)

## 5. Point the app at DEV

Put the dev project's values in **`.env.local`** (the file Expo auto-loads for
`lib/supabase.ts` — use the **publishable** key, not the secret one):

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=<sb_publishable_…>
```

> `.env.local` currently points at PROD — swap it to DEV to test, and back when
> you need PROD. The env-driven `app.config.ts` / per-EAS-profile variables that
> automate this switch come in later Phase 0 to-dos.

## Verify

- Dashboard → **Database → Cron jobs**: four daily jobs exist.
- Trigger one manually to confirm the `apikey` wiring works:

```sql
select extensions.invoke_edge_function('create-survey');
```

- Log in from the app against DEV and confirm reads/writes work (grants OK).
