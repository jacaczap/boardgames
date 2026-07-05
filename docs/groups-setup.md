# Groups & self-signup setup (Phase 1 finalization)

One-time, manual steps to run **once, at the very end of Phase 1**, after all
Phase-1 code is merged and before any release. Code + migrations are already in
the repo; this only covers what can't be done in code.

Run it against **DEV first** (verify), then repeat the same steps on **PROD**.

> Keep this guide complete: any Phase-1 change that adds a manual step must add it
> here in the same change.

## 1. Deploy the backend

Pushes the Phase-1 migrations (groups schema, `group_id` columns, membership
RLS, abuse-limit triggers, onboarding/join RPCs, data migration) and the new
`delete-account` edge function.

```bash
npm run supabase:setup:dev    # then, once verified:
npm run supabase:setup:prod
```

Granular re-runs if needed: `db:push:dev` / `functions:deploy:dev` (and `:prod`).

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

<!--
Phase-1 items still to append their manual steps here as they land:
- Privacy Policy rewrite for open self-signup + host at public URL
  (extends docs/play-tracks-setup.md privacy hosting).
- UGC report/block + moderation shipped → re-submit Play Content rating
  (flip block-users / report-users answers to Yes).
- Rebrand: new app name, icon/splash/theme, store listing (en + pl) + screenshots.
- Data migration: confirm the default group's admin user / premium tier / limit.
- Any per-group cron / edge-function config changes.
-->
