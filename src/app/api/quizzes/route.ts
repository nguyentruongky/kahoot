import { connectDB } from "@/lib/db";
import Quiz from "@/models/Quiz";
import { NextResponse } from "next/server";

export async function GET() {
  await connectDB();
  const quizzes = await Quiz.find();
  return NextResponse.json(quizzes);
}

export async function POST(req: Request) {
  await connectDB();
  const body = await req.json();
  const newQuiz = await Quiz.create(body);
  return NextResponse.json(newQuiz, { status: 201 });
}
