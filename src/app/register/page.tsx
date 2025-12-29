"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error || "Registration failed.");
        return;
      }
      router.push("/host");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">Create account</h1>
        <p className="mt-2 text-white/70">
          Register with email and password (min 8 chars).
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-white/80">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="mt-2 w-full rounded-xl bg-black/30 px-4 py-3 outline-none ring-1 ring-white/15 focus:ring-white/30"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-white/80">
              Password
            </span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl bg-black/30 px-4 py-3 outline-none ring-1 ring-white/15 focus:ring-white/30"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </label>

          {error && (
            <div className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-100 ring-1 ring-red-500/30">
              {error}
            </div>
          )}

          <button
            disabled={submitting}
            className="w-full rounded-xl bg-white px-4 py-3 font-extrabold text-black disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-white/70">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-white underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

