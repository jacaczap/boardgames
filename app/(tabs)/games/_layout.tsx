import { Stack, useRouter } from "expo-router";
import { Platform, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

function HeaderBack() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} style={{ marginRight: 8 }}>
      <Ionicons name="arrow-back" size={24} color="#fef3c7" />
    </Pressable>
  );
}

export default function GamesLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#4a3228" },
        headerTintColor: "#fef3c7",
        headerTitleStyle: { color: "#fef3c7" },
        ...(Platform.OS === "web" && { headerLeft: () => <HeaderBack /> }),
      }}
    >
      <Stack.Screen name="index" options={{ title: t("nav.boardGames"), headerLeft: () => null }} />
      <Stack.Screen name="[id]" options={{ title: t("nav.gameDetails") }} />
      <Stack.Screen name="new" options={{ title: t("nav.addGame") }} />
    </Stack>
  );
}
