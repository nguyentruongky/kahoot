import { connectDB } from "@/lib/db";
import Game from "@/models/Game";
import { generatePin } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await connectDB();
  const body: { quizId?: string } = await req.json(); // expects { quizId: "..." }

  if (!body.quizId) {
    return NextResponse.json({ error: "quizId is required" }, { status: 400 });
  }

  const newGame = await Game.create({
    quizId: body.quizId,
    pin: generatePin(),
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
