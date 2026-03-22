import React from "react";
import { View, type ViewProps } from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";

const hstackStyle = tva({
  base: "flex-row",
  variants: {
    space: {
      xs: "gap-1",
      sm: "gap-2",
      md: "gap-3",
      lg: "gap-4",
      xl: "gap-6",
      "2xl": "gap-8",
    },
    reversed: {
      true: "flex-row-reverse",
    },
  },
});

interface HStackProps extends ViewProps {
  space?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  reversed?: boolean;
}

export const HStack = React.forwardRef<View, HStackProps>(
  ({ className, space, reversed, ...props }, ref) => (
    <View
      ref={ref}
      className={hstackStyle({ space, reversed, className })}
      {...props}
    />
  ),
);
HStack.displayName = "HStack";
