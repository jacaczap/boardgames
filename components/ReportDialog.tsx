import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable as RNPressable,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { showAlert } from "@/lib/alert";
import {
  REPORT_REASONS,
  reportContent,
  type ReportContentType,
  type ReportReason,
} from "@/lib/moderation";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";

interface ReportDialogProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  contentType: ReportContentType;
  contentId: string;
}

const ReportDialog: React.FC<ReportDialogProps> = ({
  visible,
  onClose,
  groupId,
  contentType,
  contentId,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason(null);
    setDetails("");
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await reportContent({ groupId, contentType, contentId, reason, details });
      handleClose();
      showAlert(t("moderation.reportSentTitle"), t("moderation.reportSentMessage"));
    } catch (e: any) {
      setSubmitting(false);
      showAlert(t("common.error"), e?.message ?? t("moderation.reportFailed"));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <RNPressable style={styles.overlay} onPress={handleClose}>
        <RNPressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <VStack space="md">
            <Heading size="md">{t("moderation.reportReasonTitle")}</Heading>

            <VStack space="xs">
              {REPORT_REASONS.map((r) => {
                const active = reason === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setReason(r)}
                    className={`py-3 px-3 rounded-lg border ${
                      active
                        ? "bg-amber-200 border-amber-600"
                        : "bg-stone-100 border-stone-200"
                    }`}
                  >
                    <Text
                      className={active ? "text-amber-800 font-medium" : "text-stone-700"}
                    >
                      {t(`moderation.reason.${r}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </VStack>

            <Input variant="outline" className="rounded-lg">
              <InputField
                value={details}
                onChangeText={setDetails}
                placeholder={t("moderation.detailsPlaceholder")}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{ minHeight: 70 }}
              />
            </Input>

            <HStack space="sm">
              <Button
                variant="outline"
                action="secondary"
                className="flex-1"
                isDisabled={submitting}
                onPress={handleClose}
              >
                <ButtonText>{t("common.cancel")}</ButtonText>
              </Button>
              <Button
                action="negative"
                className="flex-1"
                isDisabled={!reason || submitting}
                onPress={handleSubmit}
              >
                <ButtonText>
                  {submitting
                    ? t("moderation.submitting")
                    : t("moderation.submitReport")}
                </ButtonText>
              </Button>
            </HStack>
          </VStack>
        </RNPressable>
      </RNPressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
});

export default ReportDialog;
