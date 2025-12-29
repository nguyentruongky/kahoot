"use client";

import type { RefObject } from "react";
import { KahootCheckIcon } from "@/components/KahootCheckIcon";
import {
  kahootShapeForIndex,
  KahootShapeIcon,
} from "@/components/KahootShapeIcon";

type EditableQuestion = {
  text: string;
  options: string[];
  correctAnswer: number;
};

type HostBuilderScreenProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  builderTitle: string;
  builderQuestions: EditableQuestion[];
  builderIndex: number;
  onBuilderTitleChange: (value: string) => void;
  onSelectQuestion: (index: number) => void;
  onAddQuestion: () => void;
  onUpdateQuestionText: (text: string) => void;
  onUpdateOption: (optionIndex: number, value: string) => void;
  onSelectCorrect: (optionIndex: number) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function HostBuilderScreen({
  fileInputRef,
  builderTitle,
  builderQuestions,
  builderIndex,
  onBuilderTitleChange,
  onSelectQuestion,
  onAddQuestion,
  onUpdateQuestionText,
  onUpdateOption,
  onSelectCorrect,
  onCancel,
  onSave,
}: HostBuilderScreenProps) {
  const active = builderQuestions[builderIndex];

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

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
          >
            Import JSON
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

            <div className="mt-6 h-48 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center text-gray-500">
              <span className="text-2xl mb-2">🖼️</span>
              <p className="font-semibold">Drop image or video here</p>
              <p className="text-sm">You can drag and drop or click to upload.</p>
              <button className="mt-4 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700">
                Upload Media
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(active?.options ?? []).map((opt, idx) => {
              const colors = [
                "bg-red-500",
                "bg-blue-500",
                "bg-yellow-500",
                "bg-green-500",
              ];
              const isCorrect = active?.correctAnswer === idx;

              return (
                <div
                  key={idx}
                  className={`${colors[idx % 4]} text-white rounded-2xl p-4 shadow-lg`}
                >
                  <div className="flex items-center gap-3">
                    <KahootShapeIcon
                      kind={kahootShapeForIndex(idx)}
                      className="h-7 w-7 text-white"
                    />

                    <input
                      value={opt}
                      onChange={(e) => onUpdateOption(idx, e.target.value)}
                      className="flex-1 bg-white/10 rounded-lg px-3 py-2 outline-none placeholder:text-white/70"
                      placeholder={`Answer ${idx + 1}`}
                    />

                    <button
                      onClick={() => onSelectCorrect(idx)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                        isCorrect
                          ? "bg-white text-green-600 border-white"
                          : "border-white/60 text-white/80"
                      }`}
                    >
                      <KahootCheckIcon className="h-4 w-4" />
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

