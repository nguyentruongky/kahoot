import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

export async function getAuthUser() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? verifyAuthToken(token) : null;
  if (!payload) return null;
  return { id: payload.sub, email: payload.email };
}

