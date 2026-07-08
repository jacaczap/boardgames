import React from "react";
import {
  View,
  Text,
  type ViewProps,
  type TextProps,
} from "react-native";
import { Image as ExpoImage, type ImageProps } from "expo-image";
import { cssInterop } from "nativewind";
import { tva } from "@gluestack-ui/nativewind-utils/tva";
import { IS_TABLET, UI_SCALE } from "@/lib/responsive";

cssInterop(ExpoImage, { className: "style" });

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

const AVATAR_PX: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

const FALLBACK_PX: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
};

interface AvatarProps extends ViewProps {
  size?: AvatarSize;
}

export const Avatar = React.forwardRef<View, AvatarProps>(
  ({ className, size = "md", children, style, ...props }, ref) => {
    const scaledStyle = IS_TABLET
      ? { width: AVATAR_PX[size] * UI_SCALE, height: AVATAR_PX[size] * UI_SCALE }
      : undefined;
    return (
      <View
        ref={ref}
        className={avatarStyle({ size, className })}
        style={scaledStyle ? [scaledStyle, style] : style}
        {...props}
      >
        {React.Children.map(children, (child) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<any>, { _size: size })
            : child,
        )}
      </View>
    );
  },
);
Avatar.displayName = "Avatar";

interface AvatarImageProps extends ImageProps {
  _size?: AvatarSize;
}

export const AvatarImage = React.forwardRef<ExpoImage, AvatarImageProps>(
  ({ className, _size, ...props }, ref) => (
    <ExpoImage
      ref={ref}
      className={`w-full h-full ${className ?? ""}`}
      cachePolicy="disk"
      transition={150}
      {...props}
    />
  ),
);
AvatarImage.displayName = "AvatarImage";

interface AvatarFallbackTextProps extends TextProps {
  _size?: AvatarSize;
}

export const AvatarFallbackText = React.forwardRef<Text, AvatarFallbackTextProps>(
  ({ className, _size = "md", style, ...props }, ref) => {
    const scaledStyle = IS_TABLET
      ? { fontSize: FALLBACK_PX[_size] * UI_SCALE }
      : undefined;
    return (
      <Text
        ref={ref}
        className={fallbackTextStyle({ size: _size, className })}
        style={scaledStyle ? [scaledStyle, style] : style}
        {...props}
      />
    );
  },
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
