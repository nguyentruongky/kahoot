import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ user: null }, { status: 200 });
  const payload = verifyAuthToken(token);
  if (!payload) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json(
    { user: { id: payload.sub, email: payload.email } },
    { status: 200 }
  );
}

