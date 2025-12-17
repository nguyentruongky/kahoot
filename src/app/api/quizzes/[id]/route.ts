import { connectDB } from "@/lib/db";
import Quiz from "@/models/Quiz";
import { NextResponse } from "next/server";

type IncomingQuestion = {
  text?: unknown;
  question?: unknown;
  options?: unknown;
  choices?: unknown;
  correctAnswer?: unknown;
  answerIndex?: unknown;
  answer?: unknown;
};

const normalizeCorrectAnswer = (
  candidate: unknown,
  options: string[]
): number => {
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    const idx = Math.trunc(candidate);
    if (idx >= 0 && idx < options.length) return idx;
    if (idx - 1 >= 0 && idx - 1 < options.length) return idx - 1;
    return 0;
  }

  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (trimmed !== "") {
      const asNum = Number(trimmed);
      if (Number.isFinite(asNum)) {
        const idx = Math.trunc(asNum);
        if (idx >= 0 && idx < options.length) return idx;
        if (idx - 1 >= 0 && idx - 1 < options.length) return idx - 1;
      }
      const byText = options.findIndex((o) => o === trimmed);
      if (byText >= 0) return byText;
    }
  }

  return 0;
};

const normalizeQuizBody = (raw: unknown) => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid payload");
  }

  const body = raw as { title?: unknown; questions?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    throw new Error("Title is required");
  }

  if (!Array.isArray(body.questions)) {
    throw new Error("Questions must be an array");
  }

  const questions = body.questions
    .map((q): { text: string; options: string[]; correctAnswer: number } | null => {
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
        typeof item.correctAnswer !== "undefined"
          ? item.correctAnswer
          : typeof item.answerIndex !== "undefined"
            ? item.answerIndex
            : item.answer;

      const correctAnswer = normalizeCorrectAnswer(candidate, options);

      return { text, options, correctAnswer };
    })
    .filter(
      (q): q is { text: string; options: string[]; correctAnswer: number } =>
        Boolean(q)
    );

  if (questions.length === 0) {
    throw new Error("No valid questions");
  }

  return { title, questions };
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
      correctAnswer: normalizeCorrectAnswer(q.correctAnswer, options),
    };
  };

  return {
    ...quiz,
    questions: Array.isArray(quiz.questions)
      ? quiz.questions.map(normalizeFromStored)
      : [],
  };
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  const quiz = await Quiz.findById(id).lean();

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  return NextResponse.json(toClientQuiz(quiz));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;

  try {
    const raw = (await req.json()) as unknown;
    const body = normalizeQuizBody(raw);

    const updated = await Quiz.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json(toClientQuiz(updated.toObject()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid payload" },
      { status: 400 }
    );
  }
}
