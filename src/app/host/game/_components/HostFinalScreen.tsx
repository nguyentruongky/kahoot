"use client";

import type { Player } from "@/app/host/game/types";
import { avatarForName } from "@/app/host/game/utils";

type HostFinalScreenProps = {
  backgroundClassName: string;
  activeQuizTitle: string;
  pin: string;
  players: Player[];
  onBackToHost: () => void;
};

export function HostFinalScreen({
  backgroundClassName,
  activeQuizTitle,
  pin,
  players,
  onBackToHost,
}: HostFinalScreenProps) {
  const leaderboard = players
    .slice()
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const leaderboardWithRank = (() => {
    let lastScore: number | null = null;
    let lastRank = 0;
    return leaderboard.map((p, index) => {
      if (lastScore === null || p.score !== lastScore) {
        lastRank = index + 1;
        lastScore = p.score;
      }
      return { ...p, rank: lastRank };
    });
  })();

  const downloadCsv = () => {
    const csvEscape = (value: unknown) => {
      const raw = String(value ?? "");
      const needsQuotes = /[",\n\r]/.test(raw);
      const escaped = raw.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };

    const header = ["Rank", "Name", "Score"];
    const body = leaderboardWithRank.map((p) => [p.rank, p.name, p.score]);
    const csv = [header, ...body]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = (activeQuizTitle || "quiz")
      .trim()
      .slice(0, 40)
      .replace(/[^\w.-]+/g, "_");
    a.href = url;
    a.download = `results_${safeTitle || "quiz"}_${pin || "pin"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const top = leaderboard.slice(0, 3);
  const podium = Array.from({ length: 3 }, (_, idx) => {
    return (
      top[idx] ?? {
        name: "Waiting for players…",
        score: 0,
      }
    );
  });

  const medal = [
    {
      label: "1",
      medal: "bg-linear-to-br from-yellow-300 to-amber-500",
      ring: "ring-yellow-200/60",
      cardHeight: "h-[460px]",
      cardTop: "mt-0",
    },
    {
      label: "2",
      medal: "bg-linear-to-br from-slate-200 to-slate-400",
      ring: "ring-white/25",
      cardHeight: "h-[420px]",
      cardTop: "mt-12",
    },
    {
      label: "3",
      medal: "bg-linear-to-br from-amber-300 to-orange-500",
      ring: "ring-amber-200/50",
      cardHeight: "h-[400px]",
      cardTop: "mt-16",
    },
  ] as const;

  const order = [1, 0, 2] as const; // 2nd, 1st, 3rd

  return (
    <div
      className={`relative min-h-screen overflow-hidden text-white ${backgroundClassName}`}
    >
      <div className="absolute inset-0 bg-black/10" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <div className="absolute right-6 top-6 flex items-center gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
            title="Download CSV"
          >
            Download CSV
          </button>
          <button
            onClick={onBackToHost}
            className="rounded-full bg-black/35 px-4 py-3 text-sm font-semibold text-white/90 ring-1 ring-white/15 hover:bg-black/45"
          >
            Back to Host
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center py-14">
          <div className="relative w-full">
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center rounded-2xl bg-white/12 px-8 py-4 text-4xl font-extrabold tracking-tight ring-1 ring-white/15 backdrop-blur">
                {activeQuizTitle || "Final Results"}
              </div>
            </div>

            <div className="mx-auto flex max-w-4xl items-end justify-center gap-6">
              {order.map((podiumIndex) => {
                const place = podiumIndex + 1;
                const player = podium[podiumIndex];
                const meta = medal[podiumIndex];
                const isPlaceholder = player.name === "Waiting for players…";

                return (
                  <div
                    key={`${place}-${player.name}`}
                    className="w-[220px] sm:w-60 md:w-[280px]"
                  >
                    <div className="mb-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        {!isPlaceholder && (
                          <span className="text-4xl leading-none">
                            {avatarForName(player.name)}
                          </span>
                        )}
                        <div className="text-3xl font-black tracking-tight sm:text-4xl">
                          {isPlaceholder ? "—" : player.name}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`relative overflow-hidden rounded-3xl bg-white/12 shadow-2xl ring-1 ring-white/15 backdrop-blur ${meta.cardHeight} ${meta.cardTop}`}
                    >
                      <div className="absolute left-0 right-0 top-0 h-12 bg-linear-to-b from-white/15 to-transparent" />

                      <div className="flex h-full flex-col items-center justify-start pt-10">
                        <div
                          className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-2xl ring-4 ${meta.ring} ${meta.medal}`}
                        >
                          <div className="absolute -top-10 left-1/2 h-12 w-24 -translate-x-1/2 rounded-b-3xl bg-linear-to-b from-sky-300/70 to-indigo-500/25 blur-[0px]" />
                          <div className="absolute -top-10 left-1/2 h-12 w-24 -translate-x-1/2 rounded-b-3xl bg-linear-to-r from-pink-400/40 via-sky-300/30 to-fuchsia-400/40 opacity-70" />
                          <div className="text-5xl font-black leading-none text-white/95 drop-shadow">
                            {isPlaceholder
                              ? meta.label
                              : avatarForName(player.name)}
                          </div>
                        </div>

                        <div className="mt-7 text-center">
                          <div className="text-4xl font-black tabular-nums">
                            {isPlaceholder ? "0" : player.score}
                          </div>
                          <div className="mt-2 text-2xl font-bold text-white/85">
                            pts
                          </div>
                        </div>

                        <div className="mt-auto w-full px-10 pb-8">
                          <div className="flex items-center justify-center rounded-2xl bg-black/25 px-5 py-3 ring-1 ring-white/10">
                            <span className="text-lg font-semibold text-white/85">
                              {place}
                              {place === 1
                                ? "st"
                                : place === 2
                                ? "nd"
                                : "rd"}{" "}
                              place
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
