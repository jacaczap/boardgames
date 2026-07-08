import React from "react";
import { Text, type TextProps } from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { classTextPx, tabletFontStyle } from "@/lib/responsive";

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

type HeadingSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

const SIZE_PX: Record<HeadingSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
};

interface HeadingProps extends TextProps {
  size?: HeadingSize;
}

export const Heading = React.forwardRef<Text, HeadingProps>(
  ({ className, size, style, ...props }, ref) => {
    const basePx = classTextPx(className) ?? SIZE_PX[size ?? "xl"];
    const scaledStyle = tabletFontStyle(basePx, 1.25);

    return (
      <Text
        ref={ref}
        className={headingStyle({ size, className })}
        style={scaledStyle ? [scaledStyle, style] : style}
        {...props}
      />
    );
  },
);
Heading.displayName = "Heading";
