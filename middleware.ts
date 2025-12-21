import { NextRequest, NextResponse } from "next/server";
import { verifyHostAuthToken } from "./src/lib/hostAuth";

export const config = {
  matcher: ["/host/:path*"],
};

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow the access page itself to render; otherwise we'd redirect in a loop.
  if (pathname === "/host/access" || pathname === "/host/access/") {
    return NextResponse.next();
  }

  const accessUrl = req.nextUrl.clone();
  accessUrl.pathname = "/host/access";
  accessUrl.search = "";
  // Ensure redirects use the public scheme/host behind proxies (e.g. Render).
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto === "https") accessUrl.protocol = "https:";
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) accessUrl.host = forwardedHost;

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
