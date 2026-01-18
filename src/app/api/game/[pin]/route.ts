import { connectDB } from "@/lib/db";
import Game from "@/models/Game";
import Quiz from "@/models/Quiz";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pin: string }> }
) {
  await connectDB();
  const { pin } = await params;
  const normalizedPin = String(pin ?? "").trim();
  if (!normalizedPin) {
    return NextResponse.json({ error: "pin is required" }, { status: 400 });
  }

  const game = await Game.findOne({ pin: normalizedPin });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  let backgroundImage =
    typeof game.backgroundImage === "string" ? game.backgroundImage : undefined;
  if (!backgroundImage) {
    const quiz = await Quiz.findById(game.quizId).lean();
    if (typeof quiz?.backgroundImage === "string" && quiz.backgroundImage.trim()) {
      backgroundImage = quiz.backgroundImage;
      game.backgroundImage = backgroundImage;
      await game.save();
    }
  }

  return NextResponse.json({
    ...game.toObject(),
    backgroundImage,
  });
}
