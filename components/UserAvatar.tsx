import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import type { Profile } from "@/lib/types";
import {
  Avatar,
  AvatarImage,
  AvatarFallbackText,
} from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

function getInitials(profile: Profile): string {
  const first = profile.name?.[0];
  const last = profile.surname?.[0];
  if (first || last) return `${first ?? ""}${last ?? ""}`.toUpperCase();
  return "?";
}

function getDisplayName(profile: Profile): string {
  return [profile.name, profile.surname].filter(Boolean).join(" ") || "?";
}

interface UserAvatarProps {
  profile: Profile;
  avatarUrls: Map<string, string>;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showNameOnPress?: boolean;
}

const UserAvatar: React.FC<UserAvatarProps> = React.memo(
  ({ profile, avatarUrls, size = "sm", showNameOnPress = true }) => {
    const [visible, setVisible] = useState(false);

    const uri = profile.avatar_url
      ? avatarUrls.get(profile.avatar_url)
      : undefined;

    const onPress = useCallback(() => setVisible(true), []);
    const onDismiss = useCallback(() => setVisible(false), []);

    const avatar = (
      <Avatar size={size}>
        {uri ? (
          <AvatarImage source={{ uri, cacheKey: profile.avatar_url ?? undefined }} />
        ) : (
          <AvatarFallbackText>{getInitials(profile)}</AvatarFallbackText>
        )}
      </Avatar>
    );

    if (!showNameOnPress) return avatar;

    const displayName = getDisplayName(profile);

    return (
      <>
        <Pressable onPress={onPress} hitSlop={4}>
          {avatar}
        </Pressable>

        <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={onDismiss}
        >
          <Pressable style={styles.overlay} onPress={onDismiss}>
            <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
              <VStack space="sm" className="items-center">
                <Avatar size="xl">
                  {uri ? (
                    <AvatarImage source={{ uri, cacheKey: profile.avatar_url ?? undefined }} />
                  ) : (
                    <AvatarFallbackText>
                      {getInitials(profile)}
                    </AvatarFallbackText>
                  )}
                </Avatar>
                <Text size="lg" className="font-semibold text-stone-800">
                  {displayName}
                </Text>
              </VStack>
            </Pressable>
          </Pressable>
        </Modal>
      </>
    );
  },
);
UserAvatar.displayName = "UserAvatar";

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    minWidth: 200,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
});

export default UserAvatar;
