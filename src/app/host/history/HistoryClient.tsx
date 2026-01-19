"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type HistorySummary = {
  pin: string;
  quizId: string;
  startedAt?: string;
  endedAt?: string;
  totalPlayers?: number;
  leaderboard?: { name: string; score: number; rank?: number }[];
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

export function HistoryClient() {
  const [history, setHistory] = useState<HistorySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/game-history");
        if (!res.ok) return;
        const data = (await res.json()) as HistorySummary[];
        if (active) setHistory(Array.isArray(data) ? data : []);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const hasHistory = history.length > 0;
  const items = useMemo(
    () =>
      history.map((entry) => ({
        ...entry,
        topPlayers: (entry.leaderboard ?? []).slice(0, 3),
      })),
    [history],
  );

  return (
    <div className="min-h-screen bg-[#0f0a1f] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
              Host
            </p>
            <h1 className="mt-2 text-3xl font-bold">Game History</h1>
            <p className="mt-1 text-sm text-white/60">
              Browse finished games and export detailed reports.
            </p>
          </div>
          <Link
            href="/host"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/30"
          >
            Back to Host
          </Link>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white/70">
            Loading game history…
          </div>
        ) : hasHistory ? (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((entry) => (
              <Link
                key={`${entry.pin}-${entry.endedAt}`}
                href={`/host/history/${encodeURIComponent(entry.pin)}`}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/60">PIN</div>
                  <div className="text-lg font-semibold tracking-[0.2em]">
                    {entry.pin}
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-white/60">
                  <div>Started: {formatDate(entry.startedAt)}</div>
                  <div>Ended: {formatDate(entry.endedAt)}</div>
                  <div>Players: {entry.totalPlayers ?? 0}</div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                    Top Players
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.topPlayers.length > 0 ? (
                      entry.topPlayers.map((player) => (
                        <span
                          key={player.name}
                          className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80"
                        >
                          {player.name} · {player.score}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-white/50">
                        No leaderboard data
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/70">
            No game history yet. Finish a game to see reports here.
          </div>
        )}
      </div>
    </div>
  );
}
