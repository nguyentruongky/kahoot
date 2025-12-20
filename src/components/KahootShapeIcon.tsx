"use client";

export type KahootShapeKind = "triangle" | "diamond" | "circle" | "square";

export const kahootShapeForIndex = (index: number): KahootShapeKind => {
  const normalized = ((index % 4) + 4) % 4;
  if (normalized === 0) return "triangle";
  if (normalized === 1) return "diamond";
  if (normalized === 2) return "circle";
  return "square";
};

export function KahootShapeIcon({
  kind,
  className,
  title,
}: {
  kind: KahootShapeKind;
  className?: string;
  title?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    role: title ? ("img" as const) : ("presentation" as const),
    "aria-hidden": title ? undefined : true,
    "aria-label": title,
  };

  switch (kind) {
    case "triangle":
      return (
        <svg {...common}>
          <path d="M12 3L22 21H2L12 3Z" fill="currentColor" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <path d="M12 2L22 12L12 22L2 12L12 2Z" fill="currentColor" />
        </svg>
      );
    case "circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" fill="currentColor" />
        </svg>
      );
    case "square":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" fill="currentColor" />
        </svg>
      );
  }
}

