import React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";

const textStyle = tva({
  base: "text-gray-700",
  variants: {
    size: {
      "2xs": "text-2xs",
      xs: "text-xs",
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
    },
    bold: {
      true: "font-bold",
    },
    italic: {
      true: "italic",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

interface TextProps extends RNTextProps {
  size?: "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  bold?: boolean;
  italic?: boolean;
}

export const Text = React.forwardRef<RNText, TextProps>(
  ({ className, size, bold, italic, ...props }, ref) => (
    <RNText
      ref={ref}
      className={textStyle({ size, bold, italic, className })}
      {...props}
    />
  ),
);
Text.displayName = "Text";
