import React, { useState } from "react";
import { Alert, Switch } from "react-native";
import { supabase } from "@/lib/supabase";
import { setStayLoggedIn as saveStayLoggedIn } from "@/lib/auth-storage";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText, ButtonSpinner } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    await saveStayLoggedIn(stayLoggedIn);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert("Login failed", error.message);
    }
  };

  return (
    <Box className="flex-1 justify-center px-8 bg-white">
      <Heading size="3xl" className="text-center mb-8">
        BoardGames
      </Heading>

      <VStack space="md">
        <Input variant="outline" className="rounded-lg">
          <InputField
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </Input>

        <Input variant="outline" className="rounded-lg">
          <InputField
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />
        </Input>

        <HStack className="items-center justify-between mb-2">
          <Text className="text-gray-600">Stay logged in</Text>
          <Switch value={stayLoggedIn} onValueChange={setStayLoggedIn} />
        </HStack>

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
            <ButtonText>Log In</ButtonText>
          )}
        </Button>
      </VStack>
    </Box>
  );
}
