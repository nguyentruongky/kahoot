import type { CSSProperties } from "react";

export const DEFAULT_BACKGROUND_IMAGE = "background-default.svg";

export const BACKGROUND_BASE_CLASS = "bg-cover bg-center bg-no-repeat";

export function backgroundStyle(fileName?: string): CSSProperties | undefined {
  if (!fileName) return undefined;
  return { backgroundImage: `url('/backgrounds/${fileName}')` };
}

