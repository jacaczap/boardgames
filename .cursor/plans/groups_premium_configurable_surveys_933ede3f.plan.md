---
name: Groups premium configurable surveys
overview: Transform the single-group board-games app into a generic, multi-tenant meeting planner with self-signup, group-based isolation, configurable surveys, and a premium tier. Starts with a dev/prod environment split, then three feature phases.
todos:
  - id: p0-supabase-dev
    content: "Phase 0: create separate DEV Supabase project; link via CLI; apply migrations + deploy edge functions/cron/secrets to it (guided console steps + IaC scripts)"
    status: completed
  - id: p0-platform-changes
    content: "Phase 0: adopt new publishable/secret API keys; add grants-backfill migration (tables not auto-exposed to Data API); switch invoke_edge_function to apikey header + verify_jwt=false on cron functions"
    status: completed
  - id: p0-env-config
    content: "Phase 0: convert app.json -> app.config.ts (env-driven name/id/google-services); add EXPO_PUBLIC env per EAS build profile + local .env -> dev"
    status: completed
  - id: p0-eas-profiles
    content: "Phase 0: define EAS profiles (development=local .dev id, staging=internal track/dev DB, production=closed+prod track/prod DB) + eas submit config"
    status: completed
  - id: p0-firebase-dev
    content: "Phase 0: add Firebase Android app for com.jacaczap.boardgames.dev; separate google-services for dev push (guided console steps)"
    status: completed
  - id: p0-play-tracks
    content: "Phase 0: guided Google Play steps - point internal track at dev build, create closed testing track, migrate current internal testers to closed (prod)"
    status: completed
  - id: p0-version-gate
    content: "Phase 0: minimum-version gate on startup - remote min_version in Supabase (public read), compare running app version on launch, hard-block outdated native builds with an update screen + store link; web (always-current) exempt"
    status: pending
  - id: p1-schema
    content: "Phase 1: migration for groups, group_members (role enum), group_invites (per-group, 3-day expiry, multi-use) + is_group_member/is_group_admin/can_approve helpers"
    status: pending
  - id: p1-tenant
    content: "Phase 1: add group_id to meetings & board_games, per-group meeting number, update create_next_survey(p_group_id)"
    status: pending
  - id: p1-rls
    content: "Phase 1: rewrite all domain RLS to membership-scoped; add anti-flooding triggers (3 free groups/user, member_limit, per-group row caps, rate limits)"
    status: pending
  - id: p1-auth
    content: "Phase 1: open registration/email-verification/password-reset screens; onboarding when user has no groups; invite-link deep-link join flow (register-or-login then join)"
    status: pending
  - id: p1-context
    content: "Phase 1: lib/groups context provider (currentGroupId persisted), scope all meetings/board_games queries by it"
    status: pending
  - id: p1-ui
    content: "Phase 1: shared header with group switcher (headerRight) + group management screens (create/settings/members/invite-code/join)"
    status: pending
  - id: p1-edge
    content: "Phase 1: rework cron + edge functions (create-survey, complete-meeting, reminders, notify-*) to operate per group"
    status: pending
  - id: p1-migrate
    content: "Phase 1: one-off migration folding existing games/meetings/profiles into a default premium group (20-member limit) with current user as admin"
    status: pending
  - id: p1-launch-readiness
    content: "Phase 1 (when self-signup ships): rewrite stale PRIVACY_POLICY.md for public/self-signup + host it at a public URL; add in-app account+data deletion (GDPR self-service); English-completeness pass on all i18n keys (en/pl) incl. new screens; decide public/English app name + localized store listing; public support/contact channel"
    status: pending
  - id: p2-schema
    content: "Phase 2: survey_dimensions + survey_options + vote_selections tables; make date auto-generation and 3-play rule per-group config"
    status: pending
  - id: p2-config-ui
    content: "Phase 2: admin dimension-config screens + 3 presets (boardgames, activity, meetplace)"
    status: pending
  - id: p2-survey-ui
    content: "Phase 2: rewrite SurveyContent + approve screens to render N configurable dimensions dynamically"
    status: pending
  - id: p2-migrate
    content: "Phase 2: migrate board_games -> survey_options (game dimension), vote_games -> vote_selections"
    status: pending
  - id: p3-decisions
    content: "Phase 3 Step 0: decide payment platform (Stripe/RevenueCat/both), tier limits and pricing, free-tier feature gating"
    status: pending
  - id: p3-tiers
    content: "Phase 3: tier model + feature gating + tier-based member limits"
    status: pending
  - id: p3-payments
    content: "Phase 3: integrate chosen payment provider(s), subscriptions table + webhooks, billing UI"
    status: pending
  - id: p3-legal
    content: "Phase 3: ToS/Privacy/VAT/GDPR/refund checklist + Supabase-vs-alternatives evaluation"
    status: pending
