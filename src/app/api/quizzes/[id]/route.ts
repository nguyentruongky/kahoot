import { connectDB } from "@/lib/db";
import Quiz from "@/models/Quiz";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  await connectDB();
  const quiz = await Quiz.findById(params.id);
  return NextResponse.json(quiz);
}
