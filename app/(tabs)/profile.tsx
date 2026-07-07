import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { showAlert } from "@/lib/alert";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { setLanguagePreference } from "@/lib/i18n";
import { clearPushToken } from "@/lib/notifications";
import { deleteAccount, AdminOfGroupError } from "@/lib/account";
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
import { Input, InputField, InputSlot, InputIcon } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import {
  Avatar,
  AvatarImage,
  AvatarFallbackText,
} from "@/components/ui/avatar";

const SUPPORT_EMAIL = "jacaczap@gmail.com";
const PRIVACY_URL = "https://jacaczap.github.io/boardgames/privacy/";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-wide text-stone-400 px-1 -mb-2">
      {children}
    </Text>
  );
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [notifPriorMeeting, setNotifPriorMeeting] = useState("1");
  const [notifReminderInterval, setNotifReminderInterval] = useState("2");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const avatarUrl = useSignedUrl("avatars", profile?.avatar_url);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile]);

  const handleSavePersonal = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim() || null,
          surname: surname.trim() || null,
        })
        .eq("id", profile.id);

      if (error) {
        showAlert(t("common.error"), error.message);
        return;
      }
      showAlert(t("profile.savedTitle"), t("profile.savedMessage"));
      await fetchProfile();
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("profile.failedSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!profile) return;

    const priorMeeting = parseInt(notifPriorMeeting, 10);
    const reminderInterval = parseInt(notifReminderInterval, 10);

    if (isNaN(priorMeeting) || priorMeeting < 0) {
      showAlert(t("profile.invalidTitle"), t("profile.daysBefore"));
      return;
    }
    if (isNaN(reminderInterval) || reminderInterval < 1) {
      showAlert(t("profile.invalidTitle"), t("profile.reminderInterval"));
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          notification_prior_meeting: priorMeeting,
          notification_reminder_interval: reminderInterval,
        })
        .eq("id", profile.id);

      if (error) {
        showAlert(t("common.error"), error.message);
        return;
      }
      showAlert(t("profile.savedTitle"), t("profile.savedMessage"));
      await fetchProfile();
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("profile.failedSave"));
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
        showAlert(t("common.error"), error.message);
        await removeStorageFile("avatars", newPath);
        return;
      }

      if (oldPath) {
        await removeStorageFile("avatars", oldPath);
      }

      await fetchProfile();
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("profile.failedSave"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      showAlert(t("common.error"), t("profile.passwordEmpty"));
      return;
    }
    if (newPassword.length < 6) {
      showAlert(t("common.error"), t("profile.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert(t("common.error"), t("profile.passwordMismatch"));
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showAlert(t("common.error"), error.message);
        return;
      }
      showAlert(t("profile.successTitle"), t("profile.passwordChanged"));
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("profile.failedPassword"));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    showAlert(t("profile.logOut"), t("profile.logoutConfirm"), [
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
              showAlert(t("common.error"), error.message);
            }
          } catch (e: any) {
            showAlert(t("common.error"), e?.message ?? t("profile.failedLogout"));
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    showAlert(t("profile.deleteConfirmTitle"), t("profile.deleteConfirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.deleteAccount"),
        style: "destructive",
        onPress: async () => {
          setDeletingAccount(true);
          try {
            if (Platform.OS !== "web" && profile) {
              await clearPushToken(profile.id);
            }
            await deleteAccount();
          } catch (e: any) {
            setDeletingAccount(false);
            if (e instanceof AdminOfGroupError) {
              showAlert(
                t("profile.cannotDeleteAdminTitle"),
                t("profile.cannotDeleteAdminMessage"),
              );
              return;
            }
            showAlert(t("common.error"), e?.message ?? t("profile.failedDelete"));
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
      <Center className="flex-1 bg-stone-50 p-6">
        <VStack space="md" className="items-center">
          <Text className="text-stone-500 text-center">{t("profile.notFound")}</Text>
          <Button
            variant="outline"
            action="secondary"
            onPress={() => {
              setLoading(true);
              fetchProfile();
            }}
          >
            <ButtonText>{t("common.retry")}</ButtonText>
          </Button>
          <Button action="negative" variant="outline" onPress={handleLogout}>
            <ButtonText>{t("profile.logOut")}</ButtonText>
          </Button>
        </VStack>
      </Center>
    );
  }

  const personalChanged =
    name !== (profile.name ?? "") || surname !== (profile.surname ?? "");
  const notifChanged =
    notifPriorMeeting !== String(profile.notification_prior_meeting) ||
    notifReminderInterval !== String(profile.notification_reminder_interval);

  const fullName = [name, surname].filter(Boolean).join(" ").trim();

  return (
    <KeyboardAvoidingView className="flex-1" behavior="padding">
      <ScrollView
        className="flex-1 bg-stone-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <VStack space="xl">
          {/* Identity header */}
          <Center className="pt-2 pb-1">
            <Pressable onPress={handleAvatarUpload} disabled={uploadingAvatar}>
              <Box className="relative">
                <Avatar size="xl" className="w-24 h-24">
                  {avatarUrl ? (
                    <AvatarImage source={{ uri: avatarUrl, cacheKey: profile?.avatar_url ?? undefined }} />
                  ) : (
                    <AvatarFallbackText>
                      {(name?.[0] ?? "").toUpperCase()}
                      {(surname?.[0] ?? "").toUpperCase()}
                    </AvatarFallbackText>
                  )}
                </Avatar>
                <Center className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-amber-700 border-2 border-stone-50">
                  {uploadingAvatar ? (
                    <Spinner size="small" color="white" />
                  ) : (
                    <Ionicons name="camera" size={16} color="white" />
                  )}
                </Center>
              </Box>
            </Pressable>
            {fullName ? (
              <Heading size="lg" className="mt-3 text-stone-800">
                {fullName}
              </Heading>
            ) : null}
            {email ? (
              <Text size="sm" className="text-stone-500 mt-0.5">
                {email}
              </Text>
            ) : null}
          </Center>

          {/* Personal info */}
          <SectionLabel>{t("profile.personalInfo")}</SectionLabel>
          <Card variant="outline" className="p-4">
            <VStack space="md">
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

              <Button
                action="primary"
                isDisabled={saving || !personalChanged}
                onPress={handleSavePersonal}
              >
                <ButtonText>
                  {saving ? t("common.saving") : t("common.saveChanges")}
                </ButtonText>
              </Button>
            </VStack>
          </Card>

          {/* Preferences */}
          <SectionLabel>{t("profile.preferences")}</SectionLabel>
          <Card variant="outline" className="p-4">
            <VStack space="md">
              <HStack space="xs" className="items-center">
                <Ionicons name="language-outline" size={20} color="#78716c" />
                <Heading size="sm">{t("profile.language")}</Heading>
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

          <Card variant="outline" className="p-4">
            <VStack space="md">
              <HStack space="xs" className="items-center">
                <Ionicons name="notifications-outline" size={20} color="#78716c" />
                <Heading size="sm">{t("profile.notifications")}</Heading>
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

              <Button
                action="primary"
                isDisabled={saving || !notifChanged}
                onPress={handleSaveNotifications}
              >
                <ButtonText>
                  {saving ? t("common.saving") : t("common.saveChanges")}
                </ButtonText>
              </Button>
            </VStack>
          </Card>

          {/* Security */}
          <SectionLabel>{t("profile.security")}</SectionLabel>
          <Card variant="outline" className="p-4">
            <VStack space="md">
              <VStack space="xs">
                <Text size="sm" className="text-stone-500 font-medium">{t("profile.newPassword")}</Text>
                <Input>
                  <InputField
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    placeholder={t("profile.newPasswordPlaceholder")}
                    textContentType="newPassword"
                  />
                  <InputSlot className="pr-3" onPress={() => setShowNewPassword((v) => !v)}>
                    <InputIcon as={Ionicons} name={showNewPassword ? "eye-off" : "eye"} />
                  </InputSlot>
                </Input>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="text-stone-500 font-medium">{t("profile.confirmPassword")}</Text>
                <Input>
                  <InputField
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    placeholder={t("profile.confirmPasswordPlaceholder")}
                    textContentType="newPassword"
                  />
                  <InputSlot className="pr-3" onPress={() => setShowConfirmPassword((v) => !v)}>
                    <InputIcon as={Ionicons} name={showConfirmPassword ? "eye-off" : "eye"} />
                  </InputSlot>
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

          {/* Support */}
          <SectionLabel>{t("support.title")}</SectionLabel>
          <Card variant="outline" className="p-2">
            <VStack>
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                      t("auth.appName"),
                    )}`,
                  ).catch(() => {})
                }
                className="px-3 py-3 rounded-lg"
              >
                <HStack space="sm" className="items-center justify-between">
                  <HStack space="sm" className="items-center">
                    <Ionicons name="mail-outline" size={20} color="#78716c" />
                    <Text className="text-stone-700">{t("support.contact")}</Text>
                  </HStack>
                  <Ionicons name="chevron-forward" size={18} color="#a8a29e" />
                </HStack>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
                className="px-3 py-3 rounded-lg"
              >
                <HStack space="sm" className="items-center justify-between">
                  <HStack space="sm" className="items-center">
                    <Ionicons name="shield-checkmark-outline" size={20} color="#78716c" />
                    <Text className="text-stone-700">{t("support.privacyPolicy")}</Text>
                  </HStack>
                  <Ionicons name="chevron-forward" size={18} color="#a8a29e" />
                </HStack>
              </Pressable>
              <Pressable onPress={() => router.push("/blocked")} className="px-3 py-3 rounded-lg">
                <HStack space="sm" className="items-center justify-between">
                  <HStack space="sm" className="items-center">
                    <Ionicons name="ban-outline" size={20} color="#78716c" />
                    <Text className="text-stone-700">
                      {t("moderation.blockedUsersTitle")}
                    </Text>
                  </HStack>
                  <Ionicons name="chevron-forward" size={18} color="#a8a29e" />
                </HStack>
              </Pressable>
            </VStack>
          </Card>

          {/* Account */}
          <SectionLabel>{t("profile.account")}</SectionLabel>
          <Card variant="outline" className="p-2">
            <Pressable
              onPress={handleDeleteAccount}
              disabled={deletingAccount}
              className="px-3 py-3 rounded-lg"
            >
              <HStack space="sm" className="items-center justify-between">
                <HStack space="sm" className="items-center">
                  <Ionicons name="trash-outline" size={20} color="#b91c1c" />
                  <Text className="text-red-700">
                    {deletingAccount ? t("profile.deleting") : t("profile.deleteAccount")}
                  </Text>
                </HStack>
                <Ionicons name="chevron-forward" size={18} color="#fca5a5" />
              </HStack>
            </Pressable>
          </Card>

          {/* Logout at the bottom */}
          <Button
            action="secondary"
            variant="outline"
            size="lg"
            isDisabled={loggingOut}
            onPress={handleLogout}
          >
            <ButtonText>
              {loggingOut ? t("profile.loggingOut") : t("profile.logOut")}
            </ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
