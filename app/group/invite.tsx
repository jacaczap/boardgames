import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Share, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { useGroup } from "@/lib/groupContext";
import { getDateLocale } from "@/lib/i18n";
import {
  buildInviteUrl,
  createInvite,
  getActiveInvite,
  type GroupInvite,
} from "@/lib/groups";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Center } from "@/components/ui/center";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function GroupInviteScreen() {
  const { t } = useTranslation();
  const { currentGroupId } = useGroup();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [invite, setInvite] = useState<GroupInvite | null>(null);

  const load = useCallback(async () => {
    if (!currentGroupId) return;
    try {
      setInvite(await getActiveInvite(currentGroupId));
    } catch (e) {
      console.error("Failed to load invite:", e);
    } finally {
      setLoading(false);
    }
  }, [currentGroupId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    if (!currentGroupId) return;
    setGenerating(true);
    try {
      setInvite(await createInvite(currentGroupId));
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("groups.inviteFailed"));
    } finally {
      setGenerating(false);
    }
  };

  const inviteUrl = invite ? buildInviteUrl(invite.code) : "";

  const handleShare = async () => {
    if (!invite) return;
    const message = t("groups.inviteShareMessage", { url: inviteUrl });
    try {
      if (Platform.OS === "web") {
        if (navigator?.clipboard) {
          await navigator.clipboard.writeText(inviteUrl);
          showAlert(t("groups.copiedTitle"), t("groups.copiedMessage"));
        }
        return;
      }
      await Share.share({ message });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Spinner />
      </Center>
    );
  }

  const locale = getDateLocale();

  return (
    <ScrollView
      className="flex-1 bg-stone-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
    >
      <VStack space="lg">
        <Card variant="outline" className="p-4">
          <VStack space="md">
            <HStack space="xs" className="items-center">
              <Ionicons name="link-outline" size={20} color="#78716c" />
              <Heading size="md">{t("groups.inviteTitle")}</Heading>
            </HStack>
            <Text size="sm" className="text-stone-500">
              {t("groups.inviteDescription")}
            </Text>

            {invite ? (
              <VStack space="md">
                <Card variant="filled" className="bg-stone-100 p-3">
                  <Text className="text-stone-800 font-mono" selectable>
                    {inviteUrl}
                  </Text>
                </Card>
                <Text size="xs" className="text-stone-400">
                  {t("groups.inviteExpires", {
                    date: new Date(invite.expiresAt).toLocaleString(locale, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })}
                </Text>
                <Button action="primary" onPress={handleShare}>
                  <ButtonText>
                    {Platform.OS === "web" ? t("groups.copyLink") : t("groups.shareLink")}
                  </ButtonText>
                </Button>
                <Button
                  action="secondary"
                  variant="outline"
                  onPress={handleGenerate}
                  isDisabled={generating}
                >
                  {generating ? (
                    <ButtonSpinner />
                  ) : (
                    <ButtonText>{t("groups.regenerate")}</ButtonText>
                  )}
                </Button>
              </VStack>
            ) : (
              <Button action="primary" onPress={handleGenerate} isDisabled={generating}>
                {generating ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText>{t("groups.generateInvite")}</ButtonText>
                )}
              </Button>
            )}
          </VStack>
        </Card>
      </VStack>
    </ScrollView>
  );
}
