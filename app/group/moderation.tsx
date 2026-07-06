import React, { useCallback, useState } from "react";
import { ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { showAlert } from "@/lib/alert";
import { useGroup } from "@/lib/groupContext";
import {
  listOpenReports,
  resolveReport,
  type ContentReport,
  type ReportStatus,
} from "@/lib/moderation";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Center } from "@/components/ui/center";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Button, ButtonText } from "@/components/ui/button";

export default function GroupModerationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentGroupId, currentGroup } = useGroup();
  const isAdmin = currentGroup?.role === "admin";

  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!currentGroupId || !isAdmin) {
      setLoading(false);
      return;
    }
    try {
      setReports(await listOpenReports(currentGroupId));
    } catch (e) {
      console.error("Failed to fetch reports:", e);
    } finally {
      setLoading(false);
    }
  }, [currentGroupId, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [fetchReports]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }, [fetchReports]);

  const openContent = (report: ContentReport) => {
    if (report.contentType === "board_game") {
      router.push(`/(tabs)/games/${report.contentId}`);
    } else if (report.contentType === "profile") {
      router.push("/group/members");
    } else {
      router.push("/group/settings");
    }
  };

  const act = async (report: ContentReport, status: Exclude<ReportStatus, "open">) => {
    setBusy(report.id);
    try {
      await resolveReport(report.id, status);
      await fetchReports();
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("moderation.actionFailed"));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Spinner />
      </Center>
    );
  }

  if (!isAdmin) {
    return (
      <Center className="flex-1 bg-stone-50 p-6">
        <Text className="text-stone-500">{t("groups.noGroup")}</Text>
      </Center>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-stone-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <VStack space="md">
        <Text size="sm" className="text-stone-500">
          {t("moderation.moderationDesc")}
        </Text>

        {reports.length === 0 ? (
          <Center className="py-10">
            <Text className="text-stone-400">{t("moderation.reportsEmpty")}</Text>
          </Center>
        ) : (
          reports.map((r) => (
            <Card key={r.id} variant="outline" className="p-4">
              <VStack space="sm">
                <HStack space="sm" className="items-center">
                  <Badge action="muted">
                    <BadgeText action="muted">
                      {t(`moderation.contentType.${r.contentType}`)}
                    </BadgeText>
                  </Badge>
                  <Text className="font-medium text-stone-800 flex-1" numberOfLines={1}>
                    {t(`moderation.reason.${r.reason}`, r.reason)}
                  </Text>
                </HStack>

                {r.details ? (
                  <Text size="sm" className="text-stone-600">
                    {r.details}
                  </Text>
                ) : null}

                <Text size="xs" className="text-stone-400">
                  {t("moderation.reportedBy", {
                    name: r.reporterName ?? "?",
                  })}
                  {" · "}
                  {new Date(r.createdAt).toLocaleDateString()}
                </Text>

                <HStack space="sm" className="mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    className="flex-1"
                    onPress={() => openContent(r)}
                  >
                    <ButtonText>{t("moderation.openContent")}</ButtonText>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    className="flex-1"
                    isDisabled={busy === r.id}
                    onPress={() => act(r, "dismissed")}
                  >
                    <ButtonText>{t("moderation.dismiss")}</ButtonText>
                  </Button>
                  <Button
                    size="sm"
                    action="primary"
                    className="flex-1"
                    isDisabled={busy === r.id}
                    onPress={() => act(r, "resolved")}
                  >
                    <ButtonText>{t("moderation.resolve")}</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            </Card>
          ))
        )}
      </VStack>
    </ScrollView>
  );
}
