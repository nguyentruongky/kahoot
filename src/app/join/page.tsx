import { Suspense } from "react";
import JoinClient from "./JoinClient";

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-linear-to-br from-blue-500 to-purple-600 p-6">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
            Loading…
          </div>
        </div>
      }
    >
      <JoinClient />
    </Suspense>
  );
}

