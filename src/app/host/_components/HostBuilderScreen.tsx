"use client";

import type { CSSProperties, RefObject } from "react";
import { QuizzaCheckIcon } from "@/components/QuizzaCheckIcon";
import {
  quizzaShapeForIndex,
  QuizzaShapeIcon,
} from "@/components/QuizzaShapeIcon";
import { padOptions } from "@/lib/quizDefaults";
import { BACKGROUND_BASE_CLASS, backgroundStyle } from "@/lib/backgrounds";

type EditableQuestion = {
  text: string;
  options: string[];
  correctAnswers: number[];
  durationSec: number;
  media?: { kind: "image" | "video"; src: string; mime?: string };
};

type HostBuilderScreenProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  mediaInputRef?: RefObject<HTMLInputElement | null>;
  backgroundInputRef?: RefObject<HTMLInputElement | null>;
  builderTitle: string;
  builderBackgroundImage?: string;
  builderTagsText: string;
  builderQuestions: EditableQuestion[];
  builderIndex: number;
  onBuilderTitleChange: (value: string) => void;
  onBuilderTagsChange: (value: string) => void;
  onSetBackgroundImage: (value?: string) => void;
  onSelectQuestion: (index: number) => void;
  onAddQuestion: () => void;
  onDeleteQuestion: (index: number) => void;
  onReorderQuestion: (fromIndex: number, toIndex: number) => void;
  onUpdateQuestionText: (text: string) => void;
  onUpdateDuration: (durationSec: number) => void;
  onUpdateOption: (optionIndex: number, value: string) => void;
  onToggleCorrect: (optionIndex: number) => void;
  onSetMedia: (media?: EditableQuestion["media"]) => void;
  onCancel: () => void;
  onOpenPasteJson: () => void;
  canUndoDelete: boolean;
  onUndoDelete: () => void;
  onSave: () => void;
};

const themeVars: CSSProperties = {
  "--builder-font": '"Space Grotesk", "IBM Plex Sans", sans-serif',
  "--builder-mono": '"IBM Plex Mono", "SFMono-Regular", Menlo, monospace',
  "--builder-ink": "#e5e7eb",
  "--builder-muted": "rgba(148, 163, 184, 0.78)",
  "--builder-surface": "rgba(15, 23, 42, 0.92)",
  "--builder-border": "rgba(148, 163, 184, 0.2)",
  "--builder-accent": "#22d3ee",
  "--builder-accent-strong": "#06b6d4",
  "--builder-heat": "#f97316",
  "--builder-primary": "#a855f7",
} as CSSProperties;

