import React, { useState } from "react";
import { ScrollView, KeyboardAvoidingView } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { showAlert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      showAlert(t("common.error"), t("auth.emailRequired"));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: Linking.createURL("reset-password"),
    });
    setLoading(false);

    // Do not leak whether the email exists — always show the same notice.
    if (error && error.status && error.status >= 500) {
      showAlert(t("common.error"), error.message);
      return;
    }
    setSent(true);
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
            {t("auth.forgotTitle")}
          </Heading>

          {sent ? (
            <VStack space="lg">
              <Text className="text-center text-stone-600">
                {t("auth.resetLinkSent")}
              </Text>
              <Button
                action="primary"
                size="lg"
                onPress={() => router.replace("/(auth)/login")}
                className="rounded-lg"
              >
                <ButtonText>{t("auth.backToLogin")}</ButtonText>
              </Button>
            </VStack>
          ) : (
            <VStack space="md">
              <Text className="text-center text-stone-600 mb-2">
                {t("auth.forgotDescription")}
              </Text>

              <Input variant="outline" className="rounded-lg">
                <InputField
                  placeholder={t("auth.email")}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                />
              </Input>

              <Button
                action="primary"
                size="lg"
                onPress={handleSend}
                isDisabled={loading}
                className="rounded-lg"
              >
                {loading ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText>{t("auth.sendResetLink")}</ButtonText>
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
