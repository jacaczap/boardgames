import React from "react";
import { Image as ExpoImage, type ImageProps } from "expo-image";
import { cssInterop } from "nativewind";

cssInterop(ExpoImage, { className: "style" });

export const Image = React.forwardRef<ExpoImage, ImageProps>(
  ({ className, ...props }, ref) => (
    <ExpoImage
      ref={ref}
      className={className}
      cachePolicy="disk"
      transition={150}
      {...props}
    />
  ),
);
Image.displayName = "Image";
