import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useGroup } from "@/lib/groupContext";
import { useSignedUrls } from "@/lib/storage";
import {
  listMembers,
  updateMemberRole,
  removeMember,
  type GroupMember,
  type GroupRole,
} from "@/lib/groups";
import type { Profile } from "@/lib/types";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Center } from "@/components/ui/center";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Pressable } from "@/components/ui/pressable";
import UserAvatar from "@/components/UserAvatar";
import ReportDialog from "@/components/ReportDialog";
import { useBlocks } from "@/lib/moderation";

const ROLES: GroupRole[] = ["admin", "approver", "member"];

export default function GroupMembersScreen() {
  const { t } = useTranslation();
  const { currentGroupId, currentGroup, refresh } = useGroup();
  const { isBlocked, block, unblock } = useBlocks();
  const isAdmin = currentGroup?.role === "admin";

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [reportUserId, setReportUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!currentGroupId) return;
    try {
      setMembers(await listMembers(currentGroupId));
    } catch (e) {
      console.error("Failed to fetch members:", e);
    } finally {
      setLoading(false);
    }
  }, [currentGroupId]);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
    }, [fetchMembers]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  }, [fetchMembers]);

  const avatarPaths = useMemo(
    () => members.map((m) => m.avatarUrl).filter((u): u is string => !!u),
    [members],
  );
  const avatarUrls = useSignedUrls("avatars", avatarPaths);

  const adminCount = members.filter((m) => m.role === "admin").length;

  const changeRole = async (member: GroupMember, role: GroupRole) => {
    if (!currentGroupId || member.role === role) return;
    if (member.role === "admin" && role !== "admin" && adminCount <= 1) {
      showAlert(t("common.error"), t("groups.lastAdmin"));
      return;
    }
    setBusyUser(member.userId);
    try {
      await updateMemberRole(currentGroupId, member.userId, role);
      await fetchMembers();
      if (member.userId === userId) await refresh();
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("groups.roleFailed"));
    } finally {
      setBusyUser(null);
    }
  };

  const doRemove = async (member: GroupMember) => {
    if (!currentGroupId) return;
    setBusyUser(member.userId);
    try {
      await removeMember(currentGroupId, member.userId);
      await fetchMembers();
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("groups.removeFailed"));
    } finally {
      setBusyUser(null);
    }
  };

  const confirmRemove = (member: GroupMember) => {
    const name = [member.name, member.surname].filter(Boolean).join(" ") || "?";
    showAlert(t("groups.removeTitle"), t("groups.removeConfirm", { name }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => doRemove(member) },
    ]);
  };

  const toggleBlock = (member: GroupMember) => {
    if (isBlocked(member.userId)) {
      unblock(member.userId).catch((e: any) =>
        showAlert(t("common.error"), e?.message ?? t("moderation.unblockFailed")),
      );
      return;
    }
    const name = [member.name, member.surname].filter(Boolean).join(" ") || "?";
    showAlert(t("moderation.blockTitle", { name }), t("moderation.blockConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("moderation.block"),
        style: "destructive",
        onPress: () =>
          block(member.userId).catch((e: any) =>
            showAlert(t("common.error"), e?.message ?? t("moderation.blockFailed")),
          ),
      },
    ]);
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Spinner />
      </Center>
    );
  }

  return (
    <>
    {currentGroupId && reportUserId && (
      <ReportDialog
        visible
        onClose={() => setReportUserId(null)}
        groupId={currentGroupId}
        contentType="profile"
        contentId={reportUserId}
      />
    )}
    <ScrollView
      className="flex-1 bg-stone-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <VStack space="md">
        {members.map((member) => {
          const isSelf = member.userId === userId;
          const profile = {
            id: member.userId,
            name: member.name,
            surname: member.surname,
            avatar_url: member.avatarUrl,
          } as Profile;
          const displayName =
            [member.name, member.surname].filter(Boolean).join(" ") || "?";

          return (
            <Card key={member.userId} variant="outline" className="p-3">
              <VStack space="sm">
                <HStack space="sm" className="items-center justify-between">
                  <HStack space="sm" className="items-center flex-1">
                    <UserAvatar profile={profile} avatarUrls={avatarUrls} size="md" />
                    <VStack className="flex-1">
                      <Text className="font-medium text-stone-800" numberOfLines={1}>
                        {displayName}
                        {isSelf ? ` (${t("groups.you")})` : ""}
                      </Text>
                      <Text size="xs" className="text-stone-400">
                        {t(`groups.role.${member.role}`)}
                      </Text>
                    </VStack>
                  </HStack>
                  {!isSelf && (
                    <HStack space="md" className="items-center">
                      <Pressable
                        onPress={() => setReportUserId(member.userId)}
                        hitSlop={8}
                      >
                        <Ionicons name="flag-outline" size={20} color="#a8a29e" />
                      </Pressable>
                      <Pressable onPress={() => toggleBlock(member)} hitSlop={8}>
                        <Ionicons
                          name={isBlocked(member.userId) ? "ban" : "ban-outline"}
                          size={20}
                          color={isBlocked(member.userId) ? "#b45309" : "#a8a29e"}
                        />
                      </Pressable>
                      {isAdmin && (
                        <Pressable
                          onPress={() => confirmRemove(member)}
                          disabled={busyUser === member.userId}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={20} color="#b91c1c" />
                        </Pressable>
                      )}
                    </HStack>
                  )}
                </HStack>

                {isAdmin && (
                  <HStack space="xs">
                    {ROLES.map((role) => {
                      const active = member.role === role;
                      return (
                        <Pressable
                          key={role}
                          onPress={() => changeRole(member, role)}
                          disabled={busyUser === member.userId}
                          className={`flex-1 py-2 rounded-lg items-center ${
                            active
                              ? "bg-amber-200 border-2 border-amber-600"
                              : "bg-stone-100 border border-stone-200"
                          }`}
                        >
                          <Text
                            size="xs"
                            className={active ? "text-amber-700 font-medium" : "text-stone-600"}
                          >
                            {t(`groups.role.${role}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </HStack>
                )}
              </VStack>
            </Card>
          );
        })}
      </VStack>
    </ScrollView>
    </>
  );
}
