"use client";

import { avatarForName } from "@/lib/avatar";

type PlayerHeaderBarProps = {
  name: string;
  score: number;
};

export function PlayerHeaderBar({ name, score }: PlayerHeaderBarProps) {
  return (
    <div className="w-full max-w-2xl mb-6 text-center">
      <div className="bg-white rounded-2xl shadow-lg px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex h-12 w-12 items-center justify-center text-4xl">
            {avatarForName(name || "Player")}
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm text-gray-600 font-semibold">Player</p>
            <p className="truncate text-2xl font-black tracking-tight text-purple-700">
              {name}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm text-gray-600 font-semibold">Score</p>
          <p className="text-3xl font-black tabular-nums text-green-600">
            {score}
          </p>
        </div>
      </div>
    </div>
  );
}
