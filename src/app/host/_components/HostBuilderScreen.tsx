"use client";

import type { RefObject } from "react";
import { QuizzaCheckIcon } from "@/components/QuizzaCheckIcon";
import {
  quizzaShapeForIndex,
  QuizzaShapeIcon,
} from "@/components/QuizzaShapeIcon";
import { padOptions, trimTrailingEmptyOptions } from "@/lib/quizDefaults";

type EditableQuestion = {
  text: string;
  options: string[];
  correctAnswer: number;
  media?: { kind: "image" | "video"; src: string; mime?: string };
};

type HostBuilderScreenProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  mediaInputRef?: RefObject<HTMLInputElement | null>;
  builderTitle: string;
  builderQuestions: EditableQuestion[];
  builderIndex: number;
  onBuilderTitleChange: (value: string) => void;
  onSelectQuestion: (index: number) => void;
  onAddQuestion: () => void;
  onDeleteQuestion: (index: number) => void;
  onUpdateQuestionText: (text: string) => void;
  onUpdateOption: (optionIndex: number, value: string) => void;
  onSelectCorrect: (optionIndex: number) => void;
  onSetMedia: (media?: EditableQuestion["media"]) => void;
  onCancel: () => void;
  onOpenPasteJson: () => void;
  canUndoDelete: boolean;
  onUndoDelete: () => void;
  onSave: () => void;
};

export function HostBuilderScreen({
  fileInputRef,
  mediaInputRef,
  builderTitle,
  builderQuestions,
  builderIndex,
  onBuilderTitleChange,
  onSelectQuestion,
  onAddQuestion,
  onDeleteQuestion,
  onUpdateQuestionText,
  onUpdateOption,
  onSelectCorrect,
  onSetMedia,
  onCancel,
  onOpenPasteJson,
  canUndoDelete,
  onUndoDelete,
  onSave,
}: HostBuilderScreenProps) {
  const active = builderQuestions[builderIndex];
  const visibleOptions = trimTrailingEmptyOptions(active?.options ?? []);
  const optionsForEdit =
    visibleOptions.length === 0 ? padOptions(visibleOptions, 2) : visibleOptions;
  const optionEntries = optionsForEdit.map((opt, index) => ({ opt, index }));

  return (
    <div className="bg-white text-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[600px] max-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between px-8 py-5 border-b shrink-0">
        <div className="flex items-center gap-3 w-1/2">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
            ✦
          </div>
          <div className="w-full">
            <p className="text-sm text-gray-500">Quiz Builder</p>
            <input
              value={builderTitle}
              onChange={(e) => onBuilderTitleChange(e.target.value)}
              className="text-2xl font-bold outline-none w-full"
              placeholder="Quiz title"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
          >
            Cancel
          </button>

          {canUndoDelete ? (
            <button
              onClick={onUndoDelete}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            >
              Undo delete
            </button>
          ) : null}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
          >
            Import JSON
          </button>

          <button
            onClick={onOpenPasteJson}
            className="px-4 py-2 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
          >
            Paste JSON
          </button>

          <button
            onClick={onSave}
            className="px-5 py-2 rounded-lg bg-purple-600 text-white font-semibold"
          >
            Save Quiz
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 flex-1 min-h-0">
        <aside className="col-span-3 border-r bg-gray-50 p-6 space-y-4 min-h-0 overflow-y-auto">
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            Questions
          </p>

          {builderQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => onSelectQuestion(idx)}
              className={`w-full text-left p-3 rounded-xl border ${
                builderIndex === idx
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="text-xs text-gray-400">Question {idx + 1}</div>
              <div className="font-semibold truncate">{q.text || "Untitled"}</div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteQuestion(idx);
                  }}
                  className="text-xs text-gray-500 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </button>
          ))}

          <button
            onClick={onAddQuestion}
            className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold"
          >
            + Add question
          </button>
        </aside>

        <main className="col-span-9 p-8 space-y-6 min-h-0 overflow-y-auto">
          <div className="bg-gray-100 rounded-2xl p-6">
            <input
              value={active?.text || ""}
              onChange={(e) => onUpdateQuestionText(e.target.value)}
              className="w-full text-2xl font-bold bg-white rounded-xl p-4 border border-gray-200 outline-none"
              placeholder="Type your question..."
            />

            <div className="mt-6 rounded-2xl border-2 border-dashed border-gray-300 bg-white/60 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {active?.media && (
                    <button
                      type="button"
                      onClick={() => onSetMedia(undefined)}
                      className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

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
                <div className="mt-5 h-48 rounded-2xl  flex flex-col items-center justify-center text-gray-500">
                  <span className="text-2xl mb-2">🖼️</span>
                  <p className="font-semibold">Drop image or video here</p>
                  <p className="text-sm">
                    You can drag and drop or click to upload.
                  </p>
                  <button
                    type="button"
                    onClick={() => mediaInputRef?.current?.click()}
                    className="mt-4 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700"
                  >
                    Upload Media
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {optionEntries.map(({ opt, index }) => {
              const colors = [
                "bg-red-500",
                "bg-blue-500",
                "bg-yellow-500",
                "bg-green-500",
              ];
              const isCorrect = active?.correctAnswer === index;

              return (
                <div
                  key={index}
                  className={`${colors[index % 4]} text-white rounded-2xl p-4 shadow-lg`}
                >
                  <div className="flex items-center gap-3">
                    <QuizzaShapeIcon
                      kind={quizzaShapeForIndex(index)}
                      className="h-7 w-7 text-white"
                    />

                    <input
                      value={opt}
                      onChange={(e) => onUpdateOption(index, e.target.value)}
                      className="flex-1  rounded-lg px-3 py-2 outline-none placeholder:text-white/70"
                      placeholder={`Answer ${index + 1}`}
                    />

                    <button
                      onClick={() => onSelectCorrect(index)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                        isCorrect
                          ? "bg-white text-green-600 border-white"
                          : "border-white/60 text-white/80"
                      }`}
                    >
                      <QuizzaCheckIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
