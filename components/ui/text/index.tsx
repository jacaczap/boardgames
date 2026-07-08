import React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { classTextPx, tabletFontStyle } from "@/lib/responsive";

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

type TextSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_PX: Record<TextSize, number> = {
  "2xs": 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
};

interface TextProps extends RNTextProps {
  size?: TextSize;
  bold?: boolean;
  italic?: boolean;
}

export const Text = React.forwardRef<RNText, TextProps>(
  ({ className, size, bold, italic, style, ...props }, ref) => {
    // On tablets, enlarge the font via an inline style (which overrides the
    // className size). A size set through className takes priority over the
    // `size` prop so the scaled result matches what would otherwise render.
    const basePx = classTextPx(className) ?? SIZE_PX[size ?? "md"];
    const scaledStyle = tabletFontStyle(basePx);

    return (
      <RNText
        ref={ref}
        className={textStyle({ size, bold, italic, className })}
        style={scaledStyle ? [scaledStyle, style] : style}
        {...props}
      />
    );
  },
);
Text.displayName = "Text";
