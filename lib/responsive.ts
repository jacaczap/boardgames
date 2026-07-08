import { Dimensions, Platform, useWindowDimensions } from "react-native";

// A device counts as a "tablet" when its shorter side is at least this many
// dp (covers 7"+ Android tablets and every iPad). Orientation-independent.
const TABLET_MIN_SHORT_SIDE = 600;

// How much larger typography, avatars and chrome get on tablets.
export const TABLET_SCALE = 1.35;

// Tablet content is centred in a comfortable column instead of stretching edge
// to edge (which produces over-long, hard-to-read lines). 820 keeps common
// portrait tablets effectively full-width while capping wide landscape screens.
export const TABLET_CONTENT_MAX_WIDTH = 820;

function isTabletSize(width: number, height: number): boolean {
  if (Platform.OS === "web") return false;
  return Math.min(width, height) >= TABLET_MIN_SHORT_SIDE;
}

// Tablet-ness depends on the physical device, not orientation, so it is safe to
// resolve once at module load and share as a constant. This lets the UI
// primitives (Text/Heading/Avatar) scale synchronously without extra hooks.
const initial = Dimensions.get("window");
export const IS_TABLET = isTabletSize(initial.width, initial.height);

// Multiplier applied to font sizes / avatar dimensions. 1 on phones and web, so
// those layouts are left exactly as they were.
export const UI_SCALE = IS_TABLET ? TABLET_SCALE : 1;

export function scaleUp(px: number): number {
  return Math.round(px * UI_SCALE);
}

// Tailwind text-size class -> px, so a size expressed via className scales the
// same way as one expressed via a `size` prop.
const TW_TEXT_PX: Record<string, number> = {
  "text-2xs": 10,
  "text-xs": 12,
  "text-sm": 14,
  "text-base": 16,
  "text-lg": 18,
  "text-xl": 20,
  "text-2xl": 24,
  "text-3xl": 30,
  "text-4xl": 36,
};

const TEXT_CLASS_RE = /(?:^|\s)(text-(?:2xs|2xl|3xl|4xl|xs|sm|base|lg|xl))(?:\s|$)/;

export function classTextPx(className?: string): number | undefined {
  if (!className) return undefined;
  const match = className.match(TEXT_CLASS_RE);
  return match ? TW_TEXT_PX[match[1]] : undefined;
}

// Inline font style that enlarges text on tablets. `undefined` on phones/web so
// those layouts are untouched. Inline styles override the className size.
export function tabletFontStyle(
  basePx: number,
  lineFactor = 1.3,
): { fontSize: number; lineHeight: number } | undefined {
  if (!IS_TABLET) return undefined;
  const fontSize = basePx * UI_SCALE;
  return { fontSize, lineHeight: fontSize * lineFactor };
}

export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  return isTabletSize(width, height);
}
