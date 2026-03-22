import React from "react";
import { Alert, Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { clearPushToken } from "@/lib/notifications";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText } from "@/components/ui/button";

export default function ProfileScreen() {
  const handleLogout = async () => {
    if (Platform.OS !== "web") {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await clearPushToken(session.user.id);
      }
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <Box className="flex-1 bg-white px-6 pt-8">
      <VStack space="md">
        <Heading size="xl">Profile</Heading>
        <Text className="text-gray-500">
          Avatar, name, and notification settings will go here.
        </Text>

        <Button
          action="negative"
          onPress={handleLogout}
          className="mt-4"
        >
          <ButtonText>Log Out</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
}
