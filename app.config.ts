import { existsSync, readFileSync } from "fs";
import { ExpoConfig, ConfigContext } from "expo/config";

type AppEnv = "development" | "staging" | "production";

const APP_ENV = (process.env.APP_ENV as AppEnv) || "development";
const IS_DEV = APP_ENV === "development";
// staging = prod app id (IS_DEV false) but DEV database, so only production
// points at the prod Supabase project.
const USE_PROD_DB = APP_ENV === "production";

// Local runs read the matching per-environment file (.env.dev / .env.prod).
// On EAS/Vercel the file is absent and the same vars come from the platform's
// environment variables — loadEnvFile no-ops and we fall through to process.env.
loadEnvFile(USE_PROD_DB ? ".env.prod" : ".env.dev");

const variant = IS_DEV
  ? {
      name: "Planszówki (Dev)",
      packageId: "com.jacaczap.boardgames.dev",
    }
  : {
      name: "Planszówki",
      packageId: "com.jacaczap.boardgames",
    };

// Single project-level file holds both the prod and dev Android clients; the
// Google Services Gradle plugin selects the entry matching the built package id.
const googleServicesFile = "./google-services.json";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: variant.name,
  slug: "boardgames",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "boardgames",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#fdf8f0",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: variant.packageId,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#C89B6E",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    package: variant.packageId,
    googleServicesFile,
    softwareKeyboardLayoutMode: "resize",
    permissions: [
      "android.permission.READ_CALENDAR",
      "android.permission.WRITE_CALENDAR",
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-notifications",
    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow BoardGames to access your photos for game images.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      "expo-calendar",
      {
        calendarPermission:
          "Allow BoardGames to add meeting events to your calendar.",
      },
    ],
    "expo-localization",
    "expo-sharing",
    "expo-image",
  ],
  extra: {
    router: {},
    eas: {
      projectId: "7e6bb5e3-0ee3-4378-af42-19a9d7cf60a0",
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY,
  },
});

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
