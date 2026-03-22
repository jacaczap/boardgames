import React from "react";
import { config } from "./config";

interface GluestackUIProviderProps {
  children: React.ReactNode;
  mode?: "light" | "dark";
}

export const GluestackUIProvider: React.FC<GluestackUIProviderProps> = ({
  children,
  mode = "light",
}) => {
  return <>{children}</>;
};

export { config };
