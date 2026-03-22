import React from "react";
import { View, type ViewProps } from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";

const vstackStyle = tva({
  base: "flex-col",
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
      true: "flex-col-reverse",
    },
  },
});

interface VStackProps extends ViewProps {
  space?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  reversed?: boolean;
}

export const VStack = React.forwardRef<View, VStackProps>(
  ({ className, space, reversed, ...props }, ref) => (
    <View
      ref={ref}
      className={vstackStyle({ space, reversed, className })}
      {...props}
    />
  ),
);
VStack.displayName = "VStack";
