import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { showAlert } from "@/lib/alert";
import { useSignedUrls } from "@/lib/storage";
import {
  listBlockedProfiles,
  useBlocks,
  type BlockedProfile,
} from "@/lib/moderation";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Center } from "@/components/ui/center";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Button, ButtonText } from "@/components/ui/button";
import {
  Avatar,
  AvatarImage,
  AvatarFallbackText,
} from "@/components/ui/avatar";

export default function BlockedUsersScreen() {
  const { t } = useTranslation();
  const { unblock } = useBlocks();
  const [blocked, setBlocked] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchBlocked = useCallback(async () => {
    try {
      setBlocked(await listBlockedProfiles());
      setError(false);
    } catch (e) {
      console.error("Failed to fetch blocked users:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBlocked();
    }, [fetchBlocked]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBlocked();
    setRefreshing(false);
  }, [fetchBlocked]);

  const avatarPaths = useMemo(
    () => blocked.map((b) => b.avatarUrl).filter((u): u is string => !!u),
    [blocked],
  );
  const avatarUrls = useSignedUrls("avatars", avatarPaths);

  const doUnblock = async (userId: string) => {
    setBusy(userId);
    try {
      await unblock(userId);
      await fetchBlocked();
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("moderation.unblockFailed"));
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

  if (error) {
    return (
      <Center className="flex-1 bg-stone-50 p-6">
        <VStack space="md" className="items-center">
          <Text className="text-stone-500 text-center">{t("common.loadError")}</Text>
          <Button
            variant="outline"
            action="secondary"
            onPress={() => {
              setLoading(true);
              fetchBlocked();
            }}
          >
            <ButtonText>{t("common.retry")}</ButtonText>
          </Button>
        </VStack>
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
          {t("moderation.blockedUsersDesc")}
        </Text>

        {blocked.length === 0 ? (
          <Center className="py-10">
            <Text className="text-stone-400">{t("moderation.noBlocked")}</Text>
          </Center>
        ) : (
          blocked.map((b) => {
            const displayName =
              [b.name, b.surname].filter(Boolean).join(" ") ||
              t("moderation.blockedUser");
            const initials =
              `${b.name?.[0] ?? ""}${b.surname?.[0] ?? ""}`.toUpperCase() || "?";
            const uri = b.avatarUrl ? avatarUrls.get(b.avatarUrl) : undefined;
            return (
              <Card key={b.userId} variant="outline" className="p-3">
                <HStack space="sm" className="items-center justify-between">
                  <HStack space="sm" className="items-center flex-1">
                    <Avatar size="md">
                      {uri ? (
                        <AvatarImage source={{ uri, cacheKey: b.avatarUrl ?? undefined }} />
                      ) : (
                        <AvatarFallbackText>{initials}</AvatarFallbackText>
                      )}
                    </Avatar>
                    <Text className="text-stone-800 flex-1" numberOfLines={1}>
                      {displayName}
                    </Text>
                  </HStack>
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    isDisabled={busy === b.userId}
                    onPress={() => doUnblock(b.userId)}
                  >
                    <ButtonText>{t("moderation.unblock")}</ButtonText>
                  </Button>
                </HStack>
              </Card>
            );
          })
        )}
      </VStack>
    </ScrollView>
  );
}
