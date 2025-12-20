"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinPage() {
  const searchParams = useSearchParams();
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const router = useRouter();

  useEffect(() => {
    const initialPin = searchParams?.get("pin");
    if (!initialPin) return;
    setPin((prev) => (prev ? prev : initialPin.slice(0, 6)));
  }, [searchParams]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin && name) {
      // Store player info in sessionStorage and navigate to player page
      sessionStorage.setItem("gamePin", pin);
      sessionStorage.setItem("playerName", name);
      router.push("/player");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-linear-to-br from-blue-500 to-purple-600 p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-4xl font-bold text-purple-700 mb-2 text-center">
          Join Game
        </h1>
        <p className="text-gray-600 mb-6 text-center">
          Enter the game PIN and your name
        </p>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label
              htmlFor="pin"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Game PIN
            </label>
            <input
              id="pin"
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter 6-digit PIN"
              maxLength={6}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-center text-2xl font-mono tracking-widest text-gray-900 placeholder:text-gray-400"
              required
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Your Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-gray-900 placeholder:text-gray-400"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition transform hover:scale-105 active:scale-95"
          >
            Join Game
          </button>
        </form>
      </div>
    </div>
  );
}