export function HostBuilderScreen({
  fileInputRef,
  mediaInputRef,
  backgroundInputRef,
  builderTitle,
  builderBackgroundImage,
  builderTagsText,
  builderQuestions,
  builderIndex,
  onBuilderTitleChange,
  onBuilderTagsChange,
  onSetBackgroundImage,
  onSelectQuestion,
  onAddQuestion,
  onDeleteQuestion,
  onReorderQuestion,
  onUpdateQuestionText,
  onUpdateDuration,
  onUpdateOption,
  onToggleCorrect,
  onSetMedia,
  onCancel,
  onOpenPasteJson,
  canUndoDelete,
  onUndoDelete,
  onSave,
}: HostBuilderScreenProps) {
  const active = builderQuestions[builderIndex];
  const optionsForEdit = padOptions(active?.options ?? [], 4);
  const optionEntries = optionsForEdit.map((opt, index) => ({ opt, index }));
  const optionColors = ["#f97316", "#2563eb", "#0d9488", "#f59e0b"];
  const hasBackground = Boolean(builderBackgroundImage);

  return (
    <div
      className="relative min-h-screen overflow-hidden text-(--builder-ink) font-(--builder-font)"
      style={{
        ...themeVars,
        background:
          "radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.18), transparent 55%), radial-gradient(circle at 90% 0%, rgba(168, 85, 247, 0.18), transparent 45%), radial-gradient(circle at 50% 100%, rgba(14, 165, 233, 0.12), transparent 60%), #0b1220",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-[-15%] top-[-25%] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,#22d3ee_0%,rgba(34,211,238,0)_70%)] blur-2xl" />
        <div className="absolute right-[-12%] top-[8%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,#a855f7_0%,rgba(168,85,247,0)_70%)] blur-2xl" />
        <div className="absolute bottom-[-18%] left-[25%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,#0ea5e9_0%,rgba(14,165,233,0)_70%)] blur-2xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="relative flex flex-col gap-6 rounded-3xl border border-(--builder-border) bg-(--builder-surface) p-6 shadow-[0_24px_50px_rgba(2,6,23,0.6)] animate-[builder-fade_700ms_ease-out]">
          <button
            type="button"
            onClick={() => backgroundInputRef?.current?.click()}
            className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-[0_12px_24px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(15,23,42,0.45)]"
            aria-label="Upload background image"
            title="Upload background image"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h4l1.5-2h5L16 7h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          </button>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#a855f7,#22d3ee)] text-xl text-white shadow-[0_16px_36px_rgba(34,211,238,0.28)]">
                ✦
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-(--builder-muted)">
                  Quiz Builder
                </p>
                <input
                  value={builderTitle}
                  onChange={(e) => onBuilderTitleChange(e.target.value)}
                  className="mt-2 w-full bg-transparent text-3xl font-semibold tracking-tight text-white outline-none placeholder:text-(--builder-muted) sm:text-4xl"
                  placeholder="Untitled quiz"
                />
                <input
                  value={builderTagsText}
                  onChange={(e) => onBuilderTagsChange(e.target.value)}
                  className="mt-4 w-full rounded-2xl border border-(--builder-border) bg-slate-900/80 px-4 py-3 text-sm font-medium text-white shadow-inner placeholder:text-(--builder-muted)"
                  placeholder="Tags (comma separated)"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canUndoDelete ? (
              <button
                onClick={onUndoDelete}
                className="rounded-full border border-(--builder-border) px-4 py-2 text-sm font-semibold text-(--builder-ink) transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-slate-900"
              >
                Undo delete
              </button>
            ) : null}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-(--builder-accent)/40 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-(--builder-accent) transition hover:-translate-y-0.5 hover:border-(--builder-accent) hover:bg-slate-900"
            >
              Import JSON
            </button>
            <button
              onClick={onOpenPasteJson}
              className="rounded-full border border-(--builder-heat)/40 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-(--builder-heat) transition hover:-translate-y-0.5 hover:border-(--builder-heat) hover:bg-slate-900"
            >
              Paste JSON
            </button>
            <button
              onClick={onSave}
              className="rounded-full bg-(--builder-primary) px-6 py-2 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(168,85,247,0.35)] transition hover:-translate-y-0.5 hover:bg-[#9333ea]"
            >
              Save Quiz
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="flex flex-col gap-4 rounded-3xl border border-(--builder-border) bg-(--builder-surface) p-5 shadow-[0_24px_42px_rgba(2,6,23,0.55)] animate-[builder-rise_650ms_ease-out]">
            <div className="flex items-center justify-between text-(--builder-muted)">
              <p className="text-xs font-semibold uppercase tracking-[0.3em]">
                Questions
              </p>
              <p className="text-sm font-medium">
                {builderQuestions.length} total
              </p>
            </div>

            <p className="text-sm font-medium text-white/70">Drag to reorder</p>

            <div className="space-y-3">
              {builderQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectQuestion(idx)}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", String(idx));
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const raw = event.dataTransfer.getData("text/plain");
                    const fromIndex = Number(raw);
                    if (!Number.isFinite(fromIndex)) return;
                    if (fromIndex === idx) return;
                    onReorderQuestion(fromIndex, idx);
                  }}
                  className={`group w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${
                    builderIndex === idx
                      ? "border-(--builder-primary) bg-slate-950/70 shadow-[0_14px_28px_rgba(168,85,247,0.2)]"
                      : "border-transparent bg-slate-900/60 hover:border-(--builder-border) hover:bg-slate-900/80"
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-(--builder-muted)">
                        {idx + 1}.
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteQuestion(idx);
                        }}
                        className="shrink-0 rounded-full border border-transparent px-3 py-1 text-xs font-semibold text-(--builder-muted) transition hover:border-(--builder-heat) hover:text-(--builder-heat)"
                      >
                        Delete
                      </button>
                    </div>
                    <div
                      className="text-sm font-semibold text-slate-200"
                      style={{
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                        overflow: "hidden",
                      }}
                    >
                      {q.text || "Untitled question"}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={onAddQuestion}
              className="mt-auto w-full rounded-2xl bg-(--builder-accent) px-4 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_32px_rgba(34,211,238,0.35)] transition hover:-translate-y-0.5 hover:bg-(--builder-accent-strong)"
            >
              + Add question
            </button>
          </aside>

          <section className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-(--builder-border) bg-(--builder-surface) p-6 shadow-[0_22px_40px_rgba(2,6,23,0.55)] animate-[builder-rise_760ms_ease-out]">
              {hasBackground ? (
                <>
                  <div
                    className={`absolute inset-0 ${BACKGROUND_BASE_CLASS}`}
                    style={backgroundStyle(builderBackgroundImage)}
                  />
                  <div className="absolute inset-0 bg-linear-to-b from-slate-950/85 via-slate-950/55 to-slate-950/90" />
                </>
              ) : (
                <div className="absolute inset-0 bg-linear-to-br from-slate-900/70 via-slate-950/80 to-slate-900/70" />
              )}
              <div className="relative">
                <input
                  value={active?.text || ""}
                  onChange={(e) => onUpdateQuestionText(e.target.value)}
                  className="w-full rounded-2xl border border-(--builder-border) bg-slate-950/70 px-4 py-4 text-2xl font-semibold text-white outline-none placeholder:text-(--builder-muted)"
                  placeholder="Type your question..."
                />

                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-4 rounded-2xl border border-(--builder-border) bg-slate-950/70 px-4 py-3 shadow-inner">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--builder-muted)">
                        Time Limit
                      </p>
                      <p className="text-sm text-(--builder-muted)">
                        Seconds per question
                      </p>
                    </div>
                    <input
                      type="number"
                      min={5}
                      max={300}
                      step={5}
                      value={active?.durationSec ?? 20}
                      onChange={(e) =>
                        onUpdateDuration(
                          Math.max(
                            5,
                            Math.min(300, Number(e.target.value) || 20),
                          ),
                        )
                      }
                      className="w-24 rounded-xl border border-(--builder-border) bg-slate-900 px-3 py-2 text-center text-base font-semibold text-white "
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-dashed border-(--builder-border) bg-slate-950/50 p-5">
                  {active?.media ? (
                    <button
                      type="button"
                      onClick={() => onSetMedia(undefined)}
                      className="rounded-full border border-(--builder-border) px-4 py-2 text-xs font-semibold text-(--builder-muted) transition hover:bg-slate-900"
                    >
                      Remove media
                    </button>
                  ) : null}

                  {active?.media ? (
                    <div className="mt-5 overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/10">
                      {active.media.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={active.media.src}
                          alt="Question media"
                          className="w-full max-h-72 object-contain bg-white"
                        />
                      ) : (
                        <video
                          src={active.media.src}
                          controls
                          playsInline
                          className="w-full max-h-72 bg-black"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-(--builder-border) bg-slate-900/60 px-6 py-10 text-center">
                      <span className="text-3xl">🎞️</span>
                      <p className="mt-3 text-base font-semibold text-white">
                        Drop image or video here
                      </p>
                      <p className="mt-1 text-sm text-(--builder-muted)">
                        Drag in a file or click upload to add media.
                      </p>
                      <button
                        type="button"
                        onClick={() => mediaInputRef?.current?.click()}
                        className="mt-4 rounded-full border border-(--builder-border) bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-(--builder-accent) hover:text-(--builder-accent)"
                      >
                        Upload Media
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {optionEntries.map(({ opt, index }) => {
                    const isCorrect =
                      active?.correctAnswers?.includes(index) ?? false;
                    return (
                      <div
                        key={index}
                        className="rounded-2xl p-px"
                        style={{
                          background: `linear-gradient(135deg, ${optionColors[index % 4]}, #ffffff)`,
                        }}
                      >
                        <div className="rounded-2xl bg-slate-950/70 p-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-inner"
                              style={{
                                backgroundColor: optionColors[index % 4],
                              }}
                            >
                              <QuizzaShapeIcon
                                kind={quizzaShapeForIndex(index)}
                                className="h-6 w-6 text-white"
                              />
                            </div>
                            <input
                              value={opt}
                              onChange={(e) =>
                                onUpdateOption(index, e.target.value)
                              }
                              className="flex-1 border-b border-transparent bg-transparent text-base font-semibold text-white outline-none placeholder:text-(--builder-muted) focus:border-(--builder-border)"
                              placeholder={`Answer ${index + 1}`}
                            />
                            <button
                              onClick={() => onToggleCorrect(index)}
                              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                                isCorrect
                                  ? "border-(--builder-primary) bg-(--builder-primary) text-white shadow-[0_10px_20px_rgba(168,85,247,0.35)]"
                                  : "border-(--builder-border) text-(--builder-muted)"
                              }`}
                            >
                              <QuizzaCheckIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap");

        @keyframes builder-fade {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes builder-rise {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
