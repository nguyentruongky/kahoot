"use client";

import type { FinalPopupState } from "@/app/player/types";

type PlayerFinalResultsModalProps = {
  popup: FinalPopupState;
  playerName: string;
  onJoinAnother: () => void;
};

export function PlayerFinalResultsModal({
  popup,
  playerName,
  onJoinAnother,
}: PlayerFinalResultsModalProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-linear-to-br from-fuchsia-600 via-purple-700 to-indigo-900 p-6">
      <div className="absolute inset-0 opacity-80">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl" />
        <div className="absolute top-1/3 -right-28 h-80 w-80 rounded-full bg-yellow-200/25 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-80 w-80 rounded-full bg-pink-300/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-[32px] border border-white/20 bg-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.55)] overflow-hidden backdrop-blur-xl">
        <div className="p-8 text-center text-white">
          <p className="text-white/70 font-semibold">Final Results</p>
          <h2 className="mt-2 text-4xl font-extrabold tracking-tight">
            Game Over
          </h2>

          {(() => {
            const rank = popup.rank;
            if (typeof rank !== "number") return null;
            if (rank === 1)
              return (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-yellow-300/25 px-4 py-2 text-sm font-extrabold text-yellow-50 ring-1 ring-yellow-200/40">
                  <span className="text-base">🏆</span> Winner
                </div>
              );
            if (rank === 2)
              return (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-extrabold text-white ring-1 ring-white/20">
                  <span className="text-base">🥈</span> Runner-up
                </div>
              );
            if (rank === 3)
              return (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-300/20 px-4 py-2 text-sm font-extrabold text-amber-50 ring-1 ring-amber-200/35">
                  <span className="text-base">🥉</span> Top 3
                </div>
              );
            return null;
          })()}

          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/12 border border-white/15 p-5">
              <p className="text-white/70 text-sm">Total score</p>
              <p className="mt-2 text-3xl font-black">{popup.score}</p>
            </div>
            <div className="rounded-2xl bg-white/12 border border-white/15 p-5">
              <p className="text-white/70 text-sm">Position</p>
              <p className="mt-2 text-3xl font-black">
                {typeof popup.rank === "number" ? `#${popup.rank}` : "—"}
              </p>
              {typeof popup.totalPlayers === "number" && (
                <p className="text-white/60 text-xs mt-1">
                  out of {popup.totalPlayers}
                </p>
              )}
            </div>
          </div>

          {Array.isArray(popup.leaderboardWindow) &&
            popup.leaderboardWindow.length > 0 && (
            <div className="mt-7 rounded-2xl border border-white/15 bg-black/15 p-4 text-left ring-1 ring-white/10">
              <p className="text-sm font-semibold text-white/85 px-1">
                Standings
              </p>
              <div className="mt-3 space-y-2">
                {popup.leaderboardWindow.map((p) => {
                  const isMe = p.name === playerName;
                  const rank = typeof p.rank === "number" ? p.rank : null;
                  const rowTone =
                    rank === 1
                      ? "bg-yellow-300/25 ring-yellow-200/30"
                      : rank === 2
                      ? "bg-white/18 ring-white/25"
                      : rank === 3
                      ? "bg-amber-300/20 ring-amber-200/25"
                      : "bg-black/15 ring-white/10";
                  const meTone = isMe ? "ring-2 ring-purple-200/60" : "";
                  const medal =
                    rank === 1
                      ? "🥇"
                      : rank === 2
                      ? "🥈"
                      : rank === 3
                      ? "🥉"
                      : null;

                  return (
                    <div
                      key={p.name}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 ring-1 ${rowTone} ${meTone}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-12 text-white/80 font-mono text-sm">
                          {typeof p.rank === "number" ? `#${p.rank}` : "—"}
                        </span>
                        {medal && (
                          <span className="w-6 text-lg leading-none">
                            {medal}
                          </span>
                        )}
                        <span
                          className={`truncate font-semibold ${
                            isMe ? "text-white" : "text-white/90"
                          }`}
                        >
                          {p.name}
                        </span>
                        {isMe && (
                          <span className="shrink-0 text-xs font-semibold text-purple-100">
                            You
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-white">
                        {p.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={onJoinAnother}
            className="mt-8 w-full rounded-2xl bg-white text-purple-900 font-extrabold py-3 hover:bg-white/90 transition shadow-[0_10px_0_rgba(0,0,0,0.18)] active:translate-y-0.5 active:shadow-[0_6px_0_rgba(0,0,0,0.18)]"
          >
            Join Another Game
          </button>
        </div>
      </div>
    </div>
  );
}
