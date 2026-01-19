"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type PlayerResult = {
  name: string;
  answer: number | number[] | null;
  correct: boolean;
  points: number;
  timeLeftSec: number;
};

type QuestionHistory = {
  questionId: number;
  text: string;
  options: string[];
  correctAnswers: number[];
  startedAt: string;
  durationSec: number;
  results: PlayerResult[];
};

type PlayerSnapshot = { name: string; score: number; rank?: number };

type GameHistory = {
  pin: string;
  quizId: string;
  startedAt?: string;
  endedAt?: string;
  totalPlayers: number;
  players: PlayerSnapshot[];
  leaderboard: PlayerSnapshot[];
  leaderboardAll: PlayerSnapshot[];
  questions: QuestionHistory[];
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const formatAnswer = (answer: number | number[] | null, options: string[]) => {
  if (answer === null || typeof answer === "undefined") return "—";
  const values = Array.isArray(answer) ? answer : [answer];
  return values
    .map((idx) => {
      const option = options[idx];
      if (typeof option === "string" && option.trim()) {
        return `${idx + 1}. ${option}`;
      }
      return `${idx + 1}`;
    })
    .join(", ");
};

const formatCorrect = (answers: number[], options: string[]) => {
  if (!answers || answers.length === 0) return "—";
  return answers
    .map((idx) => {
      const option = options[idx];
      if (typeof option === "string" && option.trim()) {
        return `${idx + 1}. ${option}`;
      }
      return `${idx + 1}`;
    })
    .join(", ");
};

export function HistoryDetailClient() {
  const params = useParams<{ pin?: string | string[] }>();
  const rawPin = params?.pin;
  const pin =
    typeof rawPin === "string"
      ? rawPin
      : Array.isArray(rawPin)
        ? rawPin[0] ?? ""
        : "";
  const [history, setHistory] = useState<GameHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pin) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/game-history/${encodeURIComponent(pin)}`);
        if (!res.ok) return;
        const data = (await res.json()) as GameHistory;
        if (active) setHistory(data);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [pin]);

  const exportCsv = () => {
    if (!history) return;
    const rows: string[][] = [];
    rows.push([
      "pin",
      "quizId",
      "startedAt",
      "endedAt",
      "totalPlayers",
    ]);
    rows.push([
      history.pin,
      history.quizId,
      history.startedAt ?? "",
      history.endedAt ?? "",
      String(history.totalPlayers ?? 0),
    ]);
    rows.push([]);
    rows.push(["Final leaderboard"]);
    rows.push(["rank", "name", "score"]);
    (history.leaderboardAll ?? []).forEach((player) => {
      rows.push([
        String(player.rank ?? ""),
        player.name,
        String(player.score ?? 0),
      ]);
    });
    rows.push([]);
    rows.push([
      "questionIndex",
      "questionText",
      "player",
      "answer",
      "correct",
      "points",
      "timeLeftSec",
      "correctAnswers",
    ]);
    history.questions.forEach((question, index) => {
      const correctAnswers = formatCorrect(
        question.correctAnswers,
        question.options ?? [],
      );
      question.results.forEach((result) => {
        rows.push([
          String(index + 1),
          question.text,
          result.name,
          formatAnswer(result.answer, question.options ?? []),
          result.correct ? "true" : "false",
          String(result.points ?? 0),
          String(result.timeLeftSec ?? 0),
          correctAnswers,
        ]);
      });
    });

    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "");
            if (/[",\n]/.test(value)) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `game_${history.pin}_report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    if (!history) return;
    const html = `
      <html>
        <head>
          <title>Game ${history.pin} Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
            h1 { margin: 0 0 8px; }
            h2 { margin-top: 24px; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Game Report</h1>
          <div><strong>PIN:</strong> ${history.pin}</div>
          <div><strong>Started:</strong> ${formatDate(history.startedAt)}</div>
          <div><strong>Ended:</strong> ${formatDate(history.endedAt)}</div>
          <div><strong>Total Players:</strong> ${history.totalPlayers}</div>

          <h2>Final Leaderboard</h2>
          <table>
            <thead>
              <tr><th>Rank</th><th>Name</th><th>Score</th></tr>
            </thead>
            <tbody>
              ${(history.leaderboardAll ?? [])
                .map(
                  (player) =>
                    `<tr><td>${player.rank ?? ""}</td><td>${player.name}</td><td>${player.score ?? 0}</td></tr>`,
                )
                .join("")}
            </tbody>
          </table>

          <h2>Question Results</h2>
          ${(history.questions ?? [])
            .map(
              (question, index) => `
                <h3>${index + 1}. ${question.text}</h3>
                <p><strong>Correct:</strong> ${formatCorrect(
                  question.correctAnswers,
                  question.options ?? [],
                )}</p>
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Answer</th>
                      <th>Correct</th>
                      <th>Points</th>
                      <th>Time Left (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${question.results
                      .map(
                        (result) => `
                          <tr>
                            <td>${result.name}</td>
                            <td>${formatAnswer(
                              result.answer,
                              question.options ?? [],
                            )}</td>
                            <td>${result.correct ? "Yes" : "No"}</td>
                            <td>${result.points ?? 0}</td>
                            <td>${result.timeLeftSec ?? 0}</td>
                          </tr>
                        `,
                      )
                      .join("")}
                  </tbody>
                </table>
              `,
            )
            .join("")}
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const questionCount = history?.questions?.length ?? 0;
  const sortedQuestions = useMemo(() => {
    if (!history) return [];
    return [...history.questions].sort(
      (a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""),
    );
  }, [history]);

  return (
    <div className="min-h-screen bg-[#0f0a1f] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
              Game Report
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              PIN {pin || "—"} · {questionCount} questions
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Started {formatDate(history?.startedAt)} · Ended{" "}
              {formatDate(history?.endedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0f0a1f] hover:bg-white/90"
            >
              Export PDF
            </button>
            <Link
              href="/host/history"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
            >
              Back to History
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white/70">
            Loading game report…
          </div>
        ) : history ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold">Final Leaderboard</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(history.leaderboardAll ?? []).map((player) => (
                  <div
                    key={player.name}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-semibold">
                        {player.rank ?? "—"} · {player.name}
                      </div>
                      <div className="text-xs text-white/50">Score</div>
                    </div>
                    <div className="text-lg font-bold">{player.score ?? 0}</div>
                  </div>
                ))}
              </div>
            </div>

            {sortedQuestions.map((question, index) => (
              <div
                key={`${question.questionId}-${index}`}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                      Question {index + 1}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">{question.text}</h3>
                    <p className="mt-2 text-sm text-white/60">
                      Correct answers:{" "}
                      {formatCorrect(
                        question.correctAnswers,
                        question.options ?? [],
                      )}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                    Duration: {question.durationSec ?? 0}s
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-white/80">
                    <thead className="text-xs uppercase text-white/50">
                      <tr>
                        <th className="pb-2 pr-4">Player</th>
                        <th className="pb-2 pr-4">Answer</th>
                        <th className="pb-2 pr-4">Correct</th>
                        <th className="pb-2 pr-4">Points</th>
                        <th className="pb-2">Time left (s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {question.results.map((result) => (
                        <tr key={`${question.questionId}-${result.name}`}>
                          <td className="border-t border-white/10 py-2 pr-4">
                            {result.name}
                          </td>
                          <td className="border-t border-white/10 py-2 pr-4 text-white/70">
                            {formatAnswer(result.answer, question.options ?? [])}
                          </td>
                          <td className="border-t border-white/10 py-2 pr-4">
                            {result.correct ? "Yes" : "No"}
                          </td>
                          <td className="border-t border-white/10 py-2 pr-4">
                            {result.points ?? 0}
                          </td>
                          <td className="border-t border-white/10 py-2">
                            {result.timeLeftSec ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white/70">
            Report not found.
          </div>
        )}
      </div>
    </div>
  );
}
