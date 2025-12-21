import { NextRequest, NextResponse } from "next/server";
import { verifyHostAuthToken } from "./src/lib/hostAuth";

export const config = {
  matcher: ["/host/:path*"],
};

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow the access page itself to render; otherwise we'd redirect in a loop.
  if (pathname === "/host/access") {
    return NextResponse.next();
  }

  const accessUrl = new URL("/host/access", req.url);

  const secret = process.env.HOST_PRIVATE_CODE;
  if (!secret) {
    accessUrl.searchParams.set("reason", "missing");
    accessUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(accessUrl);
  }

  const token = req.cookies.get("host_auth")?.value;
  if (!token) {
    accessUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(accessUrl);
  }

  const ok = await verifyHostAuthToken(token, secret);
  if (!ok) {
    accessUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(accessUrl);
  }

  return NextResponse.next();
}
