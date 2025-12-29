"use client";

import type { CSSProperties } from "react";
import type {
  Player,
  PlayerAnswerPayload,
  QuizQuestion,
} from "@/app/host/game/types";
import { avatarForName } from "@/app/host/game/utils";
import {
  kahootShapeForIndex,
  KahootShapeIcon,
} from "@/components/KahootShapeIcon";
import { KahootCheckIcon } from "@/components/KahootCheckIcon";

type HostQuestionScreenProps = {
  backgroundClassName: string;
  backgroundStyle?: CSSProperties;
  showResults: boolean;
  postQuestionScreen: "results" | "scoreboard";
  currentQuestion: QuizQuestion;
  players: Player[];
  answers: PlayerAnswerPayload[];
  effectiveTimer: number;
  durationSec: number;
  questionIndex: number;
  questionSetLength: number;
  pin: string;
  onEndGame: () => void;
  onNext: () => void;
};

export function HostQuestionScreen({
  backgroundClassName,
  backgroundStyle,
  showResults,
  postQuestionScreen,
  currentQuestion,
  players,
  answers,
  effectiveTimer,
  durationSec,
  questionIndex,
  questionSetLength,
  pin,
  onEndGame,
  onNext,
}: HostQuestionScreenProps) {
  return (
    <div
      className={`relative min-h-screen h-screen overflow-hidden text-white ${backgroundClassName}`}
      style={backgroundStyle}
    >
      <div className="absolute inset-0 bg-black/10" />

      {showResults ? (
        <div className="relative z-10 flex h-screen flex-col px-6 pt-6 pb-16">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onEndGame}
              className="rounded-lg bg-red-500/90 px-5 py-3 text-lg font-bold text-white shadow ring-1 ring-white/10 hover:bg-red-500"
            >
              End Game
            </button>

            <button
              type="button"
              onClick={onNext}
              className="rounded-lg bg-white px-5 py-3 text-lg font-bold text-gray-900 shadow ring-1 ring-black/10 hover:bg-white/90"
            >
              Next
            </button>
          </div>

          <div className="mt-4 flex justify-center">
            <div className="w-full max-w-5xl rounded-xl bg-white px-8 py-5 shadow-2xl ring-1 ring-black/10">
              <h2 className="text-center text-4xl font-extrabold tracking-tight text-gray-900">
                {postQuestionScreen === "scoreboard"
                  ? "Scoreboard"
                  : currentQuestion?.text}
              </h2>
            </div>
          </div>

          <div className="mt-6 min-h-0 flex-1">
            {(() => {
              if (postQuestionScreen === "scoreboard") {
                const leaderboard = players
                  .slice()
                  .sort((a, b) => b.score - a.score);
                const topPlayers = leaderboard.slice(0, 10);

              return (
                <div className="h-full overflow-y-auto px-2 pb-6">
                  {topPlayers.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-lg font-semibold text-white/80">
                      No scores yet.
                    </div>
                  ) : (
                    <div className="mx-auto w-full max-w-5xl space-y-3">
                      {topPlayers.map((p) => (
                        <div
                          key={p.name}
                          className="flex h-20 items-center justify-between rounded-xl bg-white px-6 shadow-2xl ring-1 ring-black/10"
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center text-3xl">
                              {avatarForName(p.name)}
                            </div>
                            <div className="truncate text-3xl font-extrabold tracking-tight text-gray-900">
                              {p.name}
                            </div>
                          </div>
                          <div className="text-4xl font-black tabular-nums text-gray-900">
                            {p.score}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
              }

              const options = (currentQuestion?.options ?? []).slice(0, 4);
              const counts = options.map(
                (_, idx) => answers.filter((a) => a.answer === idx).length
              );
              const maxCount = Math.max(1, ...counts);
              const meta = [
                {
                  bg: "bg-red-600/85",
                  bar: "bg-red-500",
                  tile: "bg-red-600",
                  chip: "bg-red-600/90",
                  shape: kahootShapeForIndex(0),
                },
                {
                  bg: "bg-blue-600/85",
                  bar: "bg-blue-500",
                  tile: "bg-blue-600",
                  chip: "bg-blue-600/90",
                  shape: kahootShapeForIndex(1),
                },
                {
                  bg: "bg-yellow-600/85",
                  bar: "bg-yellow-500",
                  tile: "bg-yellow-600",
                  chip: "bg-yellow-600/90",
                  shape: kahootShapeForIndex(2),
                },
                {
                  bg: "bg-green-700/85",
                  bar: "bg-green-500",
                  tile: "bg-green-700",
                  chip: "bg-green-700/90",
                  shape: kahootShapeForIndex(3),
                },
              ] as const;

              return (
              <>
                <div className="flex min-h-0 flex-1 items-end justify-center pb-2 pt-6">
                  <div className="w-full max-w-6xl">
                    <div className="relative h-[46vh] min-h-[320px] max-h-[460px]">
                      <div className="absolute inset-0 grid h-full grid-cols-[repeat(4,112px)] items-stretch justify-center gap-3 px-4">
                        {counts.map((count, idx) => {
                          const heightPct = (count / maxCount) * 100;
                          const barHeight =
                            count === 0 ? 0 : Math.max(18, heightPct);
                          const isCorrect =
                            idx === currentQuestion?.correctAnswer;

                          return (
                            <div
                              key={idx}
                              className="flex h-full items-end justify-center"
                            >
                              <div className="flex h-full w-28 flex-col items-center justify-end overflow-hidden rounded-xl">
                                <div className="relative w-28 flex-1">
                                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black/30" />
                                  <div
                                    className={`absolute inset-x-0 bottom-0 shadow-2xl ring-1 ring-black/25 ${meta[idx].bar}`}
                                    style={{ height: `${barHeight}%` }}
                                    title={`${count} answers`}
                                  />
                                </div>
                                <div
                                  className={`flex h-14 w-full items-center px-4 text-white shadow-2xl ring-1 ring-black/25 ${meta[idx].chip}`}
                                >
                                  <KahootShapeIcon
                                    kind={meta[idx].shape}
                                    className="h-7 w-7 shrink-0 text-white"
                                  />
                                  <span className="ml-3 text-4xl font-black tabular-nums">
                                    {count}
                                  </span>
                                  {isCorrect && (
                                    <span className="ml-auto">
                                      <KahootCheckIcon className="h-7 w-7 shrink-0 text-white/95" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid flex-none grid-cols-2 gap-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
                  {options.map((opt, idx) => {
                    const isCorrect = idx === currentQuestion?.correctAnswer;
                    return (
                      <div
                        key={idx}
                        className={`relative h-[112px] ${meta[idx].tile}`}
                      >
                        <div className="relative flex h-full items-center justify-between px-8">
                          <div className="flex items-center gap-5">
                            <KahootShapeIcon
                              kind={meta[idx].shape}
                              className="h-10 w-10 text-white"
                            />
                            <div className="text-3xl font-extrabold tracking-tight text-white/90">
                              {opt}
                            </div>
                          </div>
                          <div className="text-4xl font-black text-white/70">
                            {isCorrect ? (
                              <KahootCheckIcon className="h-10 w-10 text-white/85" />
                            ) : (
                              "✕"
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
              );
            })()}
          </div>

          <div className="absolute bottom-0 left-0 right-0">
            <div className="flex h-14 items-center justify-between bg-linear-to-r from-purple-950/60 via-indigo-950/60 to-fuchsia-950/60 px-6 text-white/90 backdrop-blur ring-1 ring-white/10">
              <div className="font-semibold tabular-nums">
                {Math.max(1, questionIndex - 1)}/{Math.max(1, questionSetLength)}
              </div>
              <div className="font-semibold">
                <span className="opacity-90">kahoot.it</span>
                <span className="mx-3 opacity-60">•</span>
                <span className="opacity-90">Game PIN:</span>{" "}
                <span className="font-extrabold tracking-wide">{pin}</span>
              </div>
              <div className="w-20" />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex h-screen flex-col px-6 pt-6 pb-6">
          <div className="flex items-center justify-end">
            <button
              onClick={onEndGame}
              className="rounded-lg bg-red-500/90 px-5 py-3 text-lg font-bold text-white shadow ring-1 ring-white/10 hover:bg-red-500"
            >
              End Game
            </button>
          </div>

          <div className="mt-6 flex min-h-0 flex-1 items-center justify-center">
            <div className="w-full max-w-6xl">
              <div className="rounded-3xl bg-white/92 p-10 text-gray-900 shadow-2xl ring-1 ring-black/10 backdrop-blur">
                <div className="flex flex-col items-center gap-6">
                  <p className="text-base font-semibold text-gray-500">
                    Question {questionIndex - 1} of {questionSetLength}
                  </p>

                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-purple-200 text-3xl font-black tabular-nums text-purple-700">
                      {effectiveTimer}
                    </div>
                    <div className="text-base font-semibold text-gray-600">
                      {answers.length} / {players.length} answered
                    </div>
                  </div>
                </div>

                <div className="mt-8 h-3 w-full rounded-full bg-gray-200">
                  <div
                    className="h-3 rounded-full bg-purple-500 transition-all duration-1000"
                    style={{
                      width: `${
                        (effectiveTimer / Math.max(1, durationSec)) * 100
                      }%`,
                    }}
                  />
                </div>

                <div className="mt-9 rounded-2xl bg-gray-100 px-10 py-9">
                  <h3 className="text-center text-4xl font-extrabold tracking-tight">
                    {currentQuestion?.text}
                  </h3>
                </div>

                <div className="mt-9 grid grid-cols-2 gap-5">
                  {(currentQuestion?.options ?? []).map((opt, idx) => {
                    const colors = [
                      "bg-red-500",
                      "bg-blue-500",
                      "bg-yellow-500",
                      "bg-green-500",
                    ];

                    return (
                      <div
                        key={idx}
                        className={`${
                          colors[idx % 4]
                        } flex min-h-[92px] items-center gap-4 rounded-2xl p-7 text-2xl font-extrabold text-white`}
                      >
                        <KahootShapeIcon
                          kind={kahootShapeForIndex(idx)}
                          className="h-9 w-9 text-white"
                        />
                        {opt}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
