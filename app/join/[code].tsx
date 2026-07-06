import React, { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { showAlert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import {
  clearPendingInviteCode,
  joinGroupByCode,
  previewGroupByCode,
  setPendingInviteCode,
  signalMembershipChanged,
  type GroupPreview,
} from "@/lib/groups";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Center } from "@/components/ui/center";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Pressable } from "@/components/ui/pressable";
import { Ionicons } from "@expo/vector-icons";

export default function JoinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [joining, setJoining] = useState(false);

  // Remember the code so the register/login detour can return here.
  useEffect(() => {
    if (code) setPendingInviteCode(code);
  }, [code]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!code) {
      setPreview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setHasSession(!!session);
      setPreview(await previewGroupByCode(code));
    } catch {
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  // Any exit from this screen must drop the pending code, otherwise the root
  // layout keeps yanking a group-less user back here (onboarding <-> join loop).
  const dismiss = async () => {
    await clearPendingInviteCode();
    // Force the root layout to re-read the (now empty) pending code so it stops
    // redirecting a group-less user straight back to this screen.
    signalMembershipChanged();
    router.replace(hasSession ? "/(tabs)" : "/(auth)/login");
  };

  const handleJoin = async () => {
    if (!code) return;
    setJoining(true);
    try {
      await joinGroupByCode(code);
      await clearPendingInviteCode();
      signalMembershipChanged();
      showAlert(
        t("join.joinedTitle"),
        t("join.joinedMessage", { name: preview?.groupName ?? "" }),
      );
      router.replace("/(tabs)");
    } catch (e: any) {
      showAlert(t("join.joinFailed"), e?.message ?? "");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Spinner />
      </Center>
    );
  }

  const invalid = !preview;
  const expired = preview?.expired ?? false;

  return (
    <ScrollView
      className="flex-1 bg-stone-50"
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
    >
      <VStack space="xl">
        <Center>
          <Ionicons
            name={invalid || expired ? "alert-circle-outline" : "people-outline"}
            size={64}
            color={invalid || expired ? "#b91c1c" : "#b45309"}
          />
        </Center>

        <Heading size="2xl" className="text-center">
          {t("join.title")}
        </Heading>

        {invalid ? (
          <Text className="text-center text-stone-600">
            {t("join.invalidMessage")}
          </Text>
        ) : expired ? (
          <Text className="text-center text-stone-600">
            {t("join.expiredMessage")}
          </Text>
        ) : hasSession ? (
          <VStack space="lg">
            <Text className="text-center text-stone-600">
              {t("join.joinPrompt", { name: preview!.groupName })}
            </Text>
            <Button
              action="primary"
              size="lg"
              onPress={handleJoin}
              isDisabled={joining}
              className="rounded-lg"
            >
              {joining ? (
                <ButtonSpinner />
              ) : (
                <ButtonText>{t("join.joinButton")}</ButtonText>
              )}
            </Button>
          </VStack>
        ) : (
          <VStack space="lg">
            <Text className="text-center text-stone-600">
              {t("join.signInPrompt", { name: preview!.groupName })}
            </Text>
            <Button
              action="primary"
              size="lg"
              onPress={() => router.replace("/(auth)/login")}
              className="rounded-lg"
            >
              <ButtonText>{t("join.logIn")}</ButtonText>
            </Button>
            <Button
              action="primary"
              variant="outline"
              size="lg"
              onPress={() => router.replace("/(auth)/register")}
              className="rounded-lg"
            >
              <ButtonText>{t("join.signUp")}</ButtonText>
            </Button>
          </VStack>
        )}

        <Pressable onPress={dismiss} disabled={joining}>
          <Text className="text-center text-amber-700 font-medium">
            {invalid || expired ? t("join.goBack") : t("join.notNow")}
          </Text>
        </Pressable>
      </VStack>
    </ScrollView>
  );
}
