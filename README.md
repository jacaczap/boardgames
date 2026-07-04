# BoardGames Meeting Planner

A React Native (Expo) app for a friend group to coordinate board game meetings -- vote on dates and games, approve meetings, and get push notifications.

## Tech Stack

- **Expo** (managed workflow) + **expo-router** (file-based navigation)
- **Supabase** -- Auth, Postgres, Storage, Edge Functions, Realtime
- **gluestack-ui v2** -- UI components
- **TypeScript** throughout
- **Vercel** -- Web hosting (auto-deploys from GitHub)
- **Platforms**: Android, iOS, Web

## Features

- **Survey voting** -- date picker (weekends + Polish holidays + custom dates), game multi-select with 3-play streak logic, "not participating" option
- **Meeting approval** -- pick date sorted by votes, pick game filtered by date voters, late join, edit/unapprove
- **Board games CRUD** -- list with search, detail/edit/delete, image upload
- **Profile** -- avatar upload, name edit, password change, notification preferences
- **Push notifications** -- survey reminders, meeting reminders (via Supabase Edge Functions + Expo Push API)
- **Realtime** -- live updates when meetings or votes change

## Project Structure

```
app/                    # Expo Router screens
  (auth)/login.tsx      # Login screen (no self-registration)
  (tabs)/
    index.tsx           # Home -- meeting card or survey CTA
    games/              # Board games list, detail, new
    profile.tsx         # Profile & notification settings
  survey/[id].tsx       # Survey voting screen
  approve/[id].tsx      # Meeting approval screen
lib/                    # Shared utilities, types, Supabase client
supabase/
  migrations/           # SQL schema, RLS, functions
  functions/            # Edge Functions (cron jobs, notifications)
```

## Setup

### Prerequisites

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Supabase project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

There are two gitignored env files — one per Supabase project — copied from the
single [.env.example](.env.example) template:

```bash
cp .env.example .env.dev    # DEV project
cp .env.example .env.prod   # PROD project (rename the DEV_ prefix to PROD_)
```

Each file holds two kinds of vars:
- `DEV_SECRET_KEY`/`PROD_SECRET_KEY` — the **secret** key (`sb_secret_…`) for the
  setup script (step 3); backend-only, never an `EXPO_PUBLIC_*` var.
- `EXPO_PUBLIC_SUPABASE_URL`/`KEY` — the app runtime vars; use the **publishable**
  key (`sb_publishable_…`, safe for the client). `app.config.ts` loads `.env.dev`
  for local dev runs and `.env.prod` when `APP_ENV=production`. The setup script
  derives the project ref/url from `EXPO_PUBLIC_SUPABASE_URL`. New Supabase
  projects only issue the new key format (legacy `anon`/`service_role` are gone).

### 3. Set up Supabase (link, migrations, edge functions)

Backend deploys are scripted per environment. Authenticate the CLI once
(`npx supabase login`), then run against the env file from step 2:

```bash
npm run supabase:setup:dev       # link + migrations + edge functions, prints Vault SQL
```

Switch environments with the suffix: `npm run supabase:setup:prod` targets PROD.
Granular steps exist for both: `db:push:{dev,prod}`,
`functions:deploy:{dev,prod}`, `supabase:secrets:{dev,prod}`,
`supabase:link:{dev,prod}`. (The script auto-links the right project and reads
`verify_jwt` from `supabase/config.toml`.)

pg_cron needs two Vault secrets to invoke the scheduled functions. `setup:*`
ends by printing them with your values already filled in (or reprint anytime with
`npm run supabase:secrets:dev` / `:prod`); paste the output **once** into the
project's SQL editor (Dashboard → SQL editor). It looks like:

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<sb_secret_…>', 'service_role_key');
```

Creating the DEV project and the one-time guided dashboard steps are documented
in [docs/supabase-dev-setup.md](docs/supabase-dev-setup.md).

### 4. Supabase Auth configuration

In Supabase Dashboard > Authentication > Settings:

- Disable email sign-ups (users created manually by admin)
- Disable anonymous sign-in
- Disable social/OAuth providers

### 5. Configure Firebase (Android push notifications)

Push notifications on Android require Firebase Cloud Messaging (FCM).

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Add an Android app with package name `com.jacaczap.boardgames`
3. Download `google-services.json` and place it in the project root (referenced by `app.config.ts` via `googleServicesFile`). One project-level file covers both the prod and dev app ids; for the dev app id (`com.jacaczap.boardgames.dev`) see [docs/firebase-dev-setup.md](docs/firebase-dev-setup.md)
4. In Firebase Console → Project Settings → Service Accounts → click "Generate new private key" and download the JSON
5. Upload the service account key to Expo:
  ```bash
   eas credentials
   # Select: Android → production → Google Service Account
   # Select: Manage your Google Service Account Key for Push Notifications (FCM V1)
   # Select: Set up a Google Service Account Key for Push Notifications (FCM V1)
   # Point to the downloaded firebase-adminsdk JSON file
  ```
6. Rebuild the app (`npm run build:prod`) — this is a native change, OTA updates won't work

> **Note:** `google-services.json` is safe to commit (bundled with the app). The Firebase admin SDK key (`*-firebase-adminsdk-*.json`) is gitignored and must not be committed.

### 6. Configure EAS Build environment

`eas.json` defines three build profiles. Each sets `APP_ENV` (drives `app.config.ts`: name / app id / google-services / which DB the local env file targets) and an EAS `environment` (`development` / `preview` / `production`) that supplies the Supabase vars at build time:

| Profile       | `APP_ENV`     | App id                          | EAS environment | Supabase DB | Distribution / Play track |
| ------------- | ------------- | ------------------------------- | --------------- | ----------- | ------------------------- |
| `development` | `development` | `com.jacaczap.boardgames.dev`   | `development`   | DEV         | dev client (local/emulator) |
| `staging`     | `staging`     | `com.jacaczap.boardgames`       | `preview`       | DEV         | AAB → internal testing    |
| `production`  | `production`  | `com.jacaczap.boardgames`       | `production`    | PROD        | AAB → closed testing / production |

Set the Supabase vars per environment — DEV for `development` + `preview` (staging), PROD for `production`:

```bash
# DEV Supabase → development + staging builds
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-dev-project.supabase.co" --visibility sensitive --environment development --environment preview
eas env:create --name EXPO_PUBLIC_SUPABASE_KEY --value "sb_publishable_your-dev-publishable-key" --visibility sensitive --environment development --environment preview

