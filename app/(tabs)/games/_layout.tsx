import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function GamesLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t("nav.boardGames") }} />
      <Stack.Screen name="[id]" options={{ title: t("nav.gameDetails") }} />
      <Stack.Screen name="new" options={{ title: t("nav.addGame") }} />
    </Stack>
  );
}
