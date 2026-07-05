import React, { useState } from "react";
import { ScrollView, KeyboardAvoidingView } from "react-native";
import { useRouter } from "expo-router";
import { showAlert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import {
  createGroup,
  joinGroupByCode,
  signalMembershipChanged,
} from "@/lib/groups";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Ionicons } from "@expo/vector-icons";

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const busy = creating || joining;

  const handleCreate = async () => {
    const name = groupName.trim();
    if (!name) {
      showAlert(t("common.error"), t("onboarding.nameRequired"));
      return;
    }
    setCreating(true);
    try {
      await createGroup(name);
      signalMembershipChanged();
      router.replace("/(tabs)");
    } catch (e: any) {
      showAlert(t("onboarding.createFailed"), e?.message ?? "");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      showAlert(t("common.error"), t("onboarding.codeRequired"));
      return;
    }
    setJoining(true);
    try {
      await joinGroupByCode(trimmed);
      signalMembershipChanged();
      router.replace("/(tabs)");
    } catch (e: any) {
      showAlert(t("onboarding.joinFailed"), e?.message ?? "");
    } finally {
      setJoining(false);
    }
  };

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  return (
    <KeyboardAvoidingView className="flex-1" behavior="padding">
      <ScrollView
        className="flex-1 bg-stone-50"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <VStack space="xl">
          <VStack space="xs">
            <Heading size="2xl" className="text-center">
              {t("onboarding.title")}
            </Heading>
            <Text className="text-center text-stone-600">
              {t("onboarding.subtitle")}
            </Text>
          </VStack>

          <Card variant="outline" className="p-4">
            <VStack space="md">
              <HStack space="xs" className="items-center">
                <Ionicons name="add-circle-outline" size={20} color="#78716c" />
                <Heading size="md">{t("onboarding.createTitle")}</Heading>
              </HStack>
              <Text size="sm" className="text-stone-500">
                {t("onboarding.createDescription")}
              </Text>
              <Input variant="outline" className="rounded-lg">
                <InputField
                  placeholder={t("onboarding.groupNamePlaceholder")}
                  value={groupName}
                  onChangeText={setGroupName}
                />
              </Input>
              <Button
                action="primary"
                onPress={handleCreate}
                isDisabled={busy}
                className="rounded-lg"
              >
                {creating ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText>{t("onboarding.createButton")}</ButtonText>
                )}
              </Button>
            </VStack>
          </Card>

          <Text className="text-center text-stone-400">
            {t("onboarding.orDivider")}
          </Text>

          <Card variant="outline" className="p-4">
            <VStack space="md">
              <HStack space="xs" className="items-center">
                <Ionicons name="enter-outline" size={20} color="#78716c" />
                <Heading size="md">{t("onboarding.joinTitle")}</Heading>
              </HStack>
              <Text size="sm" className="text-stone-500">
                {t("onboarding.joinDescription")}
              </Text>
              <Input variant="outline" className="rounded-lg">
                <InputField
                  placeholder={t("onboarding.codePlaceholder")}
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                />
              </Input>
              <Button
                action="primary"
                variant="outline"
                onPress={handleJoin}
                isDisabled={busy}
                className="rounded-lg"
              >
                {joining ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText>{t("onboarding.joinButton")}</ButtonText>
                )}
              </Button>
            </VStack>
          </Card>

          <Pressable onPress={handleLogout} disabled={busy}>
            <Text className="text-center text-stone-500 font-medium">
              {t("onboarding.logOut")}
            </Text>
          </Pressable>
        </VStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
