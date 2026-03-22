import React from "react";
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type View,
} from "react-native";

export const Pressable = React.forwardRef<View, RNPressableProps>(
  (props, ref) => <RNPressable ref={ref} {...props} />,
);
Pressable.displayName = "Pressable";
