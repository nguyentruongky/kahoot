import crypto from "crypto";

export type AuthTokenPayload = {
  sub: string;
  email: string;
  exp: number;
};

const TOKEN_VERSION = 1 as const;

function base64UrlEncode(value: Buffer | string) {
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecodeToBuffer(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const withPad = padded + "=".repeat(padLength);
  return Buffer.from(withPad, "base64");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "dev-auth-secret";
  throw new Error("Missing AUTH_SECRET environment variable");
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const keyLen = 64;
  const hash = crypto.scryptSync(password, salt, keyLen) as Buffer;
  return `scrypt$${base64UrlEncode(salt)}$${base64UrlEncode(hash)}`;
}

export function verifyPassword(password: string, stored: string) {
  const [kind, saltB64, hashB64] = stored.split("$");
  if (kind !== "scrypt" || !saltB64 || !hashB64) return false;
  const salt = base64UrlDecodeToBuffer(saltB64);
  const expected = base64UrlDecodeToBuffer(hashB64);
  const actual = crypto.scryptSync(password, salt, expected.length) as Buffer;
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}

export function createAuthToken(payload: Omit<AuthTokenPayload, "exp">, ttlSec: number) {
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload: AuthTokenPayload & { v: number } = {
    ...payload,
    exp: nowSec + ttlSec,
    v: TOKEN_VERSION,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const sig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(data)
    .digest();
  return `${data}.${base64UrlEncode(sig)}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(data)
    .digest();
  const actualSig = base64UrlDecodeToBuffer(encodedSig);
  if (
    expectedSig.length !== actualSig.length ||
    !crypto.timingSafeEqual(expectedSig, actualSig)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecodeToBuffer(encodedPayload).toString("utf8")
    ) as Partial<AuthTokenPayload> & { v?: number };
    if (payload.v !== TOKEN_VERSION) return null;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub, email: payload.email, exp: payload.exp };
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_NAME = "auth";

