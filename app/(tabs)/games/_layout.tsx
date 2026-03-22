import { Stack } from "expo-router";

export default function GamesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Board Games" }} />
      <Stack.Screen name="[id]" options={{ title: "Game Details" }} />
      <Stack.Screen name="new" options={{ title: "Add Game" }} />
    </Stack>
  );
}
