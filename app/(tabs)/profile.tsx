import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View className="flex-1 bg-white px-6 pt-8">
      <Text className="text-xl font-semibold text-gray-800 mb-6">Profile</Text>
      <Text className="text-gray-500 mb-8">
        Avatar, name, and notification settings will go here.
      </Text>

      <TouchableOpacity
        className="bg-red-500 rounded-lg py-3 items-center"
        onPress={handleLogout}
      >
        <Text className="text-white font-semibold">Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}
