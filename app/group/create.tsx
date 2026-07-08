import React, { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { showAlert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { createGroup, signalMembershipChanged } from "@/lib/groups";
import { useGroup } from "@/lib/groupContext";

import { VStack } from "@/components/ui/vstack";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";

export default function CreateGroupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refresh, setCurrentGroup } = useGroup();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showAlert(t("common.error"), t("onboarding.nameRequired"));
      return;
    }
    setCreating(true);
    try {
      const newId = await createGroup(trimmed);
      signalMembershipChanged();
      await refresh();
      setCurrentGroup(newId);
      router.replace("/(tabs)");
    } catch (e: any) {
      showAlert(t("onboarding.createFailed"), e?.message ?? "");
    } finally {
      setCreating(false);
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
            <Heading size="md">{t("onboarding.createTitle")}</Heading>
            <Text size="sm" className="text-stone-500">
              {t("onboarding.createDescription")}
            </Text>
            <Input variant="outline" className="rounded-lg">
              <InputField
                placeholder={t("onboarding.groupNamePlaceholder")}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </Input>
            <Button
              action="primary"
              onPress={handleCreate}
              isDisabled={creating}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
