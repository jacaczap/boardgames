import React from "react";
import {
  View,
  TextInput,
  type ViewProps,
  type TextInputProps,
  type View as ViewType,
} from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";

const inputStyle = tva({
  base: "flex-row items-center bg-stone-50 border border-stone-200 rounded-xl",
  variants: {
    size: {
      sm: "px-2 py-1.5",
      md: "px-3 py-2",
      lg: "px-4 py-3",
    },
    variant: {
      outline: "bg-white border border-stone-200",
      filled: "bg-stone-50 border border-stone-200",
      underlined: "bg-transparent border-b border-stone-200 rounded-none px-0",
    },
    isDisabled: {
      true: "opacity-50",
    },
  },
  defaultVariants: {
    size: "lg",
    variant: "filled",
  },
});

const inputFieldStyle = tva({
  base: "flex-1 text-base text-stone-900",
  variants: {
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-base",
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

type InputSize = "sm" | "md" | "lg";
type InputVariant = "outline" | "filled" | "underlined";

interface InputProps extends ViewProps {
  size?: InputSize;
  variant?: InputVariant;
  isDisabled?: boolean;
}

export const Input = React.forwardRef<ViewType, InputProps>(
  ({ className, size, variant, isDisabled, ...props }, ref) => (
    <View
      ref={ref}
      className={inputStyle({ size, variant, isDisabled, className })}
      {...props}
    />
  ),
);
Input.displayName = "Input";

interface InputFieldProps extends TextInputProps {
  className?: string;
}

export const InputField = React.forwardRef<TextInput, InputFieldProps>(
  ({ className, ...props }, ref) => (
    <TextInput
      ref={ref}
      placeholderTextColor="#a8a29e"
      className={inputFieldStyle({ className })}
      {...props}
    />
  ),
);
InputField.displayName = "InputField";

interface InputSlotProps extends ViewProps {}

export const InputSlot = React.forwardRef<ViewType, InputSlotProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={className} {...props} />
  ),
);
InputSlot.displayName = "InputSlot";

interface InputIconProps {
  as: React.ComponentType<any>;
  name: string;
  size?: number;
  color?: string;
}

export const InputIcon: React.FC<InputIconProps> = ({
  as: IconComponent,
  name,
  size = 18,
  color = "#a8a29e",
}) => <IconComponent name={name} size={size} color={color} />;
InputIcon.displayName = "InputIcon";
