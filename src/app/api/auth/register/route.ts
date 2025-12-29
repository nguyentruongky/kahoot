import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { AUTH_COOKIE_NAME, createAuthToken, hashPassword } from "@/lib/auth";

type RegisterBody = { email?: string; password?: string };

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as RegisterBody | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  await connectDB();
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    return NextResponse.json(
      { error: "Email is already registered." },
      { status: 409 }
    );
  }

  const user = await User.create({ email, passwordHash: hashPassword(password) });

  const token = createAuthToken(
    { sub: String(user._id), email: user.email },
    60 * 60 * 24 * 14
  );

  const res = NextResponse.json(
    { id: String(user._id), email: user.email },
    { status: 201 }
  );
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}

