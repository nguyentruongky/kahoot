import { connectDB } from "@/lib/db";
import Game from "@/models/Game";
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

  return NextResponse.json(game);
}
