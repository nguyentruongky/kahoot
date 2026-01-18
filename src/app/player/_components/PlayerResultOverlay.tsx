"use client";

import type { ResultPopupState } from "@/app/player/types";
import { QuizzaCheckIcon } from "@/components/QuizzaCheckIcon";

type PlayerResultOverlayProps = {
  popup: ResultPopupState;
  totalScore: number;
};

export function PlayerResultOverlay({
  popup,
  totalScore,
}: PlayerResultOverlayProps) {
  const bgClass =
    popup.variant === "success"
      ? "bg-[#66bb2e]"
      : popup.variant === "danger"
      ? "bg-[#e53935]"
      : "bg-[#f4b400]";

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${bgClass}`}>
      <div className="w-full max-w-md px-6 py-10 text-center text-white">
        <h3 className="text-6xl font-extrabold tracking-tight drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]">
          {popup.title}
        </h3>

        <div className="mt-6 flex items-center justify-center">
          <div className="text-7xl font-black drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]">
            {popup.variant === "success" ? (
              <QuizzaCheckIcon className="h-20 w-20 text-white" />
            ) : popup.variant === "danger" ? (
              "✕"
            ) : (
              "⏱"
            )}
          </div>
        </div>

        <div className="mt-10 flex items-center justify-center gap-3 text-2xl font-extrabold drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">
          <span>Answer Streak</span>
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-orange-500 shadow-[0_4px_0_rgba(0,0,0,0.25)] border border-white/30">
            {popup.streak}
          </span>
        </div>

        <div className="mt-8 rounded-lg overflow-hidden shadow-[0_10px_0_rgba(0,0,0,0.18)]">
          <div className="bg-black/35 px-6 py-5 text-5xl font-extrabold tracking-tight">
            + {popup.points}
          </div>
        </div>

        <p className="mt-10 text-3xl font-extrabold drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">
          {popup.variant === "success"
            ? "You're on the podium!"
            : popup.variant === "danger"
            ? "Try again next time!"
            : "Waiting for next question…"}
        </p>

        <p className="mt-3 text-white/90 font-semibold">
          Total: {totalScore} pts
        </p>
      </div>
    </div>
  );
}
