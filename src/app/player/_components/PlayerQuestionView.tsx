"use client";

import type { Question } from "@/app/player/types";
import {
  kahootShapeForIndex,
  KahootShapeIcon,
} from "@/components/KahootShapeIcon";

type PlayerQuestionViewProps = {
  question: Question;
  answered: boolean;
  answersRevealed: boolean;
  selectedAnswer: number | null;
  getAnswerClassName: (index: number) => string;
  onSelectAnswer: (index: number) => void;
};

export function PlayerQuestionView({
  question,
  answered,
  answersRevealed,
  selectedAnswer,
  getAnswerClassName,
  onSelectAnswer,
}: PlayerQuestionViewProps) {
  return (
    <div className="w-full max-w-2xl">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800">{question.text}</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => onSelectAnswer(index)}
            disabled={answered}
            className={`${getAnswerClassName(index)} ${
              answered && !answersRevealed && selectedAnswer === index
                ? "ring-4 ring-white/80"
                : ""
            } text-white font-bold py-8 px-6 rounded-xl shadow-lg transform transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:transform-none`}
          >
            <div className="mb-2 flex justify-center">
              <KahootShapeIcon
                kind={kahootShapeForIndex(index)}
                className="h-10 w-10 text-white"
              />
            </div>
            <div className="text-lg">{option}</div>
          </button>
        ))}
      </div>

      {answered && !answersRevealed && (
        <div className="mt-6 p-4 rounded-lg text-center text-white font-bold text-xl bg-gray-700">
          {selectedAnswer === null
            ? "⏰ Time's up! Waiting for host…"
            : "Answer submitted! Waiting for host…"}
        </div>
      )}
    </div>
  );
}