# PROD Supabase → production builds
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-prod-project.supabase.co" --visibility sensitive --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_KEY --value "sb_publishable_your-prod-publishable-key" --visibility sensitive --environment production
```

Verify with `eas env:list`.

### 7. Build & submit

Build locally (faster; requires JDK 17 + Android SDK) — profile picks env, app id, and DB (see table above):

```bash
npm run build:staging     # or build:dev / build:prod
```

Each script runs, e.g.:

```bash
ANDROID_HOME="$HOME/Library/Android/sdk" eas build --platform android --profile production --local
```

Upload to Google Play — two options:

- **Manual (default):** take the `.aab` from the build and upload it in the Play Console yourself. No extra setup.
- **Automated (optional):** `eas submit` uploads to the right track for you (reads the matching submit profile in `eas.json`). One-time setup: create a Play service account (Play Console → Setup → API access → create/link a service account with the "Release manager" role), download its key to `./google-play-service-account.json` (gitignored). Then:

```bash
npm run submit:staging    # → internal testing track (DEV-backed build)
npm run submit:prod       # → closed testing (alpha) track (PROD-backed build)
```

Track layout: **internal testing** serves the `staging` (DEV-backed) build for you, **closed testing** serves the `production` (PROD-backed) build for the current testers. Promotion flow internal → closed → production is done in the Play Console by promoting an existing release (no rebuild needed). Full guided steps (creating closed testing, migrating current testers) in [docs/play-tracks-setup.md](docs/play-tracks-setup.md).

### 8. Run the app

```bash
npx expo start
```

Press `a` for Android, `i` for iOS, or `w` for web.

Local runs (including web) default to `APP_ENV=development`, so `app.config.ts`
loads `.env.dev` and the app talks to the **DEV** Supabase project. There is no
local build that targets PROD by design — PROD web is served only by Vercel.

## Web Deployment (Vercel)

Web is **prod-only**: [Vercel](https://vercel.com) hosts the production web app
and **auto-deploys on every push to `master`**. There are no DEV/preview Vercel
environments — for web dev work, run it locally (`npx expo start`, press `w`),
which is backed by the DEV database (see step 8).

- **Build command**: `npx expo export -p web`
- **Output directory**: `dist`
- **Environment variables** (Vercel project Settings > Environment Variables):
  - `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` — the **PROD** project's URL + publishable key.
  - `APP_ENV=production` — so the build uses the prod variant (app name `Planszówki` instead of `Planszówki (Dev)`). Without it the build defaults to `development`; the DB is unaffected either way (it always comes from the two vars above), but the name would show the dev label.

## Database

All tables use Row Level Security. Key tables: `profiles`, `board_games`, `meetings`, `date_options`, `votes`, `vote_dates`, `vote_games`, `push_tokens`, `push_token_events`, `survey_reminder_log`.

SQL functions: `create_next_survey()`, `get_consecutive_game_count()`, Polish holidays computation.

## Edge Functions

Scheduled (pg_cron):

| Function           | Schedule | Purpose                                                   |
| ------------------ | -------- | --------------------------------------------------------- |
| `create-survey`    | Daily    | Auto-create survey 7+ days after last completed meeting   |
| `survey-reminder`  | Daily    | Remind users who haven't voted (per-user interval)        |
| `meeting-reminder` | Daily    | Notify attendees N days before meeting (per-user setting) |
| `complete-meeting` | Daily    | Mark past approved meetings as completed                  |

Trigger-based (fired by DB triggers on `meetings`, push to all users):

| Function                   | Trigger                          | Purpose                          |
| -------------------------- | -------------------------------- | -------------------------------- |
| `notify-survey-created`    | New meeting in `voting` status   | "A new survey is available"      |
| `notify-meeting-approved`  | Meeting transitions to `approved`| "Meeting approved for {date}"    |
| `notify-meeting-unapproved`| Meeting reverts to `voting`      | "Meeting unapproved"             |

Push notifications sent via the Expo Push API (`functions/_shared/push.ts`) using tokens from `push_tokens`, read by Edge Functions via the `service_role` key.


## Security

- `.env`, `supabase/config.toml` are gitignored
- `service_role` key is only used server-side in Edge Functions
- Anon key is safe for client use -- all access gated by RLS
- No secrets in source code

## License

Private project.