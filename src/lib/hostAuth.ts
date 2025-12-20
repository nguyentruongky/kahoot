const textEncoder = new TextEncoder();

const base64UrlEncode = (data: Uint8Array) => {
  let base64: string;
  if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(data).toString("base64");
  } else {
    let binary = "";
    for (const byte of data) binary += String.fromCharCode(byte);
    base64 = btoa(binary);
  }

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlDecode = (input: string) => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(padded, "base64"));
  }

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const constantTimeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
};

const importHmacKey = async (secret: string) => {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
};

const signHmac = async (message: string, secret: string) => {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(message)
  );
  return base64UrlEncode(new Uint8Array(signature));
};

export const createHostAuthToken = async (secret: string, ttlMs: number) => {
  const payload = { exp: Date.now() + ttlMs };
  const payloadB64 = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
  const signatureB64 = await signHmac(payloadB64, secret);
  return `${payloadB64}.${signatureB64}`;
};

export const verifyHostAuthToken = async (token: string, secret: string) => {
  const [payloadB64, signatureB64] = token.split(".");
  if (!payloadB64 || !signatureB64) return false;

  const expectedSig = await signHmac(payloadB64, secret);
  if (!constantTimeEqual(signatureB64, expectedSig)) return false;

  try {
    const payloadBytes = base64UrlDecode(payloadB64);
    const payloadText = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadText) as { exp?: number };
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    return Date.now() < exp;
  } catch {
    return false;
  }
};