isProject: false
---

# Dev Environment, Groups, Configurable Surveys & Premium — Phased Plan

The app today is **single-tenant** and **single-environment**: all builds (emulator, web, Play internal testers) hit the **prod** Supabase; no `group_id` anywhere; flat RLS; survey hardcoded to **dates + board games**; admin-created users only. This plan first splits dev/prod, then adds multi-tenancy, generic surveys, and monetization. Each phase ships independently.

## Decisions already made
- **Environments:** separate DEV + PROD Supabase projects (both fit free tier's 2-project limit). Internal Play track -> DEV; Closed testing -> PROD (current users migrate here); Production later -> PROD. Local builds use a separate app id `com.jacaczap.boardgames.dev`. DEV gets full backend parity (edge functions, cron, push).
- **Auth:** email + password only — open self-signup so anyone who installs the app can register, plus email verification and password reset.
- **Invites:** one shareable link **per group** (not per user), 3-day expiry, multi-use. An admin shares it with a group of friends; each opens it, registers (if new) or logs in, then joins the group.
- **Infra:** stay on Supabase **free** for now, but write code/limits assuming **Pro**. Evaluate alternatives in Phase 3.
- **Existing data:** migrate into one "default" group set to **premium tier, 20-member limit**, current user as admin, all existing profiles as members.

## Open discussion points (decide before the relevant phase)
- **Custom SMTP** (Phase 1): Supabase's built-in mailer is heavily rate-limited and unsuitable for production verification/reset emails. Options: configure a custom SMTP provider (Resend/SendGrid) vs. rely on built-in for now. Decide before launch.

## Supabase platform changes to account for (mid-2026)
Creating fresh DEV/PROD projects in Phase 0 triggers Supabase's newer defaults, so handle these up front:
- **Tables not auto-exposed to the Data API** (the RLS-related emails; default for new projects from 2026-05-30, all projects 2026-10-30). RLS is unchanged, but a separate `GRANT` layer now decides whether a table is visible to `supabase-js` at all. Our [initial_schema.sql](supabase/migrations/20260322000000_initial_schema.sql) has RLS but **no table grants** — recreating it on a fresh project would make those tables invisible to the app. Fix: add a **grants-backfill migration** for all existing tables, and keep following [.cursor/rules/supabase-migrations.mdc](.cursor/rules/supabase-migrations.mdc) (already mandates grants) for every new table.
- **New API keys** (`sb_publishable_…` for client, `sb_secret_…` for backend) replace `anon`/`service_role`; new projects may not include legacy keys. Adopt them from the start. They are **not JWTs**, so they must be sent on the `apikey` header. Update `invoke_edge_function` ([notifications_cron.sql](supabase/migrations/20260322300000_notifications_cron.sql)) from `Authorization: Bearer` to the `apikey` header and set `verify_jwt = false` on the cron-invoked Edge Functions.
- **Asymmetric JWT signing keys** (default on new projects): independent migration, mostly fine since Edge Functions use the secret key to bypass RLS — just verify token-verification settings on cron-invoked functions.

---

## Phase 0 — Dev / Prod environment split (do first)

Goal: stop testing against prod. A DEV Supabase + DEV app build for local/emulator and Google Play internal testers; PROD stays for real users on the closed testing track.

Current state: one Supabase project; env via `EXPO_PUBLIC_SUPABASE_URL/KEY` in gitignored `.env` ([lib/supabase.ts](lib/supabase.ts)); static [app.json](app.json) (one name, one id `com.jacaczap.boardgames`, one [google-services.json](google-services.json)); [eas.json](eas.json) profiles inject no env; `supabase` CLI already a dev dep; migrations in [supabase/migrations](supabase/migrations).

### A. DEV Supabase project (guided + IaC)
- **Guide you** to create a second Supabase project (e.g. `boardgames-dev`) in the dashboard and copy its URL + new **publishable** + **secret** keys (see platform-changes section).
- **Add a grants-backfill migration** so the schema works on fresh projects under the new "tables not auto-exposed" default; fix `invoke_edge_function` to use the `apikey` header. Apply these to PROD too (PROD hits the same default on 2026-10-30).
- **IaC:** `supabase link` to dev ref, then push all [supabase/migrations](supabase/migrations), deploy all [supabase/functions](supabase/functions) (with `verify_jwt = false` where cron-invoked), set Vault/function secrets (secret key), and recreate pg_cron jobs against dev. Add npm scripts (e.g. `db:push:dev`, `functions:deploy:dev`) so it's repeatable.
- Optionally seed minimal dev data.

### B. Env-driven app config (IaC)
- Convert static [app.json](app.json) -> **`app.config.ts`** so name / `package` / `bundleIdentifier` / `googleServicesFile` are chosen by an `APP_ENV` var:
  - dev -> name "Planszówki (Dev)", id `com.jacaczap.boardgames.dev`, dev `google-services`.
  - staging/prod -> current name + id `com.jacaczap.boardgames`, prod `google-services`.
- Define `EXPO_PUBLIC_SUPABASE_URL` + the new **publishable** key per **EAS build profile** (EAS environment variables) and a local `.env` pointing at DEV. Update `.env.example` + add a `.env.production.example`. ([lib/supabase.ts](lib/supabase.ts) keeps the same shape — just a publishable key value instead of anon.)

### C. EAS build + submit profiles (IaC)
- Rework [eas.json](eas.json):
  - `development` -> `.dev` id, dev Supabase, dev client (local emulator/phone).
  - `staging` -> prod id, dev Supabase, AAB for Play **internal** track.
  - `production` -> prod id, prod Supabase, AAB for **closed testing** / production tracks.
- Add `eas submit` targets per track (service-account key for automated upload — IaC-ish).

### D. DEV Firebase / push (guided)
- **Guide you** to add an Android app for `com.jacaczap.boardgames.dev` in the existing Firebase project, download its `google-services.json`, and wire it as the dev variant (keep prod file for prod). Needed for push to work on the dev app.

### E. Google Play tracks (guided, mostly console)
- **Guide you** through: upload a `staging` build to the **internal testing** track (points to DEV); create a **closed testing** track; move current internal testers there; upload a `production`-profile build (points to PROD). Document promotion flow internal -> closed -> production.

### F. Minimum supported version gate (force-update)

Why here: later phases ship breaking backend/RLS/schema changes, so old installs must be locked out rather than silently failing. The gate ships in Phase 0 so it already exists in the field by the time those changes land.

- **Remote-controlled minimum:** store a `min_version` (per platform) in Supabase — a small `app_config` table (public read via grant/RLS) or a tiny RPC. Bumping it blocks old clients **without** needing a new release.
- **Startup check:** in [app/_layout.tsx](app/_layout.tsx) `init()` (before clearing `loading`), read the running app version (`expo-application` native version / `expo-constants` `expoConfig.version`, currently `1.0.0` in [app.json](app.json)) and compare to `min_version`.
- **Hard block:** if too old, render a full-screen "Update required" screen (with a store deep-link button) instead of the app — non-dismissible. Fail open if the check itself errors (no network), so a backend hiccup can't lock everyone out.
- **Web exempt:** web is always current (Vercel), so guard the gate with `Platform.OS !== "web"`.
- Add the `min_version` config via migration (covered by the grants-backfill pattern in section A).

Deliverable style: for each manual step, the plan/PR includes copy-paste CLI commands or click-by-click console instructions so nothing is missed.

---

## Phase 1 — Groups + Auth foundation (largest feature phase)

Goal: every domain row belongs to a group; users join groups; UI switches between them; self-signup replaces admin-created users.

### Data model (new migration)
- `groups`: `id`, `name`, `created_by`, `tier` (default `free`), `member_limit` (default 5), `created_at`.
- `group_members`: `(group_id, user_id)` PK, `role` enum `group_role` = `admin | approver | member`, `joined_at`. Creator = admin; admin implies approver rights.
- `group_invites`: `id`, `group_id`, `code` (random), `expires_at` (default now + 3 days), `created_by`, `created_at`. **Per-group, multi-use** — one link serves many friends; new members join as `member`. Joining checks expiry + the group's member limit.
- Add `group_id` to [board_games](supabase/migrations) and [meetings](supabase/migrations) (top-level entities). `date_options` / `votes` / `vote_dates` / `vote_games` derive their group via `meeting_id`, so no column needed there.
- `meetings.number` becomes **per-group**: change unique index to `(group_id, number)`; update [create_next_survey()](supabase/migrations/20260424000000_create_next_survey_start_tomorrow.sql) to take `p_group_id`.

### RLS + abuse limits
- Add SQL helpers `is_group_member(gid)`, `is_group_admin(gid)`, `can_approve(gid)`.
- Rewrite all domain policies from `auth.uid() is not null` to membership-scoped. `profiles_select` narrows to "profiles of users sharing a group with me".
- **Limit triggers:** max 3 free groups per user (on `group_members` insert), enforce `member_limit` per group, per-group caps on games/date_options, per-user insert rate limit. This is the anti-flooding layer.
- Follow grant/RLS pattern in [.cursor/rules/supabase-migrations.mdc](.cursor/rules/supabase-migrations.mdc) (note: original tables lack `GRANT`s — fix for new tables).

### Auth & onboarding
- New screens under `app/(auth)/`: **registration** (open self-signup for anyone installing the app), email-verification notice, forgot/reset password.
- Update guard in [app/_layout.tsx](app/_layout.tsx): logged-in user with **zero memberships** → onboarding (create a group or join via invite link). Fresh installs with no invite land here after registering.
- **Invite-link flow:** opening a link (deep link / scheme) routes to a join screen; if not authenticated, prompt register-or-login first, then join the group the link points to.
- New `lib/groups` context provider: holds `currentGroupId` (persisted in AsyncStorage), exposes switcher data. Every `meetings` / `board_games` query filters by it.

### UI
- Shared header component (none exists today; headers are inline `options`). Add a **group switcher** top-right: group name + chevron dropdown of memberships + "+" to create. Wire into [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) `headerRight`.
- Group management screens: create group, settings (rename/delete), member list (promote/demote/remove), generate invite code, join-by-code.

### Edge functions / cron
- [create-survey](supabase/functions), [complete-meeting](supabase/functions), [survey-reminder](supabase/functions), [meeting-reminder](supabase/functions) and the `notify-*` triggers must operate **per group** (loop over groups). `survey_reminder_log` becomes per-user-per-group.

### Data migration
- One-off migration: create the default group as **premium tier with a 20-member limit**, attach all existing `board_games`/`meetings`, add all `profiles` as members, set current user admin.

### Public launch readiness (do alongside self-signup)
The moment self-signup ships, the app is effectively public — these can't wait for Phase 3's payments legal step:
- **Privacy Policy:** current [PRIVACY_POLICY.md](PRIVACY_POLICY.md) is stale (says "invite-only, admin-created accounts"). Rewrite for open self-signup, group model, and third-party services; host it at a **public URL** (Play requires a reachable link — a repo `.md` isn't enough). Payment/VAT/refund clauses come later with Phase 3.
- **Account & data deletion:** in-app "delete my account + data" flow (GDPR self-service) — public users can't rely on emailing an admin. (Phase 3 `p3-legal` covers the payments angle; this is the baseline flow.)
- **English completeness:** i18n scaffolding exists (`lib/i18n/en.ts` + `pl.ts`) but many strings default to Polish. Do a pass ensuring **every** key (incl. all new Phase 1/2/3 screens) has proper `en` + `pl` values before public release.
- **App name / branding:** "Planszówki" is Polish-only. Decide a public/English-friendly name and prepare a **localized store listing** (description + screenshots).
- **Support/contact channel:** a way for non-friend users to reach support (email/form).

---

## Phase 2 — Configurable / generic surveys

Goal: survey stops being "dates + games". Default = **dates only**. Premium groups add extra configurable dimensions.

### Data model
- `survey_dimensions` (per group): `key`, `name`, `type` (`date | option`), `is_optional`, `select_mode` (single/multi), `who_can_add_options`, `allow_photos`, `extra_fields` (jsonb schema), `order`.
- Generalize: `survey_options` (replaces `board_games` as generic per-dimension options: `label`, `description`, `image_url`, `extra` jsonb, `added_by`) and `vote_selections` (`vote_id`, `dimension_id`, `option_id`) replacing `vote_games`.
- Dates stay first-class (`date_options`) but auto-generation (weekends, Polish holidays, 60-day range, in [create_next_survey](supabase/migrations/20260424000000_create_next_survey_start_tomorrow.sql) + [lib/holidays.ts](lib/holidays.ts)) becomes **per-group config**. The 3-play rule (`get_consecutive_game_count`) becomes an optional per-dimension rule.

### UI
- Admin dimension-config screens.
- [components/SurveyContent.tsx](components/SurveyContent.tsx) and [app/approve/[id].tsx](app/approve/[id].tsx) rewritten to render **N dimensions dynamically** instead of two hardcoded sections.

### Presets (3 examples)
- **Boardgames** (today's behavior), **Activity** (simple choice: sports/gokart/paintball), **Meetplace** (place choice, optional map/location field).

### Migration
- `board_games` → `survey_options` under a "game" dimension; `vote_games` → `vote_selections`.

---

## Phase 3 — Premium + payments

### Step 0 — decisions (do these first)
- **Payment platform:** Stripe (web) vs RevenueCat (mobile IAP) vs both. Mobile in-app digital upgrades **must** use Play/App Store billing (15–30%, or US alt-billing 10/25%); web can use Stripe (~3%).
- **Tiers & pricing:** member limits (free 5; premium 10/20/per-user) and price points.
- **What free loses:** extra dimensions, photos, etc.

### Build
- `subscriptions` table + provider webhooks (Edge Functions) writing one canonical subscription/tier state per group.
- Tier-based feature gating + `member_limit` enforcement (extends Phase 1 triggers).
- Upgrade/billing UI + group admin billing screen.

### Legal & infra (flagged: you have no payments experience)
- Extend the Phase-1 Privacy Policy with payment clauses; add ToS, EU/Polish VAT (Stripe Tax or store-handled), GDPR data export (deletion baseline already shipped in Phase 1), refund policy, payout entity setup.
- **Supabase vs alternatives evaluation** (you asked to explore): assess staying on Supabase Pro vs alternatives, given vendor lock-in (RLS, Edge Functions, Realtime, Auth all Supabase-native). Likely recommendation: stay, go Pro at launch.

---

## Sequencing & risks
- **Phase 0 first** — without a dev environment, every later phase is risky to test against prod. It's mostly config/guided console work, so it's quick and unblocks everything.
- Phase 1 is the feature foundation; Phases 2 & 3 depend on it. Phase 3 is riskiest (store policies, legal) — last.
- Biggest effort: RLS rewrite (P1), per-group cron (P1), survey remodel + data migration (P2).
- Each phase ships independently and leaves the app working.