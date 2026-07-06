# Groups & self-signup setup (Phase 1 finalization)

One-time, manual steps to run **once, at the very end of Phase 1**, after all
Phase-1 code is merged and before any release. Code + migrations are already in
the repo; this only covers what can't be done in code.

Run it against **DEV first** (verify), then repeat the same steps on **PROD**.

> Keep this guide complete: any Phase-1 change that adds a manual step must add it
> here in the same change.

## Release ordering (breaking change — read first)

Phase 1 is a **breaking** backend change: the RLS rewrite requires group
membership and `group_id` is now `NOT NULL`, so a pre-1.1.0 install can no longer
create games or approve meetings against the migrated schema. The app `version`
is bumped to **1.1.0** and a migration raises `app_config.min_version` to
**1.1.0**, so older native installs get the "Update required" screen instead of
failing silently.

Because closed-testing users run the **old** build against **PROD**, order the
PROD run so an updatable build exists before the migration locks them out:

1. **DEV first:** run every step below on DEV (a fresh project — the data
   migration and version gate are no-ops there) to rehearse.
2. **Build + ship 1.1.0:** `npm run build:prod`, publish to the **internal**
   track and smoke-test (see [play-tracks-setup.md](play-tracks-setup.md) §1).
3. **PROD backend (§1 below):** this push applies the schema migration **and**
   the `min_version` → 1.1.0 raise together — old installs now show "Update
   required".
4. **Promote internal → closed:** testers update to 1.1.0 and are back in.
5. Finish the remaining PROD steps below (SMTP, privacy URL, store listing,
   content rating).

Merging to `master` also auto-deploys the web app (Vercel); web is always current
and exempt from the gate, so nothing extra is needed there.

## 1. Deploy the backend

Pushes the Phase-1 migrations (groups schema, `group_id` columns, membership
RLS, abuse-limit triggers, onboarding/join RPCs, data migration, `min_version` →
1.1.0 bump) and the new `delete-account` edge function.

```bash
npm run supabase:setup:dev    # then, once verified:
npm run supabase:setup:prod
```

Granular re-runs if needed: `db:push:dev` / `functions:deploy:dev` (and `:prod`).

The data-migration runs automatically here on **PROD** (a legacy DB with users
but no groups): it creates one **premium, 20-member** default group named
`Planszówki`, makes the **earliest-registered account** its admin, and adds all
existing users as members. On a fresh **DEV** project it is a no-op. Afterwards,
confirm the picked admin, tier and member limit are correct (adjust via group
management or the dashboard if not).

## 2. Auth — enable open self-signup + verification

Dashboard → **Authentication**, on **both** projects:

- **Providers → Email**: enable **Allow new users to sign up** and turn **Confirm
  email** ON. (Phase 0 had signups closed.)
- **URL Configuration → Redirect URLs** — add the deep links the app uses for
  email confirmation, password reset and invite links:
  - `boardgames://login`
  - `boardgames://reset-password`
  - `boardgames://join/*`
  - web origins: the Vercel prod URL (PROD) / `http://localhost:8081` (DEV).
- **URL Configuration → Site URL**: set to the web app URL.

## 3. Email templates + SMTP (required for PROD)

- Supabase's built-in mailer is heavily rate-limited — unsuitable for real
  verification/reset volume. On **PROD**, configure **custom SMTP** (Resend or
  SendGrid) under **Authentication → Emails → SMTP**. DEV can stay on the
  built-in mailer for testing.
- Confirm the **Confirm signup** and **Reset password** templates point at the
  redirect (default `{{ .ConfirmationURL }}` works with the redirect URLs above).

## 4. Verify

- Register a new account → receive the confirmation email → confirm → land in
  **onboarding** (no groups yet).
- Create a group; log in on a second account and **join via an invite link**
  (`boardgames://join/<code>`) — register-or-login then join.
- **Forgot password** → open the reset link → set a new password → log in.
- **Profile → Delete account** removes the account and its data (avatar,
  memberships, votes); confirm the user can no longer log in.
- **Report + block:** report a game/member (Report action), confirm a group admin
  gets the push and sees it under **Group settings → Reports**; block a member and
  confirm their name/avatar is masked; unblock from **Profile → Blocked users**.

## 5. Privacy policy (rewritten for self-signup) — host it

The policy was rewritten for open self-signup, groups, and user content
([PRIVACY_POLICY.md](../PRIVACY_POLICY.md) + [docs/privacy/index.html](privacy/index.html)).
Host the HTML at the public URL and point Play at it — see
[docs/play-tracks-setup.md](play-tracks-setup.md) → "Privacy policy hosting".
Confirmed URL: `https://jacaczap.github.io/boardgames/privacy/`. Keep the `.md`
and `.html` in sync.

## 6. Rebrand — store listing, screenshots, icon

The app was renamed **Planszówki → VoteNMeet** (name in
[app.config.ts](../app.config.ts); new icon/splash in `assets/`; wood palette
kept). Manual store steps:

- **Store listing (en + pl):** paste the name + short/long descriptions from
  [docs/store-listing.md](store-listing.md) into Play Console → **Main store
  listing** per language.
- **Screenshots:** the old ones are board-games-branded — **redo all** (phone +
  tablet, en + pl) with the new name/branding and current screens.
- **App name** in Play Console: update to **VoteNMeet**.
- **Android monochrome icon** (`assets/android-icon-monochrome.png`) is still the
  old mark. If you want an on-brand Android 13+ themed icon, export a single-color
  (alpha) version of the new icon and replace it. Optional, non-blocking.

## 7. Play Content rating — re-submit

In-app **report content** and **block user** now exist. In Play Console →
**App content → Content rating**, re-open the questionnaire and flip the
**report users** and **block users** answers to **Yes**, then re-submit to get the
updated IARC rating.
