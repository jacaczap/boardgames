# Groups & self-signup setup

One-time manual steps. Run each on **DEV first** (verify), then **PROD**.

> Any Phase-1 change that adds a manual step must add it here.

## Order (breaking change)

1. Run all steps on DEV.
2. `npm run build:prod` → publish to **internal** track → smoke-test ([play-tracks-setup.md](play-tracks-setup.md) §1).
3. Run §1 below on PROD (migration + `min_version` → 1.1.0).
4. Promote internal → closed.
5. Do §2–§8 on PROD.

## 1. Deploy backend

```bash
npm run supabase:setup:dev    # verify, then:
npm run supabase:setup:prod
```

Granular re-runs: `db:push:dev` / `functions:deploy:dev` (`:prod`).

On PROD this creates a premium 20-member `Planszówki` group, sets the earliest account as admin, adds all users. **Confirm admin/tier/limit; adjust if wrong.**

## 2. Auth (both projects)

Dashboard → **Authentication**:

- **Providers → Email**: enable **Allow new users to sign up** + **Confirm email** ON.
- **URL Configuration → Redirect URLs**, add (paths matter — auth emails redirect to
  `/login` and `/reset-password`, so web origins need a `/**` wildcard):
  - `boardgames://login`
  - `boardgames://reset-password`
  - PROD web: `https://votenmeet.vercel.app/**`
  - DEV web: `http://localhost:8081/**`
- **URL Configuration → Site URL**: PROD `https://votenmeet.vercel.app` (DEV `http://localhost:8081`).

## 3. Android App Links (invite links)

- Play Console → app → **Setup → App signing → App signing key certificate**: copy SHA-256.
- Paste it into `sha256_cert_fingerprints` in `public/.well-known/assetlinks.json`.
- Push to `master` (redeploys web). Confirm `https://votenmeet.vercel.app/.well-known/assetlinks.json` loads.
- Fresh-install release build → tap an invite link from a chat app → opens app on join screen.
- Verify: `adb shell pm get-app-links com.jacaczap.boardgames` lists domain `verified`.

## 4. SMTP (Brevo) + email templates

Apply to **DEV first**, then PROD.

**Brevo (once):**
1. Create free account at [brevo.com](https://www.brevo.com).
2. **Senders, Domains, IPs → Senders → Add a sender**: add + verify the "from" address (6-digit code).
3. **SMTP & API → SMTP**: copy an **SMTP key**.

**Supabase (per project) → Authentication → Emails → SMTP**, enable custom SMTP:
- Host `smtp-relay.brevo.com`, Port `587`
- Username = Brevo SMTP login; Password = SMTP key
- Sender email = verified sender; Sender name = `VoteNMeet`

Then **Authentication → Rate Limits**: raise email limit as needed.

## 5. Verify

- Register → confirm email → land in onboarding.
- Second account: join via invite link → register/login → join.
- Forgot password → reset link → new password → login.
- Profile → Delete account → confirm login blocked after.
- Report + block: report a game/member → admin gets push + sees it under **Group settings → Reports**; block → name/avatar masked; unblock from **Profile → Blocked users**.

## 6. Privacy policy

Host it + set the URL in Play — see [play-tracks-setup.md](play-tracks-setup.md) → "Privacy policy hosting". URL: `https://jacaczap.github.io/boardgames/privacy/`.

## 7. Store listing / rebrand

- Paste name + descriptions (en + pl) from [store-listing.md](store-listing.md) into Play Console → **Main store listing** per language.
- Redo all screenshots (phone + tablet, en + pl) — see [store-listing.md](store-listing.md).
- Play Console app name → **VoteNMeet**.
- Optional: replace `assets/android-icon-monochrome.png` with an on-brand single-color icon.

## 8. Content rating

Play Console → **App content → Content rating** → re-open questionnaire → set **report users** + **block users** to **Yes** → re-submit.
