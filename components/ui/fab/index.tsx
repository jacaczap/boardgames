import React from "react";
import { Pressable, Text, type PressableProps, type View } from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";

const fabStyle = tva({
  base: "absolute items-center justify-center rounded-full shadow-lg flex-row",
  variants: {
    placement: {
      "bottom right": "bottom-6 right-6",
      "bottom left": "bottom-6 left-6",
      "top right": "top-6 right-6",
      "top left": "top-6 left-6",
    },
    size: {
      sm: "w-10 h-10",
      md: "w-12 h-12",
      lg: "w-14 h-14",
    },
    action: {
      primary: "bg-amber-700 active:bg-amber-800",
      secondary: "bg-stone-600 active:bg-stone-700",
    },
  },
  defaultVariants: {
    placement: "bottom right",
    size: "lg",
    action: "primary",
  },
});

interface FabProps extends PressableProps {
  placement?: "bottom right" | "bottom left" | "top right" | "top left";
  size?: "sm" | "md" | "lg";
  action?: "primary" | "secondary";
  className?: string;
}

export const Fab = React.forwardRef<View, FabProps>(
  ({ className, placement, size, action, ...props }, ref) => (
    <Pressable
      ref={ref}
      className={fabStyle({ placement, size, action, className })}
      {...props}
    />
  ),
);
Fab.displayName = "Fab";

interface FabIconProps {
  as: React.ComponentType<any>;
  name: string;
  size?: number;
  color?: string;
}

export const FabIcon: React.FC<FabIconProps> = ({
  as: IconComponent,
  name,
  size = 28,
  color = "white",
}) => <IconComponent name={name} size={size} color={color} />;
FabIcon.displayName = "FabIcon";

export const FabLabel = React.forwardRef<Text, { className?: string; children: React.ReactNode }>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      className={`text-white font-semibold ml-2 ${className ?? ""}`}
      {...props}
    />
  ),
);
FabLabel.displayName = "FabLabel";
