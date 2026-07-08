import React, { useState } from "react";
import { ScrollView, KeyboardAvoidingView } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { showAlert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Input, InputField, InputSlot, InputIcon } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Ionicons } from "@expo/vector-icons";

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !confirm) {
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
    const { error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { emailRedirectTo: Linking.createURL("login") },
    });
    setLoading(false);

    if (error) {
      showAlert(t("auth.registerFailed"), error.message);
      return;
    }

    router.replace({
      pathname: "/(auth)/verify-email",
      params: { email: trimmedEmail },
    });
  };

  return (
    <KeyboardAvoidingView className="flex-1" behavior="padding">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="bg-stone-50"
      >
        <Box className="flex-1 justify-center px-8">
          <Heading size="3xl" className="text-center mb-8">
            {t("auth.createAccount")}
          </Heading>

          <VStack space="md">
            <Input variant="outline" className="rounded-lg">
              <InputField
                placeholder={t("auth.email")}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                importantForAutofill="yes"
              />
            </Input>

            <Input variant="outline" className="rounded-lg">
              <InputField
                placeholder={t("auth.password")}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="password-new"
              />
              <InputSlot className="pr-3" onPress={() => setShowPassword((v) => !v)}>
                <InputIcon as={Ionicons} name={showPassword ? "eye-off" : "eye"} />
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
              onPress={handleRegister}
              isDisabled={loading}
              className="rounded-lg"
            >
              {loading ? (
                <ButtonSpinner />
              ) : (
                <ButtonText>{t("auth.signUp")}</ButtonText>
              )}
            </Button>

            <HStack space="xs" className="justify-center mt-2">
              <Text className="text-stone-500">{t("auth.haveAccount")}</Text>
              <Pressable onPress={() => router.replace("/(auth)/login")}>
                <Text className="text-amber-700 font-medium">
                  {t("auth.logIn")}
                </Text>
              </Pressable>
            </HStack>
          </VStack>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
