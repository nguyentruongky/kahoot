"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { HostBuilderScreen } from "@/app/host/_components/HostBuilderScreen";
import { HostJsonImportInput } from "@/app/host/_components/HostJsonImportInput";
import { normalizeCorrectAnswers } from "@/lib/quizDefaults";

const DEFAULT_QUESTION_DURATION_SEC = 20;

type EditableQuestion = {
  text: string;
  options: string[];
  correctAnswers: number[];
  durationSec: number;
  media?: { kind: "image" | "video"; src: string; mime?: string };
};

const normalizeDurationSec = (candidate: unknown) => {
  const raw =
    typeof candidate === "number"
      ? candidate
      : typeof candidate === "string" && candidate.trim() !== ""
        ? Number(candidate)
        : NaN;
  if (!Number.isFinite(raw)) return DEFAULT_QUESTION_DURATION_SEC;
  const value = Math.trunc(raw);
  if (value < 5) return 5;
  if (value > 300) return 300;
  return value;
};

const normalizeTags = (candidate: unknown): string[] => {
  const rawTags = Array.isArray(candidate)
    ? candidate
    : typeof candidate === "string"
      ? candidate.split(",")
      : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const rawTag of rawTags) {
    const tag = String(rawTag ?? "").trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags.slice(0, 12);
};

type BuilderClientProps = {
  quizId?: string;
};

