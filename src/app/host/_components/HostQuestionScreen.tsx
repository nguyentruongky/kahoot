"use client";

import type { Player } from "@/app/host/game/types";
import {
  kahootShapeForIndex,
  KahootShapeIcon,
} from "@/components/KahootShapeIcon";

type Question = {
  text: string;
  options: string[];
  correctAnswer: number;
};

type HostQuestionScreenProps = {
  pin: string;
  players: Player[];
  answers: Array<{ answer: number }>;
  questionIndex: number;
  questionSetLength: number;
  timer: number;
  currentQuestion: Question;
  showResults: boolean;
  onQuitGame: () => void;
  onSkipToResults: () => void;
  onNextQuestion: () => void;
};

export function HostQuestionScreen({
  pin,
  players,
  answers,
  questionIndex,
  questionSetLength,
  timer,
  currentQuestion,
  showResults,
  onQuitGame,
  onSkipToResults,
  onNextQuestion,
}: HostQuestionScreenProps) {
  return (
    <div className="bg-white text-gray-900 rounded-3xl shadow-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-purple-600 font-semibold">Game PIN: {pin}</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-700">Players: {players.length}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-gray-700">
            {answers.length} / {players.length} answers
          </span>

          <button
            onClick={onQuitGame}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Quit Game
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">
          Question {questionIndex - 1} of {questionSetLength}
        </p>
        <div className="w-12 h-12 rounded-full border-4 border-purple-200 flex items-center justify-center text-purple-700 font-bold">
          {timer}
        </div>
      </div>

      <div className="w-full bg-gray-200 h-2 rounded-full mb-6">
        <div
          className="h-2 rounded-full bg-purple-500 transition-all duration-1000"
          style={{ width: `${(timer / 20) * 100}%` }}
        />
      </div>

      <div className="bg-gray-100 rounded-2xl p-6 mb-6">
        <h3 className="text-2xl font-bold text-center">{currentQuestion.text}</h3>
      </div>

      {!showResults ? (
        <div className="grid grid-cols-2 gap-4">
          {currentQuestion.options.map((opt, idx) => {
            const colors = [
              "bg-red-500",
              "bg-blue-500",
              "bg-yellow-500",
              "bg-green-500",
            ];

            return (
              <div
                key={idx}
                className={`${colors[idx % 4]} text-white p-5 rounded-xl flex items-center gap-3 text-lg font-semibold`}
              >
                <KahootShapeIcon
                  kind={kahootShapeForIndex(idx)}
                  className="h-7 w-7 text-white"
                />
                {opt}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {currentQuestion.options.map((opt, idx) => {
            const count = answers.filter((a) => a.answer === idx).length;
            const percentage = answers.length ? (count / answers.length) * 100 : 0;
            const isCorrect = idx === currentQuestion.correctAnswer;

            return (
              <div
                key={idx}
                className={`border rounded-xl p-4 flex items-center justify-between ${
                  isCorrect ? "border-green-400 bg-green-50" : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{opt}</span>
                  {isCorrect && (
                    <span className="text-xs px-2 py-1 rounded bg-green-500 text-white">
                      Correct
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  <span>{count} answers</span>
                  <span className="text-gray-400">|</span>
                  <span>{percentage.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}

          <div className="flex justify-end gap-3">
            <button
              onClick={onSkipToResults}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
            >
              Skip to Results
            </button>

            <button
              onClick={onNextQuestion}
              className="px-5 py-2 rounded-lg bg-purple-600 text-white font-semibold"
            >
              Next Question
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

