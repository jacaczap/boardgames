import React from "react";
import { View, type ViewProps } from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";

const centerStyle = tva({ base: "items-center justify-center" });

export const Center = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={centerStyle({ className })} {...props} />
  ),
);
Center.displayName = "Center";
