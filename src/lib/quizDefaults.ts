export const TRUE_FALSE_OPTIONS = ["Đúng", "Sai"] as const;
export const DEFAULT_OPTIONS = ["", "", "", ""] as const;

const TRUE_LABELS = new Set(["true", "đúng", "dung", "yes", "y"]);
const FALSE_LABELS = new Set(["false", "sai", "no", "n"]);

export const trimTrailingEmptyOptions = (options: string[]): string[] => {
  const trimmed = [...options];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === "") {
    trimmed.pop();
  }
  return trimmed;
};

export const normalizeOptions = (raw: unknown): string[] => {
  const list = Array.isArray(raw)
    ? raw.map((opt) => String(opt ?? "").trim())
    : [];
  const trimmed = trimTrailingEmptyOptions(list);
  if (trimmed.length < 2) return [...TRUE_FALSE_OPTIONS];
  return trimmed.slice(0, 4);
};

export const padOptions = (options: string[], length: number): string[] => {
  const padded = [...options];
  while (padded.length < length) padded.push("");
  return padded.slice(0, length);
};

export const normalizeCorrectAnswer = (
  candidate: unknown,
  options: string[]
): number => {
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    const idx = Math.trunc(candidate);
    if (idx >= 0 && idx < options.length) return idx;
    if (idx - 1 >= 0 && idx - 1 < options.length) return idx - 1;
    return 0;
  }

  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (trimmed !== "") {
      const asNum = Number(trimmed);
      if (Number.isFinite(asNum)) {
        const idx = Math.trunc(asNum);
        if (idx >= 0 && idx < options.length) return idx;
        if (idx - 1 >= 0 && idx - 1 < options.length) return idx - 1;
      }
      const byText = options.findIndex((o) => o === trimmed);
      if (byText >= 0) return byText;
      if (options.length === 2) {
        const lowered = trimmed.toLowerCase();
        if (TRUE_LABELS.has(lowered)) return 0;
        if (FALSE_LABELS.has(lowered)) return 1;
      }
    }
  }

  return 0;
};
