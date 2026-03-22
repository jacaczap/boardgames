import React from "react";
import { ActivityIndicator, type ActivityIndicatorProps } from "react-native";

interface SpinnerProps extends Omit<ActivityIndicatorProps, "size"> {
  size?: "small" | "large";
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = "large",
  color = "#2563eb",
  ...props
}) => <ActivityIndicator size={size} color={color} {...props} />;
Spinner.displayName = "Spinner";
