import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushRegistrationResult =
  | { status: "success"; token: string }
  | { status: "skipped_web" }
  | { status: "not_a_device" }
  | {
      status: "permission_denied";
      existingStatus: Notifications.PermissionStatus;
      finalStatus: Notifications.PermissionStatus;
      canAskAgain: boolean;
    }
  | { status: "missing_project_id" }
  | { status: "token_fetch_failed"; error: string };

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (Platform.OS === "web") return { status: "skipped_web" };

  if (!Device.isDevice) {
    console.warn("[push] skipping registration: not a physical device");
    return { status: "not_a_device" };
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  let canAskAgain = existing.canAskAgain ?? true;

  if (finalStatus !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    finalStatus = req.status;
    canAskAgain = req.canAskAgain ?? canAskAgain;
  }

  if (finalStatus !== "granted") {
    console.warn(
      `[push] permission not granted (existing=${existing.status} final=${finalStatus} canAskAgain=${canAskAgain})`,
    );
    return {
      status: "permission_denied",
      existingStatus: existing.status,
      finalStatus,
      canAskAgain,
    };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;

  if (!projectId) {
    console.error("[push] missing EAS projectId in Constants");
    return { status: "missing_project_id" };
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return { status: "success", token };
  } catch (e: any) {
    const message = e?.message ?? String(e);
    console.error("[push] getExpoPushTokenAsync failed:", message);
    return { status: "token_fetch_failed", error: message };
  }
}

export async function savePushToken(
  userId: string,
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("push_tokens")
    .upsert({
      user_id: userId,
      token,
      updated_at: new Date().toISOString(),
    });
  if (error) {
    console.warn(`[push] save failed for user=${userId}: ${error.message}`);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function clearPushToken(userId: string): Promise<void> {
  const { error } = await supabase
    .from("push_tokens")
    .delete()
    .eq("user_id", userId);
  if (error) console.warn("Failed to clear push token:", error.message);
}

export type PushTokenEvent =
  | "success"
  | "skipped_web"
  | "not_a_device"
  | "permission_denied"
  | "missing_project_id"
  | "token_fetch_failed"
  | "save_failed"
  | "no_session";

export async function logPushTokenEvent(
  userId: string,
  event: PushTokenEvent,
  reason?: string,
): Promise<void> {
  const payload = {
    user_id: userId,
    event,
    reason: reason ?? null,
    platform: Platform.OS,
  };
  console.log(`[push] event`, payload);
  const { error } = await supabase.rpc("log_push_token_event", {
    p_event: event,
    p_reason: reason ?? null,
    p_platform: Platform.OS,
    p_app_state: null,
  });
  if (error) {
    console.warn(
      `[push] failed to log event=${event} for user=${userId}: ${error.message}`,
    );
  }
}
