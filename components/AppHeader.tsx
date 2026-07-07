import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GroupSwitcher from "@/components/GroupSwitcher";

const BAR_BG = "#4a3228";
const TINT = "#fef3c7";
const CONTENT_HEIGHT = 56;

type AppHeaderProps = {
  title?: string;
  showBack?: boolean;
  showSwitcher?: boolean;
};

// Single JS header used by every navigator (tabs + stacks) so the bar is
// pixel-identical everywhere and no native/JS swap flickers on navigation.
export default function AppHeader({
  title,
  showBack,
  showSwitcher,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.side}>
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={styles.back}
            >
              <Ionicons name="arrow-back" size={24} color={TINT} />
            </Pressable>
          ) : title ? (
            <Text
              style={styles.title}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {title}
            </Text>
          ) : null}
        </View>

        <View style={styles.center} pointerEvents="none">
          <Text style={styles.mark} allowFontScaling={false}>
            <Text style={styles.markSide}>V</Text>
            <Text style={styles.markMid}>n</Text>
            <Text style={styles.markSide}>M</Text>
          </Text>
        </View>

        <View style={[styles.side, styles.sideRight]}>
          {showSwitcher ? <GroupSwitcher /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: BAR_BG,
  },
  content: {
    height: CONTENT_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  side: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 56,
    flexShrink: 1,
  },
  sideRight: {
    justifyContent: "flex-end",
  },
  back: {
    paddingHorizontal: 12,
  },
  title: {
    color: TINT,
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 16,
    maxWidth: 150,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  markSide: {
    color: TINT,
    fontWeight: "800",
  },
  markMid: {
    color: "#f59e0b",
    fontWeight: "800",
  },
});
