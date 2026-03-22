import React from "react";
import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-xl font-semibold text-gray-800 mb-2">
        No upcoming meetings
      </Text>
      <Text className="text-gray-500 text-center">
        When a survey or approved meeting exists, it will appear here.
      </Text>
    </View>
  );
}
