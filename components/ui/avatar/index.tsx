import React from "react";
import {
  View,
  Image,
  Text,
  type ViewProps,
  type ImageProps,
  type TextProps,
} from "react-native";
import { tva } from "@gluestack-ui/nativewind-utils/tva";

const avatarStyle = tva({
  base: "rounded-full items-center justify-center overflow-hidden bg-amber-600",
  variants: {
    size: {
      xs: "w-6 h-6",
      sm: "w-8 h-8",
      md: "w-10 h-10",
      lg: "w-12 h-12",
      xl: "w-16 h-16",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const fallbackTextStyle = tva({
  base: "font-bold text-amber-50",
  variants: {
    size: {
      xs: "text-2xs",
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
      xl: "text-lg",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps extends ViewProps {
  size?: AvatarSize;
}

export const Avatar = React.forwardRef<View, AvatarProps>(
  ({ className, size = "md", children, ...props }, ref) => (
    <View ref={ref} className={avatarStyle({ size, className })} {...props}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, { _size: size })
          : child,
      )}
    </View>
  ),
);
Avatar.displayName = "Avatar";

interface AvatarImageProps extends Omit<ImageProps, "source"> {
  source: ImageProps["source"];
  _size?: AvatarSize;
}

export const AvatarImage = React.forwardRef<Image, AvatarImageProps>(
  ({ className, _size, ...props }, ref) => (
    <Image ref={ref} className={`w-full h-full ${className ?? ""}`} {...props} />
  ),
);
AvatarImage.displayName = "AvatarImage";

interface AvatarFallbackTextProps extends TextProps {
  _size?: AvatarSize;
}

export const AvatarFallbackText = React.forwardRef<Text, AvatarFallbackTextProps>(
  ({ className, _size = "md", ...props }, ref) => (
    <Text
      ref={ref}
      className={fallbackTextStyle({ size: _size, className })}
      {...props}
    />
  ),
);
AvatarFallbackText.displayName = "AvatarFallbackText";

export const AvatarGroup = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={`flex-row flex-wrap gap-2 ${className ?? ""}`}
      {...props}
    />
  ),
);
AvatarGroup.displayName = "AvatarGroup";
