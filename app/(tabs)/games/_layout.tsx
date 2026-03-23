import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function GamesLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#4a3228" },
        headerTintColor: "#fef3c7",
        headerTitleStyle: { color: "#fef3c7" },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("nav.boardGames") }} />
      <Stack.Screen name="[id]" options={{ title: t("nav.gameDetails") }} />
      <Stack.Screen name="new" options={{ title: t("nav.addGame") }} />
    </Stack>
  );
}
