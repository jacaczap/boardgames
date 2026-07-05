import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import GroupSwitcher from "@/components/GroupSwitcher";

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#f59e0b",
        tabBarInactiveTintColor: "#a8a29e",
        tabBarStyle: {
          backgroundColor: "#3d2818",
          borderTopColor: "#553720",
        },
        headerShown: true,
        headerStyle: { backgroundColor: "#4a3228" },
        headerTintColor: "#fef3c7",
        headerTitleStyle: { color: "#fef3c7" },
        headerRight: () => <GroupSwitcher />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Spotkania",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: t("nav.games"),
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="game-controller-outline" size={size} color={color} />
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
