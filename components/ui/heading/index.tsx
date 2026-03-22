import React from "react";
import { Text, type TextProps } from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";

const headingStyle = tva({
  base: "font-bold text-gray-900",
  variants: {
    size: {
      xs: "text-xs",
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
      xl: "text-xl",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
      "4xl": "text-4xl",
    },
  },
  defaultVariants: {
    size: "xl",
  },
});

interface HeadingProps extends TextProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
}

export const Heading = React.forwardRef<Text, HeadingProps>(
  ({ className, size, ...props }, ref) => (
    <Text ref={ref} className={headingStyle({ size, className })} {...props} />
  ),
);
Heading.displayName = "Heading";
