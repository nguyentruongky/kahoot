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

const parseAnswerIndex = (
  raw: string,
  options: string[]
): number | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

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

  return undefined;
};

export const normalizeCorrectAnswers = (
  candidate: unknown,
  options: string[]
): number[] => {
  const indices = new Set<number>();

  const addIndex = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      const idx = Math.trunc(value);
      if (idx >= 0 && idx < options.length) indices.add(idx);
      else if (idx - 1 >= 0 && idx - 1 < options.length) indices.add(idx - 1);
      return;
    }

    if (typeof value === "string") {
      const parts = value.split(/[,\|;]/g).map((part) => part.trim());
      for (const part of parts) {
        const parsed = parseAnswerIndex(part, options);
        if (typeof parsed === "number") indices.add(parsed);
      }
    }
  };

  if (Array.isArray(candidate)) {
    candidate.forEach(addIndex);
  } else if (typeof candidate !== "undefined") {
    addIndex(candidate);
  }

  if (indices.size === 0) {
    indices.add(normalizeCorrectAnswer(candidate, options));
  }

  return Array.from(indices).sort((a, b) => a - b);
};
