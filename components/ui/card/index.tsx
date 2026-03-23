import React from "react";
import { View, type ViewProps } from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";

const cardStyle = tva({
  base: "rounded-2xl overflow-hidden",
  variants: {
    variant: {
      elevated: "bg-white shadow-md",
      outline: "bg-white border border-stone-200",
      ghost: "bg-transparent",
      filled: "bg-stone-100",
    },
  },
  defaultVariants: {
    variant: "elevated",
  },
});

interface CardProps extends ViewProps {
  variant?: "elevated" | "outline" | "ghost" | "filled";
}

export const Card = React.forwardRef<View, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <View ref={ref} className={cardStyle({ variant, className })} {...props} />
  ),
);
Card.displayName = "Card";
