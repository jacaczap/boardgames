import React from "react";
import { View, Text, type ViewProps, type TextProps } from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";

const badgeStyle = tva({
  base: "self-start rounded-full px-3 py-1",
  variants: {
    action: {
      info: "bg-blue-50",
      success: "bg-green-50",
      warning: "bg-amber-50",
      error: "bg-red-50",
      muted: "bg-gray-100",
    },
  },
  defaultVariants: {
    action: "info",
  },
});

const badgeTextStyle = tva({
  base: "text-sm font-medium",
  variants: {
    action: {
      info: "text-blue-700",
      success: "text-green-700",
      warning: "text-amber-700",
      error: "text-red-700",
      muted: "text-gray-600",
    },
  },
  defaultVariants: {
    action: "info",
  },
});

type BadgeAction = "info" | "success" | "warning" | "error" | "muted";

interface BadgeProps extends ViewProps {
  action?: BadgeAction;
}

export const Badge = React.forwardRef<View, BadgeProps>(
  ({ className, action, ...props }, ref) => (
    <View ref={ref} className={badgeStyle({ action, className })} {...props} />
  ),
);
Badge.displayName = "Badge";

interface BadgeTextProps extends TextProps {
  action?: BadgeAction;
}

export const BadgeText = React.forwardRef<Text, BadgeTextProps>(
  ({ className, action, ...props }, ref) => (
    <Text
      ref={ref}
      className={badgeTextStyle({ action, className })}
      {...props}
    />
  ),
);
BadgeText.displayName = "BadgeText";
