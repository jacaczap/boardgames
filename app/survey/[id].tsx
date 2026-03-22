import React from "react";
import { useLocalSearchParams } from "expo-router";

import { Center } from "@/components/ui/center";
import { Text } from "@/components/ui/text";

export default function SurveyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Center className="flex-1 bg-white">
      <Text className="text-gray-500">Survey voting for meeting: {id}</Text>
    </Center>
  );
}
