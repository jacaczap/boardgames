import { Alert, Platform } from "react-native";

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

/**
 * Cross-platform Alert.alert replacement.
 * Native: delegates to Alert.alert.
 * Web: uses window.alert (info) or window.confirm (with action buttons).
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }

  if (!buttons || buttons.length === 0) {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }

  const cancelButton = buttons.find((b) => b.style === "cancel");
  const actionButton = buttons.find((b) => b.style !== "cancel");

  if (actionButton) {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) {
      actionButton.onPress?.();
    } else {
      cancelButton?.onPress?.();
    }
  } else {
    window.alert(message ? `${title}\n\n${message}` : title);
    buttons[0]?.onPress?.();
  }
}
