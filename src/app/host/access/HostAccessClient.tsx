"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function HostAccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const candidate = searchParams?.get("next") || "/host";
    return candidate.startsWith("/") ? candidate : "/host";
  }, [searchParams]);
  const reason = searchParams?.get("reason") || "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/host/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!res.ok || !data?.ok) {
        setError(data?.message || "Access denied.");
        setLoading(false);
        return;
      }

      router.replace(nextPath);
    } catch {
      setError("Unable to verify code. Please try again.");
      setLoading(false);
    }
  };

  const reasonText =
    reason === "missing"
      ? "Host access code is not configured on the server."
      : "";

  return (
    <div className="min-h-screen bg-[#0f0a1f] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-white/5 ring-1 ring-white/10 shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-black">
            K
          </div>
          <div>
            <p className="text-sm text-purple-200">Private</p>
            <h1 className="text-2xl font-bold">Host access</h1>
          </div>
        </div>

        {reasonText && (
          <div className="mb-4 rounded-2xl bg-amber-500/15 ring-1 ring-amber-400/30 px-4 py-3 text-amber-100">
            {reasonText}
          </div>
        )}

        <p className="text-white/80 mb-6">
          Enter the private code to continue.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-white/90 mb-1">
              Private code
            </label>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              className="w-full rounded-xl bg-black/30 ring-1 ring-white/15 px-4 py-3 outline-none focus:ring-purple-400/60"
              placeholder="Enter code"
              required
            />
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/15 ring-1 ring-red-400/30 px-4 py-3 text-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white text-gray-900 font-extrabold shadow-sm ring-1 ring-black/5 hover:bg-white/90 disabled:opacity-70"
          >
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>

        <div className="mt-6 text-xs text-white/60 break-all">
          Next: {nextPath}
        </div>
      </div>
    </div>
  );
}

