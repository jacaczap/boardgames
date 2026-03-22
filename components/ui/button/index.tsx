import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  type TextProps,
  type View,
} from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import {
  withStyleContext,
  useStyleContext,
} from "@gluestack-ui/nativewind-utils/withStyleContext";

const buttonStyle = tva({
  base: "rounded-xl items-center justify-center flex-row",
  variants: {
    action: {
      primary: "",
      secondary: "",
      positive: "",
      negative: "",
    },
    variant: {
      solid: "",
      outline: "border bg-transparent",
      link: "bg-transparent",
    },
    size: {
      sm: "px-3 py-2",
      md: "px-4 py-3",
      lg: "px-6 py-4",
    },
    isDisabled: {
      true: "opacity-50",
    },
  },
  compoundVariants: [
    { action: "primary", variant: "solid", class: "bg-blue-600 active:bg-blue-700" },
    { action: "secondary", variant: "solid", class: "bg-gray-600 active:bg-gray-700" },
    { action: "positive", variant: "solid", class: "bg-green-600 active:bg-green-700" },
    { action: "negative", variant: "solid", class: "bg-red-600 active:bg-red-700" },
    { action: "primary", variant: "outline", class: "border-blue-300" },
    { action: "secondary", variant: "outline", class: "border-gray-300" },
    { action: "positive", variant: "outline", class: "border-green-300" },
    { action: "negative", variant: "outline", class: "border-red-300" },
  ],
  defaultVariants: {
    action: "primary",
    variant: "solid",
    size: "md",
  },
});

const buttonTextStyle = tva({
  base: "font-semibold",
  variants: {
    action: {
      primary: "",
      secondary: "",
      positive: "",
      negative: "",
    },
    variant: {
      solid: "text-white",
      outline: "",
      link: "",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
  },
  compoundVariants: [
    { action: "primary", variant: "outline", class: "text-blue-600" },
    { action: "primary", variant: "link", class: "text-blue-600" },
    { action: "secondary", variant: "outline", class: "text-gray-600" },
    { action: "secondary", variant: "link", class: "text-gray-600" },
    { action: "positive", variant: "outline", class: "text-green-600" },
    { action: "positive", variant: "link", class: "text-green-600" },
    { action: "negative", variant: "outline", class: "text-red-600" },
    { action: "negative", variant: "link", class: "text-red-600" },
  ],
  defaultVariants: {
    action: "primary",
    variant: "solid",
    size: "md",
  },
});

type ButtonAction = "primary" | "secondary" | "positive" | "negative";
type ButtonVariant = "solid" | "outline" | "link";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends PressableProps {
  action?: ButtonAction;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isDisabled?: boolean;
  className?: string;
}

const ButtonBase = React.forwardRef<View, ButtonProps>(
  (
    {
      className,
      action,
      variant,
      size,
      isDisabled,
      disabled,
      ...props
    },
    ref,
  ) => (
    <Pressable
      ref={ref}
      disabled={isDisabled || disabled}
      className={buttonStyle({
        action,
        variant,
        size,
        isDisabled: isDisabled || disabled ? true : undefined,
        className,
      })}
      {...props}
    />
  ),
);
ButtonBase.displayName = "Button";

export const Button = withStyleContext(ButtonBase, "BUTTON") as React.ForwardRefExoticComponent<
  ButtonProps & { context?: any } & React.RefAttributes<View>
>;

export const ButtonText = React.forwardRef<Text, TextProps & { className?: string }>(
  ({ className, ...props }, ref) => {
    const { action, variant, size } =
      (useStyleContext("BUTTON") as {
        action?: ButtonAction;
        variant?: ButtonVariant;
        size?: ButtonSize;
      }) ?? {};
    return (
      <Text
        ref={ref}
        className={buttonTextStyle({ action, variant, size, className })}
        {...props}
      />
    );
  },
);
ButtonText.displayName = "ButtonText";

export const ButtonSpinner: React.FC<{ className?: string }> = ({ className }) => {
  const { variant } = (useStyleContext("BUTTON") as { variant?: ButtonVariant }) ?? {};
  const color = variant === "solid" ? "#ffffff" : "#2563eb";
  return <ActivityIndicator size="small" color={color} className={className} />;
};
ButtonSpinner.displayName = "ButtonSpinner";

interface ButtonIconProps {
  as: React.ComponentType<any>;
  name: string;
  size?: number;
  className?: string;
}

export const ButtonIcon: React.FC<ButtonIconProps> = ({
  as: IconComponent,
  name,
  size = 18,
  className,
}) => {
  const { action, variant } =
    (useStyleContext("BUTTON") as {
      action?: ButtonAction;
      variant?: ButtonVariant;
    }) ?? {};

  const colorMap: Record<string, Record<string, string>> = {
    solid: { primary: "#fff", secondary: "#fff", positive: "#fff", negative: "#fff" },
    outline: { primary: "#2563eb", secondary: "#4b5563", positive: "#16a34a", negative: "#dc2626" },
    link: { primary: "#2563eb", secondary: "#4b5563", positive: "#16a34a", negative: "#dc2626" },
  };
  const color = colorMap[variant ?? "solid"]?.[action ?? "primary"] ?? "#fff";
  return <IconComponent name={name} size={size} color={color} className={className} />;
};
ButtonIcon.displayName = "ButtonIcon";
