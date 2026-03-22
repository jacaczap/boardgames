import React from "react";
import { type ViewProps, View } from "react-native";

interface IconProps extends ViewProps {
  as: React.ComponentType<any>;
  name: string;
  size?: number;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({
  as: IconComponent,
  name,
  size = 20,
  color = "#6b7280",
  ...props
}) => <IconComponent name={name} size={size} color={color} {...props} />;
Icon.displayName = "Icon";
