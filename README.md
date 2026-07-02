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

- **Survey voting** -- Doodle-style date picker (weekends + Polish holidays + custom dates), game multi-select with 3-play streak logic, "not participating" option
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

Create a `.env` file in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-anon-key
```

### 3. Set up Supabase (for local Supabase deployment)

Copy the config template and fill in your project ID:

```bash
cp supabase/config.toml.example supabase/config.toml
```

Link to your Supabase project and run migrations:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

Set Edge Function secrets:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set EXPO_ACCESS_TOKEN=your-expo-access-token
```

Deploy Edge Functions:

```bash
supabase functions deploy --no-verify-jwt
```

### 4. Supabase Auth configuration

In Supabase Dashboard > Authentication > Settings:

- Disable email sign-ups (users created manually by admin)
- Disable anonymous sign-in
- Disable social/OAuth providers

### 5. Configure Firebase (Android push notifications)

Push notifications on Android require Firebase Cloud Messaging (FCM).

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Add an Android app with package name `com.jacaczap.boardgames`
3. Download `google-services.json` and place it in the project root (already referenced in `app.json` via `googleServicesFile`)
4. In Firebase Console → Project Settings → Service Accounts → click "Generate new private key" and download the JSON
5. Upload the service account key to Expo:
  ```bash
   eas credentials
   # Select: Android → production → Google Service Account
   # Select: Manage your Google Service Account Key for Push Notifications (FCM V1)
   # Select: Set up a Google Service Account Key for Push Notifications (FCM V1)
   # Point to the downloaded firebase-adminsdk JSON file
  ```
6. Rebuild the app (`eas build`) — this is a native change, OTA updates won't work

> **Note:** `google-services.json` is safe to commit (bundled with the app). The Firebase admin SDK key (`*-firebase-adminsdk-*.json`) is gitignored and must not be committed.

### 6. Configure EAS Build environment

For EAS builds (preview/production), set the Supabase env vars so they are available at build time:

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co" --visibility sensitive --environment preview --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_KEY --value "your-anon-key" --visibility sensitive --environment preview --environment production
```

Verify with `eas env:list`.

### 7. Build

Cloud build (default):

```bash
eas build --platform android --profile production
```

Local build (faster, requires JDK 17 + Android SDK):

```bash
eas build --platform android --profile production --local
```

or 

```bash
ANDROID_HOME="$HOME/Library/Android/sdk" eas build --platform android --profile production --local
```

Submit to Google Play:

```bash
eas submit --platform android
```

### 8. Run the app

```bash
npx expo start
```

Press `a` for Android, `i` for iOS, or `w` for web.

## Web Deployment (Vercel)

The web version is hosted on [Vercel](https://vercel.com) and auto-deploys on every push to the production branch. Pull request branches get preview deployments.

- **Build command**: `npx expo export -p web`
- **Output directory**: `dist`
- **Environment variables**: Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` in Vercel project Settings > Environment Variables.

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