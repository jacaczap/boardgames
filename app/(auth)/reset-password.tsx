import React, { useEffect, useState } from "react";
import { ScrollView, KeyboardAvoidingView } from "react-native";
import { useRouter } from "expo-router";
import { showAlert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { Spinner } from "@/components/ui/spinner";
import { VStack } from "@/components/ui/vstack";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Input, InputField, InputSlot, InputIcon } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Ionicons } from "@expo/vector-icons";

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);

  // The recovery session is set by the deep-link handler in the root layout.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(!!data.session);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleUpdate = async () => {
    if (!password || !confirm) {
      showAlert(t("common.error"), t("auth.fillAllFields"));
      return;
    }
    if (password.length < 6) {
      showAlert(t("common.error"), t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      showAlert(t("common.error"), t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      showAlert(t("common.error"), error.message);
      return;
    }
    await supabase.auth.signOut();
    setLoading(false);
    showAlert(t("auth.resetTitle"), t("auth.passwordUpdated"));
    router.replace("/(auth)/login");
  };

  return (
    <KeyboardAvoidingView className="flex-1" behavior="padding">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="bg-stone-50"
      >
        <Box className="flex-1 justify-center px-8">
          <Heading size="2xl" className="text-center mb-4">
            {t("auth.resetTitle")}
          </Heading>

          {checking ? (
            <Center className="py-8">
              <Spinner />
            </Center>
          ) : !hasSession ? (
            <VStack space="lg">
              <Text className="text-center text-stone-600">
                {t("auth.resetSessionMissing")}
              </Text>
              <Button
                action="primary"
                size="lg"
                onPress={() => router.replace("/(auth)/forgot-password")}
                className="rounded-lg"
              >
                <ButtonText>{t("auth.sendResetLink")}</ButtonText>
              </Button>
            </VStack>
          ) : (
            <VStack space="md">
              <Text className="text-center text-stone-600 mb-2">
                {t("auth.resetDescription")}
              </Text>

              <Input variant="outline" className="rounded-lg">
                <InputField
                  placeholder={t("auth.password")}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoComplete="password-new"
                />
                <InputSlot
                  className="pr-3"
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <InputIcon
                    as={Ionicons}
                    name={showPassword ? "eye-off" : "eye"}
                  />
                </InputSlot>
              </Input>

              <Input variant="outline" className="rounded-lg">
                <InputField
                  placeholder={t("auth.confirmPassword")}
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoComplete="password-new"
                />
              </Input>

              <Button
                action="primary"
                size="lg"
                onPress={handleUpdate}
                isDisabled={loading}
                className="rounded-lg"
              >
                {loading ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText>{t("auth.updatePassword")}</ButtonText>
                )}
              </Button>

              <Pressable
                className="mt-2"
                onPress={() => router.replace("/(auth)/login")}
              >
                <Text className="text-center text-amber-700 font-medium">
                  {t("auth.backToLogin")}
                </Text>
              </Pressable>
            </VStack>
          )}
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
