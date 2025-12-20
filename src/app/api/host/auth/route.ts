import { NextResponse } from "next/server";
import { createHostAuthToken } from "@/lib/hostAuth";

export async function POST(req: Request) {
  const secret = process.env.HOST_PRIVATE_CODE;
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        message: "HOST_PRIVATE_CODE is not configured on the server.",
      },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const code =
    body && typeof body === "object" && "code" in body
      ? String((body as { code?: unknown }).code ?? "")
      : "";

  if (!code || code !== secret) {
    return NextResponse.json(
      { ok: false, message: "Invalid access code." },
      { status: 401 }
    );
  }

  const token = await createHostAuthToken(secret, 7 * 24 * 60 * 60 * 1000);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("host_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}

