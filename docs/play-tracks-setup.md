# Google Play tracks setup (Phase 0)

Splits the single Play app into two purposes so testers stop hitting the same
backend as the dev build:

- **Internal testing** → `staging` build (app id `com.jacaczap.boardgames`, **DEV** DB). For you only.
- **Closed testing** (the `alpha` track) → `production` build (same app id, **PROD** DB). For the current testers.
- **Production** later → same `production` build, promoted from closed.

Both builds share the **same package id**, so they live in the **same Play app**
on different tracks (only the local dev-client uses the `.dev` id — never
uploaded). The only difference is which Supabase DB the build talks to.

> **Priority gotcha:** a tester enrolled in multiple tracks gets the build from
> the **highest-priority** track, and internal outranks closed. So a current
> tester left on internal would keep getting the **DEV** build even after opting
> into closed. Removing them from internal (step 2) is mandatory, not optional.

Order matters: get the current testers onto closed/PROD **first**, then repoint
internal at DEV. Otherwise they'd briefly see DEV data.

Builds are uploaded either manually (`.aab` from `npm run build:*`) or via
`eas submit` (see README step 7). `submit:staging` → `internal`,
`submit:prod` → `alpha` (closed).

## 0. Prerequisites before any track can publish

Play blocks publishing to **every** track (internal/closed/production) until the
store listing basics and **App content** declarations are done. Complete these
once, up front:

- **Privacy policy URL** — a publicly reachable link (a repo `.md` isn't enough).
  See "Privacy policy hosting" below. Enter it in **App content → Privacy policy**.
- **App access (login declaration)** — the app requires login and has **no
  self-signup yet**, so reviewers can't get in on their own. In **App content →
  App access**, choose "All/some functionality restricted" and provide a
  **dedicated reviewer test account** (email + password) that already exists in
  the PROD Supabase. Keep it working; don't delete it.
- **Data safety form** — declare what's collected (email, name, avatar/photos,
  push token) and how it's used. Mirror [PRIVACY_POLICY.md](../PRIVACY_POLICY.md).
- **Ads** — declare "No ads".
- **Content rating** — fill the questionnaire (yields IARC rating).
- **Target audience & content** — set age groups (13+; not directed at children).
- **Store listing** — app name, short + full description, icon, feature graphic,
  and screenshots. Consider a public/English-friendly name (currently Polish-only
  "Planszówki").
- Any other flagged declarations (news, government, financial, health) — likely
  all "No" here.

Only after these are green does the closed-testing flow below unblock.

### Privacy policy hosting (GitHub Pages)

The current [PRIVACY_POLICY.md](../PRIVACY_POLICY.md) content is accurate for
this closed-testing phase (still invite-only / admin-created), so it just needs
to be **hosted at a live public URL** — no rewrite required yet. (The rewrite for
open self-signup happens in Phase 1, per the main plan.)

Hosted via GitHub Pages from this repo. The page lives at
[docs/privacy/index.html](privacy/index.html) (self-contained HTML mirroring the
`.md`; `docs/.nojekyll` disables Jekyll so files serve as-is).

**One-time enable (Play needs the live URL first):**
1. Merge this branch into `main` (Pages serves from `main`, not feature branches).
2. Play repo is public, so free Pages applies. GitHub → **Settings → Pages** →
   Source **Deploy from a branch** → branch **`main`**, folder **`/docs`** → Save.
3. Wait for the deploy, then confirm the page loads at:
   **`https://jacaczap.github.io/boardgames/privacy/`**
4. Paste that URL into Play Console → **App content → Privacy policy**.

Keep `PRIVACY_POLICY.md` and `docs/privacy/index.html` in sync when either
changes.

## 1. Stand up closed testing on PROD

1. Build/submit the PROD-backed build: `npm run build:prod` then upload, or
   `npm run submit:prod` (targets the `alpha`/closed track).
2. Play Console → **Testing → Closed testing** → open the **Alpha** track.
3. **Testers** tab: add the current testers (reuse the same email list the
   internal track uses, or a Google Group). Copy the **opt-in URL** and send it
   to them — closed testing needs a fresh opt-in per tester.
4. **Releases** tab: publish the uploaded build. Confirm testers get the app and
   see **PROD** data.

## 2. Repoint internal testing at DEV

Only after the testers are confirmed on closed:

1. Play Console → **Testing → Internal testing → Testers**: **remove** the
   migrated testers, leave only your own dev account. (Skipping this = they keep
   the DEV build, per the priority gotcha above.)
2. Build/submit the DEV-backed build: `npm run build:staging` then upload, or
   `npm run submit:staging` (targets the `internal` track).
3. Publish it on the internal track. Confirm your dev account sees **DEV** data.

## Promotion flow (no rebuild)

Promote an existing release in the Play Console rather than rebuilding:

**internal → closed → production**

Since closed and production both run the PROD build, promoting a closed release
to Production ships the exact artifact testers already validated. Production
needs full Google review; internal/closed publish (near-)instantly.

## Gotchas

- **One package per Play app.** All tracks here use `com.jacaczap.boardgames`;
  the `.dev` id belongs to no Play app.
- **Version codes must increase.** `staging` and `production` both
  `autoIncrement` off the shared EAS remote counter (`appVersionSource: remote`),
  so codes stay monotonic across tracks — don't hand-set them.
- **Personal dev accounts** may require 12+ testers for 14 days on closed testing
  before Production is unlocked; the closed track above satisfies that.
