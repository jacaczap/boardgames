import React, { useEffect, useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useGroup } from "@/lib/groupContext";
import {
  renameGroup,
  deleteGroup,
  leaveGroup,
  signalMembershipChanged,
} from "@/lib/groups";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Center } from "@/components/ui/center";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";

export default function GroupSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentGroup, currentGroupId, refresh } = useGroup();
  const isAdmin = currentGroup?.role === "admin";

  const [name, setName] = useState(currentGroup?.groupName ?? "");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    setName(currentGroup?.groupName ?? "");
  }, [currentGroup?.groupName]);

  if (!currentGroupId || !currentGroup) {
    return (
      <Center className="flex-1 bg-stone-50 p-6">
        <VStack space="md" className="items-center">
          <Text className="text-stone-500 text-center">{t("groups.noGroupDesc")}</Text>
          <Button action="primary" onPress={() => router.replace("/group/create")}>
            <ButtonText>{t("groups.createNew")}</ButtonText>
          </Button>
          <Button
            action="secondary"
            variant="outline"
            onPress={() => router.replace("/group/join")}
          >
            <ButtonText>{t("groups.joinAnother")}</ButtonText>
          </Button>
        </VStack>
      </Center>
    );
  }

  const handleRename = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showAlert(t("common.error"), t("onboarding.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      await renameGroup(currentGroupId, trimmed);
      signalMembershipChanged();
      await refresh();
      showAlert(t("profile.savedTitle"), t("groups.renameSaved"));
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("groups.renameFailed"));
    } finally {
      setSaving(false);
    }
  };

  const doLeave = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await leaveGroup(currentGroupId, userId);
      signalMembershipChanged();
      await refresh();
      router.replace("/(tabs)");
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("groups.leaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = () => {
    showAlert(t("groups.leaveTitle"), t("groups.leaveConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("groups.leave"), style: "destructive", onPress: doLeave },
    ]);
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await deleteGroup(currentGroupId);
      signalMembershipChanged();
      await refresh();
      router.replace("/(tabs)");
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("groups.deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    showAlert(t("groups.deleteTitle"), t("groups.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: doDelete },
    ]);
  };

  const hasNameChange = name.trim() !== currentGroup.groupName;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1 bg-stone-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <VStack space="lg">
          <Card variant="outline" className="p-4">
            <VStack space="md">
              <Heading size="md">{t("groups.nameLabel")}</Heading>
              <Input variant="outline" isDisabled={!isAdmin} className="rounded-lg">
                <InputField value={name} onChangeText={setName} editable={isAdmin} />
              </Input>
              {isAdmin && (
                <Button
                  action="primary"
                  onPress={handleRename}
                  isDisabled={saving || !hasNameChange}
                >
                  <ButtonText>
                    {saving ? t("common.saving") : t("common.saveChanges")}
                  </ButtonText>
                </Button>
              )}
              <HStack space="sm" className="items-center">
                <Text size="sm" className="text-stone-500">
                  {t(`groups.role.${currentGroup.role}`)}
                </Text>
                <Text size="sm" className="text-stone-400">
                  · {t(`groups.tier.${currentGroup.tier}`, currentGroup.tier)}
                </Text>
              </HStack>
            </VStack>
          </Card>

          <Card variant="outline" className="p-2">
            <VStack>
              <Pressable
                onPress={() => router.push("/group/members")}
                className="px-3 py-3 rounded-lg"
              >
                <HStack space="sm" className="items-center justify-between">
                  <HStack space="sm" className="items-center">
                    <Ionicons name="people-outline" size={20} color="#78716c" />
                    <Text className="text-stone-700">{t("groups.membersTitle")}</Text>
                  </HStack>
                  <Ionicons name="chevron-forward" size={18} color="#a8a29e" />
                </HStack>
              </Pressable>
              {isAdmin && (
                <Pressable
                  onPress={() => router.push("/group/invite")}
                  className="px-3 py-3 rounded-lg"
                >
                  <HStack space="sm" className="items-center justify-between">
                    <HStack space="sm" className="items-center">
                      <Ionicons name="link-outline" size={20} color="#78716c" />
                      <Text className="text-stone-700">{t("groups.inviteTitle")}</Text>
                    </HStack>
                    <Ionicons name="chevron-forward" size={18} color="#a8a29e" />
                  </HStack>
                </Pressable>
              )}
              {isAdmin && (
                <Pressable
                  onPress={() => router.push("/group/moderation")}
                  className="px-3 py-3 rounded-lg"
                >
                  <HStack space="sm" className="items-center justify-between">
                    <HStack space="sm" className="items-center">
                      <Ionicons name="flag-outline" size={20} color="#78716c" />
                      <Text className="text-stone-700">
                        {t("moderation.moderationTitle")}
                      </Text>
                    </HStack>
                    <Ionicons name="chevron-forward" size={18} color="#a8a29e" />
                  </HStack>
                </Pressable>
              )}
            </VStack>
          </Card>

          <Card variant="outline" className="p-4 border-red-200">
            <VStack space="md">
              <HStack space="xs" className="items-center">
                <Ionicons name="warning-outline" size={20} color="#b91c1c" />
                <Heading size="md" className="text-red-700">
                  {t("profile.dangerZone")}
                </Heading>
              </HStack>
              <Button
                action="negative"
                variant="outline"
                isDisabled={busy || !userId}
                onPress={handleLeave}
              >
                <ButtonText>{t("groups.leave")}</ButtonText>
              </Button>
              {isAdmin && (
                <Button
                  action="negative"
                  isDisabled={busy}
                  onPress={handleDelete}
                >
                  <ButtonText>{t("groups.deleteGroup")}</ButtonText>
                </Button>
              )}
            </VStack>
          </Card>
        </VStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
