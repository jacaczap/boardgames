# Google Play tracks setup

The Play app has **one package** (`com.jacaczap.boardgames`) and **one binary**:
the **PROD-backed** `production` build. It flows through the tracks as a
release ring — same artifact, promoted, no rebuild:

- **Internal testing** → your pre-release smoke ring (upload here first, quick-check on your phone).
- **Closed testing** (the `alpha` track) → the friend group.
- **Production** → public, promoted from closed.

The **DEV** build is a **separate app** (`com.jacaczap.boardgames.dev`) that you
**side-load** (a standalone `.dev` AAB from `npm run build:dev`). It never
touches Play, so it installs alongside prod and lets you experiment against the
DEV database without disturbing the prod app.

> **Migrate PROD DB before promoting to closed.** Closed testers run against the
> PROD database, so a schema migration must land on PROD **before** that build
> reaches them. Prefer backward-compatible (expand-then-contract) migrations so
> the already-installed app keeps working during the rollout window; use the
> `min_version` gate for genuinely breaking changes.

Builds are uploaded either manually (`.aab` from `npm run build:prod`) or via
`eas submit` (see README step 7). `submit:prod` → `internal` track; promote to
closed/production from there.

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

## 1. Release flow per version

1. If the version has a schema change, **migrate the PROD DB first** (see the
   note above).
2. Build/submit the PROD-backed build: `npm run build:prod` then upload, or
   `npm run submit:prod` (targets the **internal** track).
3. Play Console → **Testing → Internal testing → Releases**: publish it.
   Quick-check on your own phone against **PROD** data.
4. **Promote to closed** (Alpha), then **to production** — no rebuild (see
   promotion flow below).

## 2. Closed testing (the friend group)

One-time, then reuse each release:

1. Play Console → **Testing → Closed testing** → open the **Alpha** track.
2. **Testers** tab: add the friend group (an email list or a Google Group).
   Copy the **opt-in URL** and send it — closed testing needs a per-tester opt-in.
3. Each release: promote the internal release into closed, publish, confirm
   testers get the app and see **PROD** data.

## Promotion flow (no rebuild)

Promote an existing release in the Play Console rather than rebuilding:

**internal → closed → production**

All three tracks run the same PROD build, so promoting ships the exact artifact
you already validated. Production needs full Google review; internal/closed
publish (near-)instantly.

## Gotchas

- **One package per Play app.** All tracks use `com.jacaczap.boardgames`; the
  `.dev` id is a **separate app** (side-loaded), never uploaded to this listing.
- **Track priority.** A tester in multiple tracks gets the highest-priority one
  (internal > closed > production). Harmless here since every track runs the
  same PROD build — but keep the friend group on **closed only**, not internal.
- **Version codes must increase.** `production` `autoIncrement`s off the shared
  EAS remote counter (`appVersionSource: remote`), so codes stay monotonic —
  don't hand-set them.
- **Personal dev accounts** may require 12+ testers for 14 days on closed testing
  before Production is unlocked; the closed track above satisfies that.
