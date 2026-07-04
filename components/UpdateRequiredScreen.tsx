import React from "react";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";

export default function UpdateRequiredScreen({
  storeUrl,
}: {
  storeUrl: string | null;
}) {
  const { t } = useTranslation();

  return (
    <Box className="flex-1 justify-center items-center px-8 bg-stone-50">
      <VStack space="lg" className="items-center max-w-md">
        <Ionicons name="cloud-download-outline" size={64} color="#4a3228" />
        <Heading size="2xl" className="text-center">
          {t("update.title")}
        </Heading>
        <Text className="text-center text-typography-600">
          {t("update.message")}
        </Text>
        {storeUrl && (
          <Button
            action="primary"
            size="lg"
            onPress={() => Linking.openURL(storeUrl).catch(() => {})}
            className="rounded-lg mt-2"
          >
            <ButtonText>{t("update.updateNow")}</ButtonText>
          </Button>
        )}
      </VStack>
    </Box>
  );
}
