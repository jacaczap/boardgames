import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "@/components/AppHeader";
import { useIsTablet } from "@/lib/responsive";

export default function TabLayout() {
  const { t } = useTranslation();
  const isTablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const iconSize = isTablet ? 30 : 24;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#f59e0b",
        tabBarInactiveTintColor: "#a8a29e",
        tabBarStyle: {
          backgroundColor: "#3d2818",
          borderTopColor: "#553720",
          ...(isTablet
            ? {
                height: 72 + insets.bottom,
                paddingTop: 10,
                paddingBottom: 10 + insets.bottom,
              }
            : {}),
        },
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: isTablet ? { fontSize: 14 } : undefined,
        tabBarIconStyle: isTablet ? { marginTop: 2 } : undefined,
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.meetings"),
          header: () => <AppHeader title={t("nav.meetings")} showSwitcher />,
          tabBarIcon: ({ color }) => (
            <Ionicons name="home-outline" size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: t("nav.games"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="game-controller-outline" size={iconSize} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate("games", { screen: "index" });
          },
        })}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          header: () => <AppHeader title={t("nav.profile")} showSwitcher />,
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={iconSize} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
