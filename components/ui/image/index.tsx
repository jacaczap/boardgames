import React from "react";
import {
  Image as RNImage,
  type ImageProps as RNImageProps,
} from "react-native";

export const Image = React.forwardRef<RNImage, RNImageProps>(
  ({ className, ...props }, ref) => (
    <RNImage ref={ref} className={className} {...props} />
  ),
);
Image.displayName = "Image";
