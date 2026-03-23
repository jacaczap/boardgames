import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { setLanguagePreference } from "@/lib/i18n";
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
  const { t, i18n } = useTranslation();
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
      Alert.alert(t("profile.invalidTitle"), t("profile.daysBefore"));
      return;
    }
    if (isNaN(reminderInterval) || reminderInterval < 1) {
      Alert.alert(t("profile.invalidTitle"), t("profile.reminderInterval"));
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
        Alert.alert(t("common.error"), error.message);
        return;
      }
      Alert.alert(t("profile.savedTitle"), t("profile.savedMessage"));
      await fetchProfile();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("profile.failedSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async () => {
    if (!profile || uploadingAvatar) return;
    setUploadingAvatar(true);
    try {
      const oldPath = profile.avatar_url;
      const newPath = await pickAndUploadImage("avatars", `avatar_${profile.id}`, [1, 1]);
      if (!newPath) return;

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: newPath })
        .eq("id", profile.id);

      if (error) {
        Alert.alert(t("common.error"), error.message);
        await removeStorageFile("avatars", newPath);
        return;
      }

      if (oldPath) {
        await removeStorageFile("avatars", oldPath);
      }

      await fetchProfile();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("profile.failedSave"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert(t("common.error"), t("profile.passwordEmpty"));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t("common.error"), t("profile.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t("common.error"), t("profile.passwordMismatch"));
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        Alert.alert(t("common.error"), error.message);
        return;
      }
      Alert.alert(t("profile.successTitle"), t("profile.passwordChanged"));
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("profile.failedPassword"));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t("profile.logOut"), t("profile.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.logOut"),
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
              Alert.alert(t("common.error"), error.message);
            }
          } catch (e: any) {
            Alert.alert(t("common.error"), e?.message ?? t("profile.failedLogout"));
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Spinner />
      </Center>
    );
  }

  if (!profile) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Text className="text-stone-500">{t("profile.notFound")}</Text>
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
        className="flex-1 bg-stone-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <VStack space="xl">
          {/* Avatar */}
          <Center>
            <Pressable onPress={handleAvatarUpload} disabled={uploadingAvatar}>
              <Box className="relative">
                <Avatar size="xl">
                  {avatarUrl ? (
                    <AvatarImage source={{ uri: avatarUrl }} />
                  ) : (
                    <AvatarFallbackText>
                      {(name?.[0] ?? "").toUpperCase()}
                      {(surname?.[0] ?? "").toUpperCase()}
                    </AvatarFallbackText>
                  )}
                </Avatar>
                <Center className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-700">
                  {uploadingAvatar ? (
                    <Spinner size="small" color="white" />
                  ) : (
                    <Ionicons name="camera" size={16} color="white" />
                  )}
                </Center>
              </Box>
            </Pressable>
            {profile.username && (
              <Text className="text-stone-500 mt-2">@{profile.username}</Text>
            )}
          </Center>

          {/* Language Switcher */}
          <Card variant="outline" className="p-4">
            <VStack space="md">
              <HStack space="xs" className="items-center">
                <Ionicons name="language-outline" size={20} color="#78716c" />
                <Heading size="md">{t("profile.language")}</Heading>
              </HStack>
              <HStack space="sm">
                <Pressable
                  onPress={() => setLanguagePreference("en")}
                  className={`flex-1 py-3 rounded-lg items-center ${i18n.language === "en" ? "bg-amber-200 border-2 border-amber-600" : "bg-stone-100 border border-stone-200"}`}
                >
                  <Text className={`font-medium ${i18n.language === "en" ? "text-amber-700" : "text-stone-600"}`}>
                    {t("profile.languageEn")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setLanguagePreference("pl")}
                  className={`flex-1 py-3 rounded-lg items-center ${i18n.language === "pl" ? "bg-amber-200 border-2 border-amber-600" : "bg-stone-100 border border-stone-200"}`}
                >
                  <Text className={`font-medium ${i18n.language === "pl" ? "text-amber-700" : "text-stone-600"}`}>
                    {t("profile.languagePl")}
                  </Text>
                </Pressable>
              </HStack>
            </VStack>
          </Card>

          {/* Profile Info */}
          <Card variant="outline" className="p-4">
            <VStack space="md">
              <Heading size="md">{t("profile.heading")}</Heading>

              <VStack space="xs">
                <Text size="sm" className="text-stone-500 font-medium">{t("profile.name")}</Text>
                <Input>
                  <InputField
                    value={name}
                    onChangeText={setName}
                    placeholder={t("profile.firstNamePlaceholder")}
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="text-stone-500 font-medium">{t("profile.surname")}</Text>
                <Input>
                  <InputField
                    value={surname}
                    onChangeText={setSurname}
                    placeholder={t("profile.lastNamePlaceholder")}
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="text-stone-500 font-medium">{t("profile.username")}</Text>
                <Input>
                  <InputField
                    value={username}
                    onChangeText={setUsername}
                    placeholder={t("profile.usernamePlaceholder")}
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
                <Ionicons name="notifications-outline" size={20} color="#78716c" />
                <Heading size="md">{t("profile.notifications")}</Heading>
              </HStack>

              <VStack space="xs">
                <Text size="sm" className="text-stone-500 font-medium">
                  {t("profile.remindBeforeMeeting")}
                </Text>
                <Text size="xs" className="text-stone-400">
                  {t("profile.remindBeforeMeetingDesc")}
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
                <Text size="sm" className="text-stone-500 font-medium">
                  {t("profile.surveyReminderInterval")}
                </Text>
                <Text size="xs" className="text-stone-400">
                  {t("profile.surveyReminderIntervalDesc")}
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
              {saving ? t("common.saving") : t("common.saveChanges")}
            </ButtonText>
          </Button>

          {/* Change Password */}
          <Card variant="outline" className="p-4">
            <VStack space="md">
              <HStack space="xs" className="items-center">
                <Ionicons name="lock-closed-outline" size={20} color="#78716c" />
                <Heading size="md">{t("profile.changePassword")}</Heading>
              </HStack>

              <VStack space="xs">
                <Text size="sm" className="text-stone-500 font-medium">{t("profile.newPassword")}</Text>
                <Input>
                  <InputField
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    placeholder={t("profile.newPasswordPlaceholder")}
                    textContentType="newPassword"
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="text-stone-500 font-medium">{t("profile.confirmPassword")}</Text>
                <Input>
                  <InputField
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    placeholder={t("profile.confirmPasswordPlaceholder")}
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
                  {changingPassword ? t("profile.changingPassword") : t("profile.changePassword")}
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
            <ButtonText>{loggingOut ? t("profile.loggingOut") : t("profile.logOut")}</ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
