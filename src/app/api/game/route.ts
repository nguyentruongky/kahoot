import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/authServer";
import Game from "@/models/Game";
import Quiz from "@/models/Quiz";
import { generatePin } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const body: { quizId?: string } = await req.json(); // expects { quizId: "..." }

  if (!body.quizId) {
    return NextResponse.json({ error: "quizId is required" }, { status: 400 });
  }

  const quiz = await Quiz.findById(body.quizId).lean();
  if (!quiz) {
    return NextResponse.json({ error: "quiz not found" }, { status: 404 });
  }

  const newGame = await Game.create({
    quizId: body.quizId,
    pin: generatePin(),
    backgroundImage:
      typeof quiz.backgroundImage === "string" ? quiz.backgroundImage : undefined,
    ownerId: user.id,
  });

  return NextResponse.json(
    { id: String(newGame._id), pin: newGame.pin, quizId: String(newGame.quizId) },
    { status: 201 }
  );
}

export async function GET() {
  await connectDB();
  const games = await Game.find();
  return NextResponse.json(games);
}
