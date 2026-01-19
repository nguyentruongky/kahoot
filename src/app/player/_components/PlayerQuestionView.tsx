"use client";

import type { Question } from "@/app/player/types";
import {
  quizzaShapeForIndex,
  QuizzaShapeIcon,
} from "@/components/QuizzaShapeIcon";
import { trimTrailingEmptyOptions } from "@/lib/quizDefaults";

type PlayerQuestionViewProps = {
  question: Question;
  answered: boolean;
  answersRevealed: boolean;
  selectedAnswers: number[];
  allowMultiSelect: boolean;
  getAnswerClassName: (index: number) => string;
  onToggleAnswer: (index: number) => void;
  onSubmitAnswers: () => void;
};

export function PlayerQuestionView({
  question,
  answered,
  answersRevealed,
  selectedAnswers,
  allowMultiSelect,
  getAnswerClassName,
  onToggleAnswer,
  onSubmitAnswers,
}: PlayerQuestionViewProps) {
  const optionEntries = trimTrailingEmptyOptions(question.options)
    .map((opt, index) => ({ opt, index }))
    .filter((entry) => entry.opt.trim() !== "");

  return (
    <div className="w-full max-w-2xl">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6 text-center">
        {question.media?.src && (
          <div className="mb-5 overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/10">
            {question.media.kind === "video" ? (
              <video
                src={question.media.src}
                controls
                playsInline
                className="w-full max-h-80 bg-black"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={question.media.src}
                alt="Question media"
                className="w-full max-h-80 object-contain bg-white"
              />
            )}
          </div>
        )}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-800">{question.text}</h2>
          {allowMultiSelect ? (
            <p className="text-sm font-semibold text-gray-500">
              Select all that apply.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {optionEntries.map(({ opt, index }) => (
          <button
            key={index}
            onClick={() => onToggleAnswer(index)}
            disabled={answered}
            className={`${getAnswerClassName(index)} ${
              selectedAnswers.includes(index) &&
              (!answered || (!answersRevealed && answered))
                ? "ring-4 ring-white/80"
                : ""
            } text-white font-bold py-8 px-6 rounded-xl shadow-lg transform transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:transform-none`}
          >
            <div className="mb-2 flex justify-center">
              <QuizzaShapeIcon
                kind={quizzaShapeForIndex(index)}
                className="h-10 w-10 text-white"
              />
            </div>
            <div className="text-lg">{opt}</div>
          </button>
        ))}
      </div>

      {answered && !answersRevealed && (
        <div className="mt-6 p-4 rounded-lg text-center text-white font-bold text-xl bg-gray-700">
          {selectedAnswers.length === 0
            ? "⏰ Time's up! Waiting for host…"
            : "Answer submitted! Waiting for host…"}
        </div>
      )}

      {!answered && allowMultiSelect ? (
        <button
          type="button"
          onClick={onSubmitAnswers}
          disabled={selectedAnswers.length === 0}
          className="mt-6 w-full rounded-xl bg-gray-900 px-6 py-4 text-lg font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          Submit answers
        </button>
      ) : null}
    </div>
  );
}
