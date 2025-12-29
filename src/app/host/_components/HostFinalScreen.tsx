"use client";

import type { Player } from "@/app/host/game/types";

type HostFinalScreenProps = {
  finalResults: Player[];
  players: Player[];
  onPlayAgain: () => void;
};

export function HostFinalScreen({
  finalResults,
  players,
  onPlayAgain,
}: HostFinalScreenProps) {
  return (
    <div className="bg-white text-gray-900 rounded-3xl shadow-2xl p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">Game Over</p>
          <h2 className="text-3xl font-bold">Here are your winners</h2>
        </div>

        <button
          onClick={onPlayAgain}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
        >
          Play Again
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {finalResults.map((p, idx) => {
          const colors = ["border-yellow-400", "border-gray-400", "border-amber-300"];
          const titles = ["1st Place", "2nd Place", "3rd Place"];

          return (
            <div
              key={p.name}
              className={`rounded-2xl border-2 ${colors[idx]} p-4 bg-gray-50`}
            >
              <p className="text-sm text-gray-500">{titles[idx]}</p>
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className="text-purple-600 font-semibold">{p.score} pts</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <p className="font-semibold">Final Leaderboard</p>
        </div>

        <div className="divide-y">
          {players
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((p, idx) => (
              <div key={p.name} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center font-bold text-gray-600">
                    {idx + 1}
                  </span>
                  <span className="font-semibold">{p.name}</span>
                </div>
                <span className="text-purple-600 font-bold">{p.score} pts</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

