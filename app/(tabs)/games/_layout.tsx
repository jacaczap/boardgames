import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import AppHeader from "@/components/AppHeader";

export default function GamesLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: t("nav.boardGames"),
          header: () => (
            <AppHeader title={t("nav.boardGames")} showSwitcher />
          ),
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: t("nav.gameDetails"),
          header: () => <AppHeader showBack />,
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          title: t("nav.addGame"),
          header: () => <AppHeader showBack />,
        }}
      />
    </Stack>
  );
}
