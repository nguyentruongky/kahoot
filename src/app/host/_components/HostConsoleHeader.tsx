"use client";

type HostStage = "dashboard" | "lobby" | "question" | "final";

type HostConsoleHeaderProps = {
  stage: HostStage;
  onGoDashboard: () => void;
  onCreate: () => void;
};

export function HostConsoleHeader({
  stage,
  onGoDashboard,
  onCreate,
}: HostConsoleHeaderProps) {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-black/30 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold">
          K
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCreate}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
        >
          Create
        </button>
      </div>
    </header>
  );
}
