"use client";

import type { Player } from "@/app/host/game/types";
import { PseudoQrCode } from "@/components/PseudoQrCode";
import { LobbyPlayersGrid } from "@/app/host/game/_components/LobbyPlayersGrid";

type CopyState = "idle" | "copied";

type HostLobbyScreenProps = {
  backgroundClassName: string;
  activeQuizTitle: string;
  pin: string;
  joinDisplayUrl: string;
  joinLinkCopyState: CopyState;
  players: Player[];
  startEnabled: boolean;
  onExit: () => void;
  onEndGame: () => void;
  onStart: () => void;
  onCopyJoinLink: () => void;
};

export function HostLobbyScreen({
  backgroundClassName,
  activeQuizTitle,
  pin,
  joinDisplayUrl,
  joinLinkCopyState,
  players,
  startEnabled,
  onExit,
  onEndGame,
  onStart,
  onCopyJoinLink,
}: HostLobbyScreenProps) {
  return (
    <div
      className={`relative min-h-screen overflow-hidden text-white ${backgroundClassName}`}
    >
      <div className="absolute inset-0 bg-black/10" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex items-center justify-between gap-5 border-b border-white/10 bg-black/20 px-6 py-5 backdrop-blur">
         <div />
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/25 ring-1 ring-white/10">
                <span className="text-xl">👤</span>
              </div>
              <div className="text-xl font-extrabold tabular-nums">
                {players.length}
              </div>
            </div>

            <button
              type="button"
              onClick={onEndGame}
              className="h-11 rounded-xl bg-red-500/90 px-5 text-base font-extrabold text-white shadow-sm ring-1 ring-white/10 hover:bg-red-500 sm:h-12 sm:px-6 sm:text-lg"
            >
              End
            </button>

            <button
              type="button"
              onClick={onStart}
              disabled={!startEnabled}
              className="h-11 rounded-xl bg-white px-6 text-base font-extrabold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:px-8 sm:text-lg"
            >
              Start
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 items-stretch px-6 py-8">
          <div className="mx-auto w-full max-w-7xl">
            <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <div className="h-full rounded-2xl bg-black/25 p-6 ring-1 ring-white/10 backdrop-blur">
                  <div className="flex flex-col items-center text-center">
                    <div className="rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10">
                      <PseudoQrCode
                        data={joinDisplayUrl}
                        size={280}
                        className="rounded-lg"
                        label="Join game QR code"
                      />
                    </div>

                    <div className="mt-6 text-3xl font-extrabold tracking-tight">
                      {activeQuizTitle || "Loading quiz…"}
                    </div>

                    <div className="mt-3 text-sm font-semibold uppercase tracking-widest text-white/70">
                      Game PIN
                    </div>
                    <button
                      type="button"
                      onClick={onCopyJoinLink}
                      className="mt-1 text-6xl font-black tracking-[0.22em] hover:text-white/90"
                      title="Copy join link"
                    >
                      {pin || "—"}
                    </button>

                    <div className="mt-3 text-sm text-white/75">
                      {joinLinkCopyState === "copied"
                        ? "Join link copied."
                        : "Click the PIN to copy the join link."}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8">
                <div className="flex h-full min-h-0 flex-col rounded-2xl bg-black/25 p-6 ring-1 ring-white/10 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl font-extrabold tracking-tight">
                        Players
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15 sm:hidden">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/25 ring-1 ring-white/10">
                        <span className="text-xl">👤</span>
                      </div>
                      <div className="text-xl font-extrabold tabular-nums">
                        {players.length}
                      </div>
                    </div>
                  </div>

                  {players.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center px-6 py-10 text-lg text-white/75">
                      Waiting for players to join…
                    </div>
                  ) : (
                    <LobbyPlayersGrid players={players} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
