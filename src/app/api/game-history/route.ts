import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/authServer";
import GameHistory from "@/models/GameHistory";
import Quiz from "@/models/Quiz";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const ownedQuizzes = await Quiz.find({ ownerId: user.id })
    .select({ _id: 1 })
    .lean();
  const ownedQuizIds = ownedQuizzes.map((quiz) => quiz._id);

  const histories = await GameHistory.find({
    $or: [{ ownerId: user.id }, { quizId: { $in: ownedQuizIds } }],
  })
    .sort({ endedAt: -1 })
    .lean();

  const summary = histories.map((entry: any) => ({
    pin: entry.pin,
    quizId: entry.quizId,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    totalPlayers: entry.totalPlayers,
    players: entry.players,
    leaderboard: entry.leaderboard,
  }));

  return NextResponse.json(summary);
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const body = (await req.json()) as {
    pin?: string;
    quizId?: string;
    startedAt?: string;
    endedAt?: string;
    totalPlayers?: number;
    players?: { name: string; score: number; rank?: number }[];
    leaderboard?: { name: string; score: number; rank?: number }[];
    leaderboardAll?: { name: string; score: number; rank?: number }[];
    questions?: {
      questionId?: number;
      text?: string;
      options?: string[];
      correctAnswers?: number[];
      startedAt?: string | number;
      durationSec?: number;
      results?: {
        name: string;
        answer: number | number[] | null;
        correct: boolean;
        points: number;
        timeLeftSec: number;
      }[];
    }[];
  };

  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  if (!pin) {
    return NextResponse.json({ error: "pin is required" }, { status: 400 });
  }
  const quizId = typeof body.quizId === "string" ? body.quizId.trim() : "";
  if (!quizId) {
    return NextResponse.json({ error: "quizId is required" }, { status: 400 });
  }

  const normalizeDate = (value?: string | number) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  const questions = Array.isArray(body.questions)
    ? body.questions.map((question) => ({
        questionId:
          typeof question.questionId === "number" ? question.questionId : undefined,
        text: typeof question.text === "string" ? question.text : "",
        options: Array.isArray(question.options)
          ? question.options.map((opt) => String(opt ?? ""))
          : [],
        correctAnswers: Array.isArray(question.correctAnswers)
          ? question.correctAnswers.map((value) => Number(value))
          : [],
        startedAt: normalizeDate(question.startedAt),
        durationSec:
          typeof question.durationSec === "number" ? question.durationSec : undefined,
        results: Array.isArray(question.results)
          ? question.results.map((result) => ({
              name: String(result.name ?? ""),
              answer:
                typeof result.answer === "undefined" ? null : result.answer ?? null,
              correct: Boolean(result.correct),
              points: Number(result.points ?? 0),
              timeLeftSec: Number(result.timeLeftSec ?? 0),
            }))
          : [],
      }))
    : [];

  const update = {
    pin,
    quizId,
    ownerId: user.id,
    startedAt: normalizeDate(body.startedAt),
    endedAt: normalizeDate(body.endedAt) ?? new Date(),
    totalPlayers: Number(body.totalPlayers ?? 0),
    players: Array.isArray(body.players) ? body.players : [],
    leaderboard: Array.isArray(body.leaderboard) ? body.leaderboard : [],
    leaderboardAll: Array.isArray(body.leaderboardAll)
      ? body.leaderboardAll
      : [],
    questions,
  };

  const history = await GameHistory.findOneAndUpdate(
    { pin, ownerId: user.id },
    update,
    { new: true, upsert: true },
  );

  return NextResponse.json({ ok: true, id: String(history._id) });
}
