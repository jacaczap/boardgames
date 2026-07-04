import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";

export type VersionGate =
  | { blocked: false }
  | { blocked: true; storeUrl: string | null };

function parse(version: string): number[] {
  return version
    .split(".")
    .map((part) => parseInt(part, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

// Returns true when `current` is older than `minimum`.
export function isOutdated(current: string, minimum: string): boolean {
  const a = parse(current);
  const b = parse(minimum);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}

// Web is always current (Vercel), so it is exempt and never blocks. Any error
// (no network, missing config row) fails open so a backend hiccup can't lock
// everyone out of the app.
export async function checkVersionGate(): Promise<VersionGate> {
  if (Platform.OS === "web") return { blocked: false };

  const current = Constants.expoConfig?.version;
  if (!current) return { blocked: false };

  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("min_version, store_url")
      .eq("platform", Platform.OS)
      .maybeSingle();

    if (error || !data) return { blocked: false };

    if (isOutdated(current, data.min_version)) {
      return { blocked: true, storeUrl: data.store_url };
    }
    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}
