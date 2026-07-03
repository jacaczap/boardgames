# DEV Firebase / push setup (Phase 0)

Adds a second Android app (`com.jacaczap.boardgames.dev`) to the **existing**
Firebase project so push works on the dev build too.

All steps are **guided** (Firebase console + EAS). No app-config change is needed:
a **single** `google-services.json` holds both the prod and dev Android clients,
and the Google Services Gradle plugin selects the entry matching the built package
id. `app.config.ts` always points at that one file.

## 1. Add the dev Android app (guided)

1. [console.firebase.google.com](https://console.firebase.google.com/) → open the
   **existing** project (`boardgames-1c000`). Do **not** create a new project.
2. Project settings → **Your apps** → **Add app** → Android.
3. Package name: `com.jacaczap.boardgames.dev`. Nickname e.g. "Planszówki Dev".
   Skip the SHA-1 (not needed for push). Register the app.
4. **Download `google-services.json`** and replace the repo-root
   `google-services.json` with it. The download is project-level, so it now lists
   **both** the prod and dev clients — that's what we want (one file for all
   builds). Skip the remaining "add SDK" console steps — Expo handles that.

Sanity check: `project_id` must be `boardgames-1c000`, and `client[]` must contain
entries for **both** `com.jacaczap.boardgames` and `com.jacaczap.boardgames.dev`.

## 2. Wire the FCM V1 key for the dev app id (guided)

Push credentials in EAS are **per app id**, so the dev app id needs the FCM V1
Google Service Account key too. It's the same Firebase project, so **reuse the
same** `*-firebase-adminsdk-*.json` key already used for prod (regenerate from
Project settings → **Service accounts** → *Generate new private key* if you don't
have it locally).

```bash
eas credentials
# Platform: Android
# Profile: development   (app id com.jacaczap.boardgames.dev)
# Select: Google Service Account → ...Key for Push Notifications (FCM V1)
# Set up / manage the key → point to the firebase-adminsdk JSON
```

## 3. Build & verify

`google-services.json` is a native config change, so OTA won't pick it up —
rebuild:

```bash
npm run build:dev
```

Then log in on the dev build and confirm a push arrives (e.g. trigger a survey
reminder). If nothing comes through, re-check step 2 (key on the `.dev` app id)
and that the bundled app id is `com.jacaczap.boardgames.dev`.

> `google-services.json` is safe to commit (bundled with the app). The admin SDK
> key (`*-firebase-adminsdk-*.json`) is gitignored and must never be committed.
