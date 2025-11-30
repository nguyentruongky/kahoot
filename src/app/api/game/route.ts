import { connectDB } from "@/lib/db";
import Game from "@/models/Game";
import { generatePin } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await connectDB();
  const body = await req.json(); // expects { quizId: "..." }

  const newGame = await Game.create({
    quizId: body.quizId,
    pin: generatePin(),
  });

  return NextResponse.json(newGame, { status: 201 });
}

export async function GET() {
  await connectDB();
  const games = await Game.find();
  return NextResponse.json(games);
}
