import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useGroup } from "@/lib/groupContext";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

// Header-right control: shows the current group and opens a dropdown to switch
// between memberships or jump into group management.
export default function GroupSwitcher() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentGroup, currentGroupId, groups, setCurrentGroup } = useGroup();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const go = (path: string) => {
    close();
    router.push(path);
  };

  const select = (groupId: string) => {
    setCurrentGroup(groupId);
    close();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ marginRight: 12, maxWidth: 180 }}
        hitSlop={8}
      >
        <HStack space="xs" className="items-center">
          <Ionicons name="people" size={18} color="#fef3c7" />
          <Text
            className="text-amber-100 font-medium"
            numberOfLines={1}
            style={{ maxWidth: 120 }}
          >
            {currentGroup?.groupName ?? t("groups.noGroup")}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#fef3c7" />
        </HStack>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={{ paddingVertical: 2 }}
              showsVerticalScrollIndicator={false}
            >
            <VStack space="xs">
              <Text size="xs" className="text-stone-400 uppercase tracking-wide px-3 pt-1">
                {t("groups.yourGroups")}
              </Text>

              {groups.map((g) => {
                const active = g.groupId === currentGroupId;
                return (
                  <Pressable
                    key={g.groupId}
                    onPress={() => select(g.groupId)}
                    className={`rounded-lg px-3 py-3 ${active ? "bg-amber-100" : ""}`}
                  >
                    <HStack space="sm" className="items-center justify-between">
                      <VStack className="flex-1">
                        <Text
                          className={active ? "text-amber-800 font-semibold" : "text-stone-800"}
                          numberOfLines={1}
                        >
                          {g.groupName}
                        </Text>
                        <Text size="xs" className="text-stone-400">
                          {t(`groups.role.${g.role}`)}
                        </Text>
                      </VStack>
                      {active && (
                        <Ionicons name="checkmark-circle" size={20} color="#b45309" />
                      )}
                    </HStack>
                  </Pressable>
                );
              })}

              <View style={styles.divider} />

              {currentGroupId && (
                <Pressable
                  onPress={() => go("/group/settings")}
                  className="rounded-lg px-3 py-3"
                >
                  <HStack space="sm" className="items-center">
                    <Ionicons name="settings-outline" size={18} color="#78716c" />
                    <Text className="text-stone-700">{t("groups.manage")}</Text>
                  </HStack>
                </Pressable>
              )}

              <Pressable
                onPress={() => go("/group/create")}
                className="rounded-lg px-3 py-3"
              >
                <HStack space="sm" className="items-center">
                  <Ionicons name="add-circle-outline" size={18} color="#78716c" />
                  <Text className="text-stone-700">{t("groups.createNew")}</Text>
                </HStack>
              </Pressable>

              <Pressable
                onPress={() => go("/group/join")}
                className="rounded-lg px-3 py-3"
              >
                <HStack space="sm" className="items-center">
                  <Ionicons name="enter-outline" size={18} color="#78716c" />
                  <Text className="text-stone-700">{t("groups.joinAnother")}</Text>
                </HStack>
              </Pressable>
            </VStack>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "flex-end",
    paddingTop: 64,
    paddingHorizontal: 12,
  },
  sheet: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 8,
    width: "80%",
    maxWidth: 320,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  divider: {
    height: 1,
    backgroundColor: "#e7e5e4",
    marginVertical: 4,
  },
});
