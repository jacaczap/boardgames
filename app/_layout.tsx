import "../global.css";
import "@/lib/i18n";
import React, { useEffect, useState, useRef } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { Session } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { getStayLoggedIn } from "@/lib/auth-storage";
import {
  registerForPushNotifications,
  savePushToken,
} from "@/lib/notifications";

import { Center } from "@/components/ui/center";
import { Spinner } from "@/components/ui/spinner";

export default function RootLayout() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    const init = async () => {
      const stayLoggedIn = await getStayLoggedIn();
      if (!stayLoggedIn) {
        await supabase.auth.signOut();
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
  }, []);

  useEffect(() => {
    if (!session?.user || Platform.OS === "web") return;

    (async () => {
      const token = await registerForPushNotifications();
      if (token) {
        await savePushToken(session.user.id, token);
      }
    })();
  }, [session?.user?.id]);

  useEffect(() => {
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (!data) return;

        if (data.type === "survey" && data.meetingId) {
          router.push(`/survey/${data.meetingId}`);
        } else if (data.type === "meeting" && data.meetingId) {
          router.push(`/approve/${data.meetingId}`);
        }
      });

    return () => {
      responseListener.current?.remove();
    };
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <Center className="flex-1">
        <Spinner />
      </Center>
    );
  }

  return (
    <GluestackUIProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="survey/[id]"
          options={{ title: t("nav.survey"), headerShown: true }}
        />
        <Stack.Screen
          name="approve/[id]"
          options={{ title: t("nav.approveMeeting"), headerShown: true }}
        />
      </Stack>
    </GluestackUIProvider>
  );
}
