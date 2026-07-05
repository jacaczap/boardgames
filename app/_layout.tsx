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
import * as ExpoLinking from "expo-linking";
import { Stack, useRouter, useSegments } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Session } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { checkVersionGate } from "@/lib/version";
import {
  getMembershipCount,
  getPendingInviteCode,
  onMembershipChanged,
  parseInviteCode,
  setPendingInviteCode,
} from "@/lib/groups";
import { GroupProvider } from "@/lib/groupContext";
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

// Establishes a Supabase session from tokens embedded in a deep link (email
// confirmation / password recovery). Handles both the implicit flow (tokens in
// the URL fragment) and PKCE (a `code` query param). Returns true when the link
// is a password-recovery link.
async function establishSessionFromUrl(url: string): Promise<boolean> {
  try {
    const hashIndex = url.indexOf("#");
    if (hashIndex >= 0) {
      const params = new URLSearchParams(url.slice(hashIndex + 1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        return params.get("type") === "recovery";
      }
    }

    const queryIndex = url.indexOf("?");
    if (queryIndex >= 0) {
      const query = url.slice(queryIndex + 1).split("#")[0];
      const params = new URLSearchParams(query);
      const code = params.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        return params.get("type") === "recovery";
      }
    }
  } catch {
    // Ignore malformed links / already-consumed tokens.
  }
  return false;
}

export default function RootLayout() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateStoreUrl, setUpdateStoreUrl] = useState<string | null>(null);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [membership, setMembership] = useState<"unknown" | "none" | "has">(
    "unknown",
  );
  const [pendingCode, setPendingCode] = useState<string | null>(null);
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

  // Keep the onboarding gate in sync with the user's group memberships.
  const refreshMembership = useCallback(async (userId: string) => {
    try {
      const count = await getMembershipCount(userId);
      setMembership(count > 0 ? "has" : "none");
    } catch {
      // Fail open: a transient error must not trap an existing user in
      // onboarding. New users hit the onboarding query right after signup, when
      // the network is already working.
      setMembership("has");
    }
  }, []);

  const syncPendingCode = useCallback(async () => {
    setPendingCode(await getPendingInviteCode());
  }, []);

  useEffect(() => {
    syncPendingCode();
  }, [syncPendingCode]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setMembership("unknown");
      return;
    }
    refreshMembership(userId);
    const unsub = onMembershipChanged(() => {
      refreshMembership(userId);
      syncPendingCode();
    });
    return unsub;
  }, [session?.user?.id, refreshMembership, syncPendingCode]);

  // Deep links: password-recovery sessions and group invite links.
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;

      const recovery = await establishSessionFromUrl(url);
      const { hostname, path } = ExpoLinking.parse(url);
      const target = `${hostname ?? ""}/${path ?? ""}`;
      if (recovery || target.includes("reset-password")) {
        router.replace("/(auth)/reset-password");
        return;
      }

      const code = parseInviteCode(url);
      if (code) {
        await setPendingInviteCode(code);
        setPendingCode(code);
        router.replace(`/join/${code}`);
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (loading || updateRequired) return;

    const seg = segments as string[];
    const first = seg[0];
    const inAuth = first === "(auth)";
    const inJoin = first === "join";
    const inOnboarding = first === "onboarding";
    const inReset = inAuth && seg[1] === "reset-password";

    if (!session) {
      if (!inAuth && !inJoin) router.replace("/(auth)/login");
      return;
    }

    // A live recovery session must stay on the reset screen.
    if (inReset) return;

    // Finish a pending invite before anything else, but only pull users who are
    // still on the auth/onboarding screens (never yank them out of the app).
    if (pendingCode && (inAuth || inOnboarding)) {
      router.replace(`/join/${pendingCode}`);
      return;
    }

    if (membership === "none" && !inOnboarding && !inJoin) {
      router.replace("/onboarding");
      return;
    }

    if (membership === "has" && (inAuth || inOnboarding)) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments, updateRequired, membership, pendingCode, router]);

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
      <GroupProvider>
      <View style={isWeb ? webStyles.outer : appStyles.root}>
        <View style={isWeb ? webStyles.inner : appStyles.root}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="join/[code]" />
            {[
              { name: "group/create", title: t("groups.createTitle") },
              { name: "group/join", title: t("groups.joinTitle") },
              { name: "group/settings", title: t("groups.settingsTitle") },
              { name: "group/members", title: t("groups.membersTitle") },
              { name: "group/invite", title: t("groups.inviteTitle") },
            ].map((s) => (
              <Stack.Screen
                key={s.name}
                name={s.name}
                options={{
                  title: s.title,
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
            ))}
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
      </GroupProvider>
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
