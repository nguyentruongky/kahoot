import { Suspense } from "react";
import HostAccessClient from "./HostAccessClient";

export default function HostAccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0f0a1f] text-white flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl bg-white/5 ring-1 ring-white/10 shadow-2xl p-8 text-center">
            Loading…
          </div>
        </div>
      }
    >
      <HostAccessClient />
    </Suspense>
  );
}

