import React, { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { showAlert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { joinGroupByCode, signalMembershipChanged } from "@/lib/groups";
import { useGroup } from "@/lib/groupContext";

import { VStack } from "@/components/ui/vstack";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";

export default function JoinGroupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refresh, setCurrentGroup } = useGroup();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      showAlert(t("common.error"), t("onboarding.codeRequired"));
      return;
    }
    setJoining(true);
    try {
      const groupId = await joinGroupByCode(trimmed);
      signalMembershipChanged();
      await refresh();
      setCurrentGroup(groupId);
      router.replace("/(tabs)");
    } catch (e: any) {
      showAlert(t("onboarding.joinFailed"), e?.message ?? "");
    } finally {
      setJoining(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1 bg-stone-50"
        contentContainerStyle={{ padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card variant="outline" className="p-4">
          <VStack space="md">
            <Heading size="md">{t("onboarding.joinTitle")}</Heading>
            <Text size="sm" className="text-stone-500">
              {t("onboarding.joinDescription")}
            </Text>
            <Input variant="outline" className="rounded-lg">
              <InputField
                placeholder={t("onboarding.codePlaceholder")}
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoFocus
              />
            </Input>
            <Button
              action="primary"
              onPress={handleJoin}
              isDisabled={joining}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