export function BuilderClient({ quizId }: BuilderClientProps) {
  const router = useRouter();
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [builderTitle, setBuilderTitle] = useState("New Quiz");
  const [builderBackgroundImage, setBuilderBackgroundImage] = useState<
    string | undefined
  >(undefined);
  const [builderTagsText, setBuilderTagsText] = useState("");
  const [builderQuizId, setBuilderQuizId] = useState<string | null>(
    quizId ?? null
  );
  const [builderQuestions, setBuilderQuestions] = useState<EditableQuestion[]>([
    {
      text: "Untitled question",
      options: ["", "", "", ""],
      correctAnswers: [0],
      durationSec: DEFAULT_QUESTION_DURATION_SEC,
    },
  ]);
  const [builderIndex, setBuilderIndex] = useState(0);
  const deletedQuestionStackRef = useRef<
    { question: EditableQuestion; index: number; replace?: boolean }[]
  >([]);
  const [deletedQuestionStackSize, setDeletedQuestionStackSize] = useState(0);
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [jsonPasteText, setJsonPasteText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const normalizeImportedQuestions = (raw: unknown) => {
    const payload =
      raw && typeof raw === "object" && "questions" in raw
        ? (raw as {
            questions: unknown;
            title?: unknown;
            backgroundImage?: unknown;
            tags?: unknown;
          })
        : null;

    const questionsSource = Array.isArray(raw)
      ? raw
      : Array.isArray(payload?.questions)
        ? payload?.questions
        : null;

    if (!questionsSource) {
      throw new Error(
        "Invalid JSON format. Expected an array of questions or an object with a `questions` array."
      );
    }

    const normalizeOptions = (options: unknown) => {
      const list = Array.isArray(options)
        ? options.map((opt) => String(opt ?? ""))
        : [];
      const trimmed = list.slice(0, 4);
      while (trimmed.length < 4) trimmed.push("");
      return trimmed;
    };

    const normalizeImportedAnswers = (
      candidate: unknown,
      options: string[]
    ): number[] => {
      const indices = new Set<number>();

      const parseIndex = (value: unknown): number | undefined => {
        if (typeof value === "number" && Number.isFinite(value)) {
          const idx = Math.trunc(value);
          if (idx >= 0 && idx < options.length) return idx;
          if (idx - 1 >= 0 && idx - 1 < options.length) return idx - 1;
          return undefined;
        }

        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed) return undefined;
          const letterMatch = trimmed.match(/^[a-d]$/i);
          if (letterMatch) {
            return letterMatch[0].toLowerCase().charCodeAt(0) - "a".charCodeAt(0);
          }
          const asNum = Number(trimmed);
          if (Number.isFinite(asNum)) {
            const idx = Math.trunc(asNum);
            if (idx >= 0 && idx < options.length) return idx;
            if (idx - 1 >= 0 && idx - 1 < options.length) return idx - 1;
          }
          const byText = options.findIndex((opt) => opt === trimmed);
          if (byText >= 0) return byText;
        }

        return undefined;
      };

      const addValue = (value: unknown) => {
        if (typeof value === "string" && /[,;|]/.test(value)) {
          value
            .split(/[,;|]/g)
            .map((part) => part.trim())
            .filter(Boolean)
            .forEach((part) => {
              const idx = parseIndex(part);
              if (typeof idx === "number") indices.add(idx);
            });
          return;
        }
        const idx = parseIndex(value);
        if (typeof idx === "number") indices.add(idx);
      };

      if (Array.isArray(candidate)) {
        candidate.forEach(addValue);
      } else if (typeof candidate !== "undefined") {
        addValue(candidate);
      }

      if (indices.size === 0) indices.add(0);

      return Array.from(indices).sort((a, b) => a - b);
    };

    const questions: EditableQuestion[] = [];
    for (const q of questionsSource) {
      if (!q || typeof q !== "object") continue;
      const obj = q as Record<string, unknown>;

      const text =
        (typeof obj.text === "string" && obj.text) ||
        (typeof obj.question === "string" && obj.question) ||
        (typeof obj.prompt === "string" && obj.prompt) ||
        "Untitled question";

      const options = normalizeOptions(obj.options ?? obj.choices);

      const candidate =
        typeof obj.correctAnswers !== "undefined"
          ? obj.correctAnswers
          : typeof obj.correctAnswer !== "undefined"
            ? obj.correctAnswer
            : typeof obj.answerIndex !== "undefined"
              ? obj.answerIndex
              : obj.answer;
      const correctAnswers = normalizeImportedAnswers(candidate, options);
      const durationSec = normalizeDurationSec(
        typeof obj.durationSec !== "undefined" ? obj.durationSec : obj.duration
      );

      const media =
        obj.media && typeof obj.media === "object"
          ? (obj.media as { kind?: unknown; src?: unknown; mime?: unknown })
          : null;
      const kind =
        media?.kind === "image" || media?.kind === "video"
          ? (media.kind as "image" | "video")
          : null;
      const src = typeof media?.src === "string" ? media.src : "";
      const mime = typeof media?.mime === "string" ? media.mime : undefined;

      if (kind && src) {
        questions.push({
          text,
          options,
          correctAnswers,
          durationSec,
          media: { kind, src, mime },
        });
      } else {
        questions.push({ text, options, correctAnswers, durationSec });
      }
    }

    if (questions.length === 0) {
      throw new Error("No valid questions found in JSON.");
    }

    return {
      title:
        payload && typeof payload.title === "string"
          ? payload.title
          : undefined,
      backgroundImage:
        payload && typeof payload.backgroundImage === "string"
          ? payload.backgroundImage
          : undefined,
      tags: payload?.tags,
      questions,
    };
  };

  const parseRawQuizText = (text: string) => {
    const stripDiacritics = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\u0111/g, "d")
        .replace(/\u0110/g, "D");

    const isAnswerLine = (line: string) => {
      const normalized = stripDiacritics(line).toLowerCase();
      return normalized.startsWith("dap an") || normalized.startsWith("answer");
    };

    const extractAnswerIndex = (line: string, optionCount: number) => {
      const afterColon = line.includes(":")
        ? line.split(":").slice(1).join(":")
        : line;
      const letters = afterColon.match(/[a-d]/gi) ?? [];
      if (letters.length > 0) {
        const letter = letters[0].toLowerCase();
        return letter.charCodeAt(0) - "a".charCodeAt(0);
      }
      const numbers = afterColon.match(/\d+/g) ?? [];
      if (numbers.length > 0) {
        const value = Number(numbers[0]);
        if (Number.isFinite(value)) {
          const idx = Math.trunc(value);
          if (idx >= 0 && idx < optionCount) return idx;
          if (idx - 1 >= 0 && idx - 1 < optionCount) return idx - 1;
        }
      }
      return 0;
    };

    const lines = text.split(/\r?\n/);
    const blocks: string[][] = [];
    let current: string[] = [];

    const pushCurrent = () => {
      if (current.length > 0) blocks.push(current);
      current = [];
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^\d+\.\s*/.test(trimmed) && current.length > 0) {
        pushCurrent();
      }
      current.push(trimmed);
    }
    pushCurrent();

    if (blocks.length === 0 && text.trim()) {
      blocks.push([text.trim()]);
    }

    const questions: EditableQuestion[] = [];
    for (const block of blocks) {
      let questionText = "";
      const options: string[] = [];
      let answerIndex: number | null = null;

      for (const rawLine of block) {
        if (!rawLine) continue;
        const line = rawLine.trim();
        if (!line) continue;

        if (isAnswerLine(line)) {
          answerIndex = extractAnswerIndex(line, options.length || 4);
          continue;
        }

        const optionMatch = line.match(/^\s*([a-d])[\.\)]\s*(.+)$/i);
        if (optionMatch) {
          const optionText = optionMatch[2]?.trim() ?? "";
          options.push(optionText);
          continue;
        }

        if (!questionText) {
          questionText = line.replace(/^\d+\.\s*/, "").trim();
          continue;
        }

        if (options.length === 0) {
          questionText = `${questionText} ${line}`.trim();
        }
      }

      if (!questionText && options.length === 0) continue;
      const normalizedOptions = options.slice(0, 4);
      while (normalizedOptions.length < 4) normalizedOptions.push("");
      const normalizedAnswer =
        answerIndex !== null
          ? Math.max(0, Math.min(normalizedOptions.length - 1, answerIndex))
          : 0;

      questions.push({
        text: questionText || "Untitled question",
        options: normalizedOptions,
        correctAnswers: [normalizedAnswer],
        durationSec: DEFAULT_QUESTION_DURATION_SEC,
      });
    }

    return { questions };
  };

  const applyImportedText = (text: string) => {
    try {
      const parsed = JSON.parse(text) as unknown;
      const { title, questions, backgroundImage, tags } =
        normalizeImportedQuestions(parsed);
      if (title) setBuilderTitle(title);
      setBuilderBackgroundImage(
        typeof backgroundImage === "string" && backgroundImage.trim()
          ? backgroundImage
          : undefined
      );
      setBuilderTagsText(normalizeTags(tags).join(", "));
      setBuilderQuestions(questions);
      setBuilderIndex(0);
      setBuilderQuizId(null);
      deletedQuestionStackRef.current = [];
      setDeletedQuestionStackSize(0);
      return;
    } catch (error) {
      const { questions } = parseRawQuizText(text);
      if (questions.length === 0) {
        const message =
          error instanceof Error ? error.message : "Invalid JSON or raw quiz format.";
        throw new Error(message);
      }
      setBuilderQuestions(questions);
      setBuilderIndex(0);
      setBuilderQuizId(null);
      setBuilderBackgroundImage(undefined);
      setBuilderTagsText("");
      deletedQuestionStackRef.current = [];
      setDeletedQuestionStackSize(0);
    }
  };

  useEffect(() => {
    setBuilderQuizId(quizId ?? null);
  }, [quizId]);

  useEffect(() => {
    if (!quizId) return;
    let active = true;
    setLoadingQuiz(true);
    const loadQuiz = async () => {
      try {
        const res = await fetch(`/api/quizzes/${encodeURIComponent(quizId)}`);
        if (!res.ok) {
          alert("Quiz not found.");
          router.push("/host");
          return;
        }
        const quiz = (await res.json()) as any;
        if (!active) return;
        setBuilderTitle(quiz.title || "Untitled Quiz");
        setBuilderBackgroundImage(
          typeof quiz.backgroundImage === "string" ? quiz.backgroundImage : undefined
        );
        setBuilderTagsText(normalizeTags(quiz.tags).join(", "));
        setBuilderQuestions(
          (quiz.questions || []).map((q: any) => ({
            text: q.text,
            options: q.options,
            correctAnswers: normalizeCorrectAnswers(
              typeof q.correctAnswers !== "undefined" ? q.correctAnswers : q.correctAnswer,
              Array.isArray(q.options) ? q.options : ["", "", "", ""]
            ),
            durationSec: normalizeDurationSec(q.durationSec),
            media: q.media,
          }))
        );
        setBuilderIndex(0);
        deletedQuestionStackRef.current = [];
        setDeletedQuestionStackSize(0);
      } catch (error) {
        console.error("Failed to load quiz:", error);
      } finally {
        if (active) setLoadingQuiz(false);
      }
    };

    loadQuiz();
    return () => {
      active = false;
    };
  }, [quizId, router]);

  const deleteBuilderQuestion = (index: number) => {
    const target = builderQuestions[index];
    if (target) {
      const replace = builderQuestions.length <= 1;
      deletedQuestionStackRef.current = [
        ...deletedQuestionStackRef.current,
        { question: target, index, replace },
      ];
      setDeletedQuestionStackSize(deletedQuestionStackRef.current.length);
    }

    setBuilderQuestions((prev) => {
      if (prev.length <= 1) {
        return [
          {
            text: "Untitled question",
            options: ["", "", "", ""],
            correctAnswers: [0],
            durationSec: DEFAULT_QUESTION_DURATION_SEC,
          },
        ];
      }
      return prev.filter((_, i) => i !== index);
    });
    setBuilderIndex((prevIndex) => {
      if (index < prevIndex) return prevIndex - 1;
      if (index === prevIndex) return Math.max(0, prevIndex - 1);
      return prevIndex;
    });
  };

  const undoDeleteBuilderQuestion = useCallback(() => {
    const stack = deletedQuestionStackRef.current;
    if (stack.length === 0) return;
    const last = stack[stack.length - 1];
    deletedQuestionStackRef.current = stack.slice(0, -1);
    setDeletedQuestionStackSize(deletedQuestionStackRef.current.length);
    setBuilderQuestions((prev) => {
      if (last.replace) {
        return [last.question];
      }
      const next = [...prev];
      const insertAt = Math.min(Math.max(last.index, 0), next.length);
      next.splice(insertAt, 0, last.question);
      return next;
    });
    setBuilderIndex(last.index);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") {
        return;
      }
      if (event.shiftKey) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTextInput =
        tagName === "input" || tagName === "textarea" || target?.isContentEditable;
      if (isTextInput) return;

      event.preventDefault();
      undoDeleteBuilderQuestion();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undoDeleteBuilderQuestion]);

  const saveQuiz = async () => {
    const sanitized = builderQuestions.map((q) => ({
      text: q.text,
      options: q.options,
      correctAnswers: q.correctAnswers,
      durationSec: normalizeDurationSec(q.durationSec),
      media: q.media,
    }));
    const tags = normalizeTags(builderTagsText);

    const url = builderQuizId ? `/api/quizzes/${builderQuizId}` : "/api/quizzes";
    const method = builderQuizId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: builderTitle,
        backgroundImage: builderBackgroundImage ?? null,
        tags,
        questions: sanitized,
      }),
    });

    if (!res.ok) {
      alert("Error saving quiz.");
      return;
    }

    router.push("/host");
    router.refresh();
  };

  const editorTitle = useMemo(() => {
    if (loadingQuiz) return "Loading quiz...";
    return builderTitle || "Untitled Quiz";
  }, [builderTitle, loadingQuiz]);

  return (
    <>
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const maxBytes = 8 * 1024 * 1024;
            if (file.size > maxBytes) {
              alert("Media is too large (max 8MB).");
              return;
            }

            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () => reject(new Error("read failed"));
              reader.onload = () => resolve(String(reader.result || ""));
              reader.readAsDataURL(file);
            });

            const kind = file.type.startsWith("video/") ? "video" : "image";
            setBuilderQuestions((prev) =>
              prev.map((q, i) =>
                i === builderIndex
                  ? { ...q, media: { kind, src: dataUrl, mime: file.type } }
                  : q
              )
            );
          } finally {
            e.target.value = "";
          }
        }}
      />
      <input
        ref={backgroundInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const maxBytes = 5 * 1024 * 1024;
            if (file.size > maxBytes) {
              alert("Background image is too large (max 5MB).");
              return;
            }

            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () => reject(new Error("read failed"));
              reader.onload = () => resolve(String(reader.result || ""));
              reader.readAsDataURL(file);
            });

            setBuilderBackgroundImage(dataUrl);
          } finally {
            e.target.value = "";
          }
        }}
      />

      <HostJsonImportInput
        inputRef={fileInputRef}
        onImportText={async (text) => {
          applyImportedText(text);
        }}
        onError={(message) => alert(message)}
      />

      {showJsonPaste ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white text-gray-900 shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Paste JSON</h2>
              <button
                onClick={() => setShowJsonPaste(false)}
                className="rounded-md border border-gray-200 px-3 py-1 text-gray-600"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-6">
              <textarea
                value={jsonPasteText}
                onChange={(e) => setJsonPasteText(e.target.value)}
                className="h-64 w-full rounded-xl border border-gray-200 p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-200"
                placeholder='{"title":"My Quiz","questions":[{"text":"Question?","options":["A","B"],"correctAnswers":[0],"durationSec":20}]}'
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowJsonPaste(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    try {
                      applyImportedText(jsonPasteText);
                      setJsonPasteText("");
                      setShowJsonPaste(false);
                    } catch (error) {
                      const message =
                        error instanceof Error ? error.message : "Invalid JSON";
                      alert(message);
                    }
                  }}
                  className="rounded-lg bg-teal-600 px-5 py-2 font-semibold text-white"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <HostBuilderScreen
        fileInputRef={fileInputRef}
        mediaInputRef={mediaInputRef}
        backgroundInputRef={backgroundInputRef}
        builderTitle={editorTitle}
        builderBackgroundImage={builderBackgroundImage}
        builderTagsText={builderTagsText}
        builderQuestions={builderQuestions}
        builderIndex={builderIndex}
        onBuilderTitleChange={setBuilderTitle}
        onBuilderTagsChange={setBuilderTagsText}
        onSetBackgroundImage={setBuilderBackgroundImage}
        onSelectQuestion={setBuilderIndex}
        onAddQuestion={() =>
          setBuilderQuestions((prev) => [
            ...prev,
            {
              text: "New question",
              options: ["", "", "", ""],
              correctAnswers: [0],
              durationSec: DEFAULT_QUESTION_DURATION_SEC,
            },
          ])
        }
        onDeleteQuestion={deleteBuilderQuestion}
        onReorderQuestion={(fromIndex, toIndex) => {
          setBuilderQuestions((prev) => {
            if (fromIndex < 0 || fromIndex >= prev.length) return prev;
            if (toIndex < 0 || toIndex >= prev.length) return prev;
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return next;
          });
          setBuilderIndex((prevIndex) => {
            if (prevIndex === fromIndex) return toIndex;
            if (fromIndex < prevIndex && toIndex >= prevIndex) return prevIndex - 1;
            if (fromIndex > prevIndex && toIndex <= prevIndex) return prevIndex + 1;
            return prevIndex;
          });
        }}
        onUpdateQuestionText={(text) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) => (i === builderIndex ? { ...q, text } : q))
          )
        }
        onUpdateDuration={(durationSec) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) => (i === builderIndex ? { ...q, durationSec } : q))
          )
        }
        onUpdateOption={(optionIndex, value) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) =>
              i === builderIndex
                ? {
                    ...q,
                    options: q.options.map((o, oi) =>
                      oi === optionIndex ? value : o
                    ),
                  }
                : q
            )
          )
        }
        onToggleCorrect={(optionIndex) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) => {
              if (i !== builderIndex) return q;
              const current = q.correctAnswers ?? [];
              const has = current.includes(optionIndex);
              const next = has
                ? current.filter((idx) => idx !== optionIndex)
                : [...current, optionIndex];
              const normalized = next.length > 0 ? next : [optionIndex];
              return { ...q, correctAnswers: normalized.sort((a, b) => a - b) };
            })
          )
        }
        onSetMedia={(media) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) => (i === builderIndex ? { ...q, media } : q))
          )
        }
        onCancel={() => router.push("/host")}
        onOpenPasteJson={() => {
          setJsonPasteText("");
          setShowJsonPaste(true);
        }}
        canUndoDelete={deletedQuestionStackSize > 0}
        onUndoDelete={undoDeleteBuilderQuestion}
        onSave={saveQuiz}
      />
    </>
  );
}
