# Google Play tracks setup

One package (`com.jacaczap.boardgames`), one binary (PROD build), promoted through tracks: **internal → closed (Alpha) → production**. DEV (`.dev`) is a separate side-loaded app, never on Play.

> Migrate PROD DB **before** promoting to closed (testers run against PROD). Prefer expand-then-contract migrations; use the `min_version` gate for breaking changes.

## 0. Prerequisites (unblocks every track)

Play Console → **App content**:

- **Privacy policy** — set the hosted URL (see below).
- **App access** — "Some functionality restricted" + a dedicated PROD reviewer account (email + password). Keep it working.
- **Data safety** — declare email, name, avatar/photos, push token. Mirror [PRIVACY_POLICY.md](../PRIVACY_POLICY.md).
- **Ads** — "No ads".
- **Content rating** — fill questionnaire.
- **Target audience** — 13+, not for children.
- Other flags (news/government/financial/health) — "No".

**Store listing** — name, descriptions, icon, feature graphic, screenshots from [store-listing.md](store-listing.md).

### Privacy policy hosting (GitHub Pages)

1. Merge branch into `main`.
2. GitHub → **Settings → Pages** → source **Deploy from a branch** → branch `main`, folder `/docs` → Save.
3. Confirm it loads: `https://jacaczap.github.io/boardgames/privacy/`
4. Paste URL into Play Console → **App content → Privacy policy**.

Keep `PRIVACY_POLICY.md` and `docs/privacy/index.html` in sync.

## 1. Release flow per version

1. Schema change? Migrate PROD DB first.
2. `npm run build:prod` then upload, or `npm run submit:prod` (→ internal track).
3. Play Console → **Testing → Internal testing → Releases**: publish. Quick-check on your phone against PROD.
4. Promote internal → closed → production (no rebuild).

## 2. Closed testing (friend group)

1. Play Console → **Testing → Closed testing** → **Alpha** track.
2. **Testers** tab: add emails/Google Group. Copy the **opt-in URL** and send it.
3. Each release: promote internal → closed, publish, confirm testers get it with PROD data.

## Gotchas

- One package per Play app; `.dev` id is separate (side-loaded only).
- Multi-track testers get highest priority (internal > closed > production) — keep the friend group on **closed only**.
- Version codes auto-increment (`appVersionSource: remote`) — don't hand-set.
- Personal dev accounts may need 12+ testers for 14 days on closed before production unlocks.
