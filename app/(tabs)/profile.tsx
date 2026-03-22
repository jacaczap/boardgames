import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { clearPushToken } from "@/lib/notifications";
import { useSignedUrl, pickAndUploadImage, removeStorageFile } from "@/lib/storage";
import type { Profile } from "@/lib/types";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Center } from "@/components/ui/center";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input, InputField } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import {
  Avatar,
  AvatarImage,
  AvatarFallbackText,
} from "@/components/ui/avatar";

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [username, setUsername] = useState("");
  const [notifPriorMeeting, setNotifPriorMeeting] = useState("1");
  const [notifReminderInterval, setNotifReminderInterval] = useState("2");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const avatarUrl = useSignedUrl("avatars", profile?.avatar_url);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Failed to fetch profile:", error.message);
        return;
      }

      const p = data as Profile;
      setProfile(p);
      setName(p.name ?? "");
      setSurname(p.surname ?? "");
      setUsername(p.username ?? "");
      setNotifPriorMeeting(String(p.notification_prior_meeting));
      setNotifReminderInterval(String(p.notification_reminder_interval));
    } catch (e) {
      console.error("Failed to fetch profile:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );

  const handleSave = async () => {
    if (!profile) return;

    const priorMeeting = parseInt(notifPriorMeeting, 10);
    const reminderInterval = parseInt(notifReminderInterval, 10);

    if (isNaN(priorMeeting) || priorMeeting < 0) {
      Alert.alert("Invalid", "Days before meeting must be 0 or more");
      return;
    }
    if (isNaN(reminderInterval) || reminderInterval < 1) {
      Alert.alert("Invalid", "Reminder interval must be at least 1 day");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim() || null,
          surname: surname.trim() || null,
          username: username.trim() || null,
          notification_prior_meeting: priorMeeting,
          notification_reminder_interval: reminderInterval,
        })
        .eq("id", profile.id);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      Alert.alert("Saved", "Profile updated successfully");
      await fetchProfile();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async () => {
    if (!profile || uploadingAvatar) return;
    setUploadingAvatar(true);
    try {
      const oldPath = profile.avatar_url;
      const newPath = await pickAndUploadImage("avatars", `avatar_${profile.id}`);
      if (!newPath) return;

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: newPath })
        .eq("id", profile.id);

      if (error) {
        Alert.alert("Error", error.message);
        await removeStorageFile("avatars", newPath);
        return;
      }

      if (oldPath) {
        await removeStorageFile("avatars", oldPath);
      }

      await fetchProfile();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert("Error", "Password cannot be empty");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      Alert.alert("Success", "Password changed");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            if (Platform.OS !== "web") {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                await clearPushToken(session.user.id);
              }
            }
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert("Error", error.message);
            }
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to log out");
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-white">
        <Spinner />
      </Center>
    );
  }

  if (!profile) {
    return (
      <Center className="flex-1 bg-white">
        <Text className="text-gray-500">Profile not found</Text>
      </Center>
    );
  }

  const hasChanges =
    name !== (profile.name ?? "") ||
    surname !== (profile.surname ?? "") ||
    username !== (profile.username ?? "") ||
    notifPriorMeeting !== String(profile.notification_prior_meeting) ||
    notifReminderInterval !== String(profile.notification_reminder_interval);

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <VStack space="xl">
          {/* Avatar */}
          <Center>
            <Pressable onPress={handleAvatarUpload} disabled={uploadingAvatar}>
              <Box className="relative">
                <Avatar size="2xl">
                  {avatarUrl ? (
                    <AvatarImage source={{ uri: avatarUrl }} />
                  ) : (
                    <AvatarFallbackText>
                      {(name?.[0] ?? "").toUpperCase()}
                      {(surname?.[0] ?? "").toUpperCase()}
                    </AvatarFallbackText>
                  )}
                </Avatar>
                <Center className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600">
                  {uploadingAvatar ? (
                    <Spinner size="small" color="white" />
                  ) : (
                    <Ionicons name="camera" size={16} color="white" />
                  )}
                </Center>
              </Box>
            </Pressable>
            {profile.username && (
              <Text className="text-gray-500 mt-2">@{profile.username}</Text>
            )}
          </Center>

          {/* Profile Info */}
          <Card variant="outline" className="p-4">
            <VStack space="md">
              <Heading size="md">Profile</Heading>

              <VStack space="xs">
                <Text size="sm" className="text-gray-500 font-medium">Name</Text>
                <Input>
                  <InputField
                    value={name}
                    onChangeText={setName}
                    placeholder="First name"
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="text-gray-500 font-medium">Surname</Text>
                <Input>
                  <InputField
                    value={surname}
                    onChangeText={setSurname}
                    placeholder="Last name"
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="text-gray-500 font-medium">Username</Text>
                <Input>
                  <InputField
                    value={username}
                    onChangeText={setUsername}
                    placeholder="username"
                    autoCapitalize="none"
                  />
                </Input>
              </VStack>
            </VStack>
          </Card>

          {/* Notification Settings */}
          <Card variant="outline" className="p-4">
            <VStack space="md">
              <HStack space="xs" className="items-center">
                <Ionicons name="notifications-outline" size={20} color="#6b7280" />
                <Heading size="md">Notifications</Heading>
              </HStack>

              <VStack space="xs">
                <Text size="sm" className="text-gray-500 font-medium">
                  Remind me before meeting (days)
                </Text>
                <Text size="xs" className="text-gray-400">
                  Get a push notification this many days before an approved meeting
                </Text>
                <Input>
                  <InputField
                    value={notifPriorMeeting}
                    onChangeText={setNotifPriorMeeting}
                    keyboardType="number-pad"
                    placeholder="1"
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="text-gray-500 font-medium">
                  Survey reminder interval (days)
                </Text>
                <Text size="xs" className="text-gray-400">
                  If you haven't voted, get reminded every this many days
                </Text>
                <Input>
                  <InputField
                    value={notifReminderInterval}
                    onChangeText={setNotifReminderInterval}
                    keyboardType="number-pad"
                    placeholder="2"
                  />
                </Input>
              </VStack>
            </VStack>
          </Card>

          {/* Save Button */}
          <Button
            action="primary"
            size="lg"
            isDisabled={saving || !hasChanges}
            onPress={handleSave}
          >
            <ButtonText>
              {saving ? "Saving..." : "Save Changes"}
            </ButtonText>
          </Button>

          {/* Change Password */}
          <Card variant="outline" className="p-4">
            <VStack space="md">
              <HStack space="xs" className="items-center">
                <Ionicons name="lock-closed-outline" size={20} color="#6b7280" />
                <Heading size="md">Change Password</Heading>
              </HStack>

              <VStack space="xs">
                <Text size="sm" className="text-gray-500 font-medium">New password</Text>
                <Input>
                  <InputField
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    placeholder="Min. 6 characters"
                    textContentType="newPassword"
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="text-gray-500 font-medium">Confirm password</Text>
                <Input>
                  <InputField
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    placeholder="Re-enter password"
                    textContentType="newPassword"
                  />
                </Input>
              </VStack>

              <Button
                action="primary"
                variant="outline"
                isDisabled={changingPassword || !newPassword}
                onPress={handleChangePassword}
              >
                <ButtonText>
                  {changingPassword ? "Changing..." : "Change Password"}
                </ButtonText>
              </Button>
            </VStack>
          </Card>

          {/* Logout */}
          <Button
            action="negative"
            isDisabled={loggingOut}
            onPress={handleLogout}
          >
            <ButtonText>{loggingOut ? "Logging out..." : "Log Out"}</ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
