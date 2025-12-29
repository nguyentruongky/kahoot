"use client";

import type { Player } from "@/app/host/game/types";
import { LobbyPlayerCard } from "@/app/host/game/_components/LobbyPlayerCard";

type LobbyPlayersGridProps = {
  players: Player[];
};

export function LobbyPlayersGrid({ players }: LobbyPlayersGridProps) {
  return (
    <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-start gap-3">
        {players.map((player) => (
          <LobbyPlayerCard key={player.name} player={player} />
        ))}
      </div>
    </div>
  );
}
