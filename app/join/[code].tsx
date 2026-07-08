import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Platform } from "react-native";
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
import { useGroup } from "@/lib/groupContext";

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
  const { groups, setCurrentGroup } = useGroup();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [joining, setJoining] = useState(false);

  // On the web app opened in an Android browser, offer (don't force) opening the
  // native app. Verified App Links already handle links tapped from outside a
  // browser; this covers same-domain navigation where they don't fire.
  const isAndroidWeb =
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    /Android/i.test(navigator.userAgent);
  const [showAppPrompt, setShowAppPrompt] = useState(isAndroidWeb);

  const openInApp = () => {
    if (typeof window !== "undefined") {
      window.location.href = `boardgames://join/${code}`;
    }
  };

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

  const alreadyMember =
    !!preview && groups.some((g) => g.groupId === preview.groupId);

  const goToGroup = async () => {
    if (preview) setCurrentGroup(preview.groupId);
    await clearPendingInviteCode();
    signalMembershipChanged();
    router.replace("/(tabs)");
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

  if (showAppPrompt && preview && !preview.expired) {
    return (
      <ScrollView
        className="flex-1 bg-stone-50"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
      >
        <VStack space="xl">
          <Center>
            <Ionicons name="phone-portrait-outline" size={64} color="#b45309" />
          </Center>
          <Heading size="2xl" className="text-center">
            {t("join.openInAppTitle")}
          </Heading>
          <Text className="text-center text-stone-600">
            {t("join.openInAppMessage")}
          </Text>
          <VStack space="lg">
            <Button
              action="primary"
              size="lg"
              onPress={openInApp}
              className="rounded-lg"
            >
              <ButtonText>{t("join.openInApp")}</ButtonText>
            </Button>
            <Button
              action="primary"
              variant="outline"
              size="lg"
              onPress={() => setShowAppPrompt(false)}
              className="rounded-lg"
            >
              <ButtonText>{t("join.continueInBrowser")}</ButtonText>
            </Button>
          </VStack>
        </VStack>
      </ScrollView>
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
        ) : hasSession && alreadyMember ? (
          <VStack space="lg">
            <Text className="text-center text-stone-600">
              {t("join.alreadyMember", { name: preview!.groupName })}
            </Text>
            <Button
              action="primary"
              size="lg"
              onPress={goToGroup}
              className="rounded-lg"
            >
              <ButtonText>{t("join.goToGroup")}</ButtonText>
            </Button>
          </VStack>
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
