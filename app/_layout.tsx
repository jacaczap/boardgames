import "../global.css";
import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { getStayLoggedIn } from "@/lib/auth-storage";

import { Center } from "@/components/ui/center";
import { Spinner } from "@/components/ui/spinner";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

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
          options={{ title: "Survey", headerShown: true }}
        />
        <Stack.Screen
          name="approve/[id]"
          options={{ title: "Approve Meeting", headerShown: true }}
        />
      </Stack>
    </GluestackUIProvider>
  );
}
