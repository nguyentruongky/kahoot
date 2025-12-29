import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { AUTH_COOKIE_NAME, createAuthToken, verifyPassword } from "@/lib/auth";

type LoginBody = { email?: string; password?: string };

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as LoginBody | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  await connectDB();
  const user = (await User.findOne({ email }).lean()) as
    | { _id: unknown; email: string; passwordHash: string }
    | null;
  if (!user || typeof user.passwordHash !== "string") {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = createAuthToken(
    { sub: String(user._id), email: user.email },
    60 * 60 * 24 * 14
  );
  const res = NextResponse.json({ id: String(user._id), email: user.email });
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
