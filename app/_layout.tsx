import "../global.css";
import "@/lib/i18n";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Session } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { checkVersionGate } from "@/lib/version";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import UpdateRequiredScreen from "@/components/UpdateRequiredScreen";
import { showAlert } from "@/lib/alert";
import {
  registerForPushNotifications,
  savePushToken,
  logPushTokenEvent,
} from "@/lib/notifications";

import { Center } from "@/components/ui/center";
import { Spinner } from "@/components/ui/spinner";

export default function RootLayout() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateStoreUrl, setUpdateStoreUrl] = useState<string | null>(null);
  const [updateRequired, setUpdateRequired] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const lastVersionCheckRef = useRef(0);

  const runVersionCheck = useCallback(async () => {
    lastVersionCheckRef.current = Date.now();
    const gate = await checkVersionGate();
    if (gate.blocked) {
      setUpdateStoreUrl(gate.storeUrl);
      setUpdateRequired(true);
    }
    return gate;
  }, []);

  useEffect(() => {
    const init = async () => {
      const gate = await runVersionCheck();
      if (gate.blocked) {
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [runVersionCheck]);

  // Re-check the version gate when the app returns to the foreground, so a
  // client that was only backgrounded (not cold-started) still gets locked out
  // after a min-version bump. Runs silently (no loading state) and throttled to
  // avoid firing on brief interruptions like the notification shade.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || updateRequired) return;
      if (Date.now() - lastVersionCheckRef.current < 5 * 60 * 1000) return;
      runVersionCheck();
    });
    return () => sub.remove();
  }, [runVersionCheck, updateRequired]);

  const successRef = useRef(false);
  const inFlightRef = useRef(false);
  const alertedReasonsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS === "web" || updateRequired) return;
    const userId = session?.user?.id;
    if (!userId) return;

    const alertOnce = (reason: string, fn: () => void) => {
      if (alertedReasonsRef.current.has(reason)) return;
      alertedReasonsRef.current.add(reason);
      fn();
    };

    const run = async (trigger: "mount" | "resume") => {
      if (successRef.current || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const result = await registerForPushNotifications();

        if (result.status === "success") {
          const saved = await savePushToken(userId, result.token);
          if (saved.ok) {
            successRef.current = true;
            await logPushTokenEvent(userId, "success", `trigger=${trigger}`);
          } else {
            await logPushTokenEvent(userId, "save_failed", saved.error);
            alertOnce("save_failed", () =>
              showAlert(
                t("push.titleFailed"),
                t("push.saveFailed", { error: saved.error }),
              ),
            );
          }
          return;
        }

        if (result.status === "skipped_web") return;

        if (result.status === "not_a_device") {
          await logPushTokenEvent(userId, "not_a_device");
          return;
        }

        if (result.status === "permission_denied") {
          await logPushTokenEvent(
            userId,
            "permission_denied",
            `trigger=${trigger} existing=${result.existingStatus} final=${result.finalStatus} canAskAgain=${result.canAskAgain}`,
          );
          alertOnce("permission_denied", () =>
            showAlert(
              t("push.titleDisabled"),
              t("push.permissionDeniedOpenSettings"),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("push.openSettings"),
                  onPress: () => {
                    Linking.openSettings().catch(() => {});
                  },
                },
              ],
            ),
          );
          return;
        }

        if (result.status === "missing_project_id") {
          await logPushTokenEvent(userId, "missing_project_id");
          alertOnce("missing_project_id", () =>
            showAlert(t("push.titleFailed"), t("push.missingProjectId")),
          );
          return;
        }

        if (result.status === "token_fetch_failed") {
          await logPushTokenEvent(userId, "token_fetch_failed", result.error);
          alertOnce("token_fetch_failed", () =>
            showAlert(
              t("push.titleFailed"),
              t("push.tokenFetchFailed", { error: result.error }),
            ),
          );
          return;
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    run("mount");

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") run("resume");
    });
    return () => sub.remove();
  }, [session?.user?.id, t, updateRequired]);

  useEffect(() => {
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (!data) return;

        if (data.type === "survey" && data.meetingId) {
          router.push(`/survey/${data.meetingId}`);
        } else if (data.type === "meeting") {
          router.replace("/(tabs)");
        }
      });

    return () => {
      responseListener.current?.remove();
    };
  }, [router]);

  useEffect(() => {
    if (loading || updateRequired) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments, updateRequired]);

  if (loading) {
    return (
      <Center className="flex-1">
        <Spinner />
      </Center>
    );
  }

  if (updateRequired) {
    return (
      <GluestackUIProvider>
        <UpdateRequiredScreen storeUrl={updateStoreUrl} />
      </GluestackUIProvider>
    );
  }

  const isWeb = Platform.OS === "web";

  return (
    <GluestackUIProvider>
      <View style={isWeb ? webStyles.outer : appStyles.root}>
        <View style={isWeb ? webStyles.inner : appStyles.root}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="survey/[id]"
              options={{
                title: t("nav.survey"),
                headerShown: true,
                headerStyle: { backgroundColor: "#4a3228" },
                headerTintColor: "#fef3c7",
                headerTitleStyle: { color: "#fef3c7" },
                ...(isWeb && {
                  headerLeft: () => (
                    <Pressable onPress={() => router.back()} style={{ marginRight: 8 }}>
                      <Ionicons name="arrow-back" size={24} color="#fef3c7" />
                    </Pressable>
                  ),
                }),
              }}
            />
            <Stack.Screen
              name="approve/[id]"
              options={{
                title: t("nav.approveMeeting"),
                headerShown: true,
                headerStyle: { backgroundColor: "#4a3228" },
                headerTintColor: "#fef3c7",
                headerTitleStyle: { color: "#fef3c7" },
                ...(isWeb && {
                  headerLeft: () => (
                    <Pressable onPress={() => router.back()} style={{ marginRight: 8 }}>
                      <Ionicons name="arrow-back" size={24} color="#fef3c7" />
                    </Pressable>
                  ),
                }),
              }}
            />
          </Stack>
        </View>
      </View>
    </GluestackUIProvider>
  );
}

const appStyles = StyleSheet.create({
  root: { flex: 1 },
});

const webStyles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#d6d3d1",
    alignItems: "center",
  },
  inner: {
    flex: 1,
    maxWidth: 700,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
});
