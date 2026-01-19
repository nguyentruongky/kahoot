import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/authServer";
import Quiz from "@/models/Quiz";
import { normalizeCorrectAnswers } from "@/lib/quizDefaults";
import { NextResponse } from "next/server";

type IncomingQuestion = {
  text?: unknown;
  question?: unknown;
  options?: unknown;
  choices?: unknown;
  correctAnswer?: unknown;
  correctAnswers?: unknown;
  answerIndex?: unknown;
  answer?: unknown;
  durationSec?: unknown;
  duration?: unknown;
  media?: unknown;
};

type MediaPayload = { kind: "image" | "video"; src: string; mime?: string };

const normalizeBackgroundImage = (
  raw: unknown
): string | null | undefined => {
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
};

const normalizeMedia = (raw: unknown): MediaPayload | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as { kind?: unknown; src?: unknown; mime?: unknown };
  const kind =
    obj.kind === "image" || obj.kind === "video" ? obj.kind : undefined;
  const src = typeof obj.src === "string" ? obj.src.trim() : "";
  const mime = typeof obj.mime === "string" ? obj.mime.trim() : undefined;
  if (!kind || !src) return undefined;
  return { kind, src, mime };
};

const normalizeDurationSec = (candidate: unknown): number => {
  const raw =
    typeof candidate === "number"
      ? candidate
      : typeof candidate === "string" && candidate.trim() !== ""
        ? Number(candidate)
        : NaN;
  if (!Number.isFinite(raw)) return 20;
  const value = Math.trunc(raw);
  if (value < 5) return 5;
  if (value > 300) return 300;
  return value;
};

const normalizeQuizBody = (raw: unknown) => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid payload");
  }

  const body = raw as {
    title?: unknown;
    questions?: unknown;
    backgroundImage?: unknown;
    tags?: unknown;
  };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    throw new Error("Title is required");
  }

  if (!Array.isArray(body.questions)) {
    throw new Error("Questions must be an array");
  }

  const questions = body.questions
    .map(
      (
        q
      ):
        | {
            text: string;
            options: string[];
            correctAnswers: number[];
            durationSec: number;
            media?: MediaPayload;
          }
        | null => {
      if (!q || typeof q !== "object") return null;
      const item = q as IncomingQuestion;

      const textRaw =
        (typeof item.text === "string" && item.text) ||
        (typeof item.question === "string" && item.question) ||
        "";
      const text = textRaw.trim();
      if (!text) return null;

      const optionsRaw = Array.isArray(item.options)
        ? item.options
        : Array.isArray(item.choices)
          ? item.choices
          : [];

      const options = optionsRaw.map((o) => String(o ?? "")).slice(0, 4);
      while (options.length < 4) options.push("");

      const candidate =
        typeof item.correctAnswers !== "undefined"
          ? item.correctAnswers
          : typeof item.correctAnswer !== "undefined"
            ? item.correctAnswer
            : typeof item.answerIndex !== "undefined"
              ? item.answerIndex
              : item.answer;

      const correctAnswers = normalizeCorrectAnswers(candidate, options);
      const durationSec = normalizeDurationSec(
        typeof item.durationSec !== "undefined" ? item.durationSec : item.duration
      );
      const media = normalizeMedia(item.media);

      return { text, options, correctAnswers, durationSec, media };
    })
    .filter(
      (
        q
      ): q is {
        text: string;
        options: string[];
        correctAnswers: number[];
        durationSec: number;
        media?: MediaPayload;
      } => Boolean(q)
    );

  if (questions.length === 0) {
    throw new Error("No valid questions");
  }

  const backgroundImage = normalizeBackgroundImage(body.backgroundImage);

  const normalizeTags = (candidate: unknown): string[] => {
    const rawTags = Array.isArray(candidate)
      ? candidate
      : typeof candidate === "string"
        ? candidate.split(",")
        : [];
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const rawTag of rawTags) {
      const tag = String(rawTag ?? "").trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
    }
    return tags.slice(0, 12);
  };

  const tags = normalizeTags(body.tags);

  return { title, questions, backgroundImage, tags };
};

const toClientQuiz = (quiz: any) => {
  const normalizeFromStored = (q: any) => {
    const options = Array.isArray(q.options)
      ? q.options.map((o: any) => String(o ?? "")).slice(0, 4)
      : ["", "", "", ""];
    while (options.length < 4) options.push("");

    return {
      ...q,
      text: String(q.text ?? ""),
      options,
      correctAnswers: normalizeCorrectAnswers(
        typeof q.correctAnswers !== "undefined" ? q.correctAnswers : q.correctAnswer,
        options
      ),
      durationSec: normalizeDurationSec(q.durationSec),
      media: normalizeMedia(q.media),
    };
  };

  return {
    ...quiz,
    backgroundImage: normalizeBackgroundImage(quiz.backgroundImage) ?? undefined,
    tags: Array.isArray(quiz.tags)
      ? quiz.tags.map((tag: any) => String(tag ?? "")).filter((tag: string) => tag)
      : [],
    questions: Array.isArray(quiz.questions)
      ? quiz.questions.map(normalizeFromStored)
      : [],
  };
};

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const quizzes = await Quiz.find({ ownerId: user.id }).lean();
  return NextResponse.json(quizzes.map(toClientQuiz));
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  try {
    const raw = (await req.json()) as unknown;
    const body = normalizeQuizBody(raw);
    const newQuiz = await Quiz.create({ ...body, ownerId: user.id });
    return NextResponse.json(toClientQuiz(newQuiz.toObject()), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid payload" },
      { status: 400 }
    );
  }
}
