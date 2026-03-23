import React from "react";
import { View, Text, type ViewProps, type TextProps } from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";

const badgeStyle = tva({
  base: "self-start rounded-full px-3 py-1",
  variants: {
    action: {
      info: "bg-amber-100",
      success: "bg-green-50",
      warning: "bg-orange-100",
      error: "bg-red-50",
      muted: "bg-stone-200",
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
      info: "text-amber-800",
      success: "text-green-700",
      warning: "text-orange-700",
      error: "text-red-700",
      muted: "text-stone-600",
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
