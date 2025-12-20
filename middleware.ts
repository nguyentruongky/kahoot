import { NextRequest, NextResponse } from "next/server";
import { verifyHostAuthToken } from "./src/lib/hostAuth";

export const config = {
  matcher: ["/host/:path*"],
};

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const secret = process.env.HOST_PRIVATE_CODE;
  if (!secret) {
    const url = req.nextUrl.clone();
    url.searchParams.set("reason", "missing");
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const token = req.cookies.get("host_auth")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const ok = await verifyHostAuthToken(token, secret);
  if (!ok) {
    const url = req.nextUrl.clone();
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
