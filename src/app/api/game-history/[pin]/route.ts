import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/authServer";
import GameHistory from "@/models/GameHistory";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pin: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { pin } = await params;
  const history = await GameHistory.findOne({
    pin: String(pin ?? "").trim(),
    ownerId: user.id,
  }).lean();

  if (!history) {
    return NextResponse.json({ error: "History not found" }, { status: 404 });
  }

  return NextResponse.json(history);
}
