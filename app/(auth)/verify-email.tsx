import React, { useState } from "react";
import { ScrollView } from "react-native";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { showAlert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Center } from "@/components/ui/center";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Ionicons } from "@expo/vector-icons";

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: Linking.createURL("login") },
    });
    setResending(false);
    if (error) {
      showAlert(t("auth.resendFailed"), error.message);
      return;
    }
    showAlert(t("auth.checkEmailTitle"), t("auth.resendSuccess"));
  };

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      className="bg-stone-50"
      keyboardShouldPersistTaps="handled"
    >
      <Box className="flex-1 justify-center px-8">
        <VStack space="lg">
          <Center>
            <Ionicons name="mail-unread-outline" size={64} color="#b45309" />
          </Center>

          <Heading size="2xl" className="text-center">
            {t("auth.checkEmailTitle")}
          </Heading>

          <Text className="text-center text-stone-600">
            {email
              ? t("auth.verifyEmailMessage", { email })
              : t("auth.verifyEmailGeneric")}
          </Text>

          {email ? (
            <Button
              action="primary"
              variant="outline"
              size="lg"
              onPress={handleResend}
              isDisabled={resending}
              className="rounded-lg"
            >
              {resending ? (
                <ButtonSpinner />
              ) : (
                <ButtonText>{t("auth.resendEmail")}</ButtonText>
              )}
            </Button>
          ) : null}

          <Button
            action="primary"
            size="lg"
            onPress={() => router.replace("/(auth)/login")}
            className="rounded-lg"
          >
            <ButtonText>{t("auth.backToLogin")}</ButtonText>
          </Button>
        </VStack>
      </Box>
    </ScrollView>
  );
}
