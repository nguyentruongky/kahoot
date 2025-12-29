"use client";

import type { Player } from "@/app/host/game/types";
import { avatarForName } from "@/app/host/game/utils";

type LobbyPlayerCardProps = {
  player: Player;
};

export function LobbyPlayerCard({ player }: LobbyPlayerCardProps) {
  return (
    <div
      className="inline-flex h-24 w-fit max-w-full items-center gap-4 rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/10 backdrop-blur-sm"
      title={player.name}
    >
      <div className="flex h-20 w-20 items-center justify-center text-5xl drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
        {avatarForName(player.name)}
      </div>
      <div className="min-w-0">
        <div className="max-w-[18rem] truncate text-2xl pr-4 font-black tracking-tight sm:max-w-88 sm:text-3xl">
          {player.name}
        </div>
      </div>
    </div>
  );
}
