# BoardGames Meeting Planner

A React Native (Expo) app for a friend group to coordinate board game meetings -- vote on dates and games, approve meetings, and get push notifications.

## Tech Stack

- **Expo** (managed workflow) + **expo-router** (file-based navigation)
- **Supabase** -- Auth, Postgres, Storage, Edge Functions, Realtime
- **gluestack-ui v2** -- UI components
- **TypeScript** throughout
- **Platforms**: Android, iOS, Web

## Features

- **Survey voting** -- Doodle-style date picker (weekends + Polish holidays + custom dates), game multi-select with 3-play streak logic, "not participating" option
- **Meeting approval** -- pick date sorted by votes, pick game filtered by date voters, late join, edit/unapprove
- **Board games CRUD** -- list with search, detail/edit/delete, image upload
- **Profile** -- avatar upload, name/username edit, password change, notification preferences
- **Push notifications** -- survey reminders, meeting reminders, new user alerts (via Supabase Edge Functions + Expo Push API)
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
supabase functions deploy
```

### 4. Supabase Auth configuration

In Supabase Dashboard > Authentication > Settings:

- Disable email sign-ups (users created manually by admin)
- Disable anonymous sign-in
- Disable social/OAuth providers

### 5. Run the app

```bash
npx expo start
```

Press `a` for Android, `i` for iOS, or `w` for web.

## Database

All tables use Row Level Security. Key tables: `profiles`, `board_games`, `meetings`, `date_options`, `votes`, `vote_dates`, `vote_games`, `push_tokens`, `survey_reminder_log`.

SQL functions: `create_next_survey()`, `get_consecutive_game_count()`, Polish holidays computation.

## Edge Functions (pg_cron)

| Function | Schedule | Purpose |
|---|---|---|
| `create-survey` | Daily | Auto-create survey 7+ days after last completed meeting |
| `survey-reminder` | Daily | Remind users who haven't voted (per-user interval) |
| `meeting-reminder` | Daily | Notify attendees N days before meeting (per-user setting) |
| `complete-meeting` | Daily | Mark past approved meetings as completed |
| `new-user-notification` | DB trigger | Notify everyone when a new member joins |

## Security

- `.env`, `supabase/config.toml` are gitignored
- `service_role` key is only used server-side in Edge Functions
- Anon key is safe for client use -- all access gated by RLS
- No secrets in source code

## License

Private project.
