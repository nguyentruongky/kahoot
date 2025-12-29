"use client";

import { avatarForName } from "@/lib/avatar";

type PlayerWaitingCardProps = {
  playerName: string;
};

export function PlayerWaitingCard({ playerName }: PlayerWaitingCardProps) {
  return (
    <div className="w-full max-w-md rounded-[28px] border border-white/20 bg-white/10 p-10 text-center text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-black/15 text-6xl ring-1 ring-white/15">
        {avatarForName(playerName || "Player")}
      </div>

      <div className="mt-6 text-4xl font-black tracking-tight">
        {playerName || "Player"}
      </div>

      <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-black/20 px-5 py-3 text-base font-semibold text-white/90 ring-1 ring-white/15">
        <span className="inline-flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce"></span>
          <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce delay-100"></span>
          <span className="h-2 w-2 rounded-full bg-white/80 animate-bounce delay-200"></span>
        </span>
        Waiting for host to start…
      </div>
    </div>
  );
}
