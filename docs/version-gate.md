# Minimum supported version (force-update gate)

Lets us **lock outdated native apps out of the backend** without shipping code —
handy when a change makes old installs incompatible (breaking DB/RLS/schema or
edge-function change, or removed client behavior). Web is exempt (always current
on Vercel).

## How it works

- `app_config` table (Supabase, public read) holds one row per platform with
  `min_version` and a `store_url`
  (`supabase/migrations/20260702000200_app_config.sql`).
- On launch, before login, `checkVersionGate()` (`lib/version.ts`) compares the
  running build's version (`Constants.expoConfig?.version`, sourced from
  `app.config.ts`) against `min_version` for the current platform.
- If the build is older, a non-dismissible **Update required** screen
  (`components/UpdateRequiredScreen.tsx`) replaces the app, with a store-link
  button. Wired in `app/_layout.tsx`.
- **Fails open**: web, missing config, or any error → not blocked, so a backend
  hiccup can't lock everyone out.

## The two versions (why both must move together)

The gate compares **`min_version`** (in the DB) against the build's
**`version`** (in `app.config.ts`, currently `1.0.0`). Every build reports
whatever `app.config.ts` says. So if you raise `min_version` above the version
your latest build ships, even that latest build gets blocked.

Rule: a released build's `app.config.ts` `version` must be **≥** the
`min_version` you set.

## Forcing an update (later)

Do this only when old installs are actually incompatible:

1. **Bump `app.config.ts` `version`** (e.g. `1.0.0` → `1.1.0`) in the release
   that contains the breaking change, and ship it to the store.
2. **Once that build is live**, raise `app_config.min_version` to that version
   for the affected platform(s) — either:
   - dashboard: edit the `app_config` row, or
   - a new migration (`update public.app_config set min_version = '1.1.0' …`).

Order matters: publish the new build first, *then* raise `min_version`, so
blocked users have an update to install.

`store_url` holds the "Update now" link (android → Play Store; iOS is `null`
until published). Update it only if the listing changes.
