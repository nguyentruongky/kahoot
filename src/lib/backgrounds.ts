import type { CSSProperties } from "react";

export const DEFAULT_BACKGROUND_IMAGE = "background-default.svg";

export const BACKGROUND_BASE_CLASS = "bg-cover bg-center bg-no-repeat";

export function backgroundStyle(fileName?: string): CSSProperties | undefined {
  if (!fileName) return undefined;
  const source = fileName.trim();
  if (!source) return undefined;
  const resolved =
    source.startsWith("data:") ||
    source.startsWith("http://") ||
    source.startsWith("https://") ||
    source.startsWith("/")
      ? source
      : `/backgrounds/${source}`;
  return { backgroundImage: `url('${resolved}')` };
}
