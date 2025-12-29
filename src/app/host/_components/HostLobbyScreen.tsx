"use client";

import type { Player } from "@/app/host/game/types";
import { avatarForName } from "@/lib/avatar";

type HostLobbyScreenProps = {
  activeQuizTitle: string;
  pin: string;
  players: Player[];
  onCopyPin: () => void;
  onStartGame: () => void;
};

export function HostLobbyScreen({
  activeQuizTitle,
  pin,
  players,
  onCopyPin,
  onStartGame,
}: HostLobbyScreenProps) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center bg-linear-to-b from-[#120d25] to-[#0f0a1f] rounded-3xl border border-white/10">
      <p className="text-purple-200 mb-2">Waiting for players…</p>
      <h2 className="text-4xl font-bold mb-2">{activeQuizTitle}</h2>

      <p className="text-purple-100 mt-6 mb-2">Join with PIN</p>

      <button
        onClick={onCopyPin}
        className="bg-black/40 rounded-2xl px-10 py-6 border border-white/10 shadow-2xl hover:border-purple-300/50 transition mb-6"
      >
        <div className="text-6xl font-extrabold tracking-[0.3rem]">{pin}</div>
      </button>

      <button
        onClick={onStartGame}
        className="px-10 py-4 rounded-2xl bg-linear-to-r from-purple-500 to-pink-500 text-lg font-semibold shadow-lg hover:scale-[1.02] transition"
      >
        Start Game
      </button>

      <div className="mt-8 w-full max-w-4xl">
        <p className="text-center mb-4 text-purple-200">
          {players.length} Player{players.length !== 1 ? "s" : ""} Joined
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {players.map((p) => (
            <div
              key={p.name}
              className="bg-white/10 border border-white/20 rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-2">
                <span className="text-4xl h-10 flex items-center justify-center">
                  {avatarForName(p.name)}
                </span>
                <span className="font-semibold text-white">{p.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

