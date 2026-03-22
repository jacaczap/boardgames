import React from "react";
import { View, type ViewProps } from "react-native";

export const Box = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={className} {...props} />
  ),
);
Box.displayName = "Box";
