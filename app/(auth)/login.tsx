import React, { useState } from "react";
import { ScrollView, KeyboardAvoidingView } from "react-native";
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

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      showAlert(t("common.error"), t("auth.fillAllFields"));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setLoading(false);

    if (error) {
      showAlert(t("auth.loginFailed"), error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior="padding"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="bg-stone-50"
      >
        <Box className="flex-1 justify-center px-8">
          <Heading size="3xl" className="text-center mb-8">
            {t("auth.appName")}
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
                textContentType="password"
                autoComplete="password"
                importantForAutofill="yes"
              />
              <InputSlot className="pr-3" onPress={() => setShowPassword((v) => !v)}>
                <InputIcon as={Ionicons} name={showPassword ? "eye-off" : "eye"} />
              </InputSlot>
            </Input>

            <Button
              action="primary"
              size="lg"
              onPress={handleLogin}
              isDisabled={loading}
              className="rounded-lg"
            >
              {loading ? (
                <ButtonSpinner />
              ) : (
                <ButtonText>{t("auth.logIn")}</ButtonText>
              )}
            </Button>

            <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
              <Text className="text-center text-amber-700 font-medium">
                {t("auth.forgotPassword")}
              </Text>
            </Pressable>

            <HStack space="xs" className="justify-center mt-2">
              <Text className="text-stone-500">{t("auth.noAccount")}</Text>
              <Pressable onPress={() => router.push("/(auth)/register")}>
                <Text className="text-amber-700 font-medium">
                  {t("auth.signUp")}
                </Text>
              </Pressable>
            </HStack>
          </VStack>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
