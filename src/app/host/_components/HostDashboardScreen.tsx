"use client";

import { useHostAuthUser } from "@/app/host/_components/HostAuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { BACKGROUND_BASE_CLASS, backgroundStyle } from "@/lib/backgrounds";

type HostDashboardScreenProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  quizzes: any[];
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  loadingQuizzes: boolean;
  deletingQuizId: string | null;
  onCreateNewQuiz: () => void;
  onEditQuiz: (quizId: string) => void;
  onPlayQuiz: (quizId: string) => void;
  onDeleteQuiz: (quizId: string, quizTitle?: string) => void;
};

export function HostDashboardScreen({
  searchTerm,
  onSearchTermChange,
  quizzes,
  availableTags,
  selectedTags,
  onToggleTag,
  onClearTags,
  loadingQuizzes,
  deletingQuizId,
  onCreateNewQuiz,
  onEditQuiz,
  onPlayQuiz,
  onDeleteQuiz,
}: HostDashboardScreenProps) {
  const user = useHostAuthUser();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setMenuOpen(false);
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <div className="grid grid-cols-12 gap-8">
      <aside className="col-span-3 bg-white/5 rounded-2xl p-6 border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="relative"
            onBlur={(e) => {
              if (!(e.currentTarget as HTMLDivElement).contains(
                e.relatedTarget as Node | null
              )) {
                setMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-12 h-12 rounded-full bg-linear-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-lg font-bold"
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              K
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-2 w-48 rounded-2xl bg-black/80 p-2 ring-1 ring-white/15 shadow-2xl backdrop-blur"
              >
                <div className="px-3 py-2 text-xs text-white/70 truncate">
                  {user.email}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={logout}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-white hover:bg-white/10"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-purple-200">Welcome back,</p>
            <p className="font-semibold text-white truncate">{user.email}</p>
          </div>
        </div>

        <button
          onClick={onCreateNewQuiz}
          className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition"
        >
          + Create New Quiz
        </button>
        <Link
          href="/host/history"
          className="mt-3 block w-full rounded-xl border border-white/10 bg-white/5 py-3 text-center font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
        >
          View Game History
        </Link>
      </aside>

      <main className="col-span-9 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Your Quizzes</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-3 rounded-xl flex-1">
            <span className="text-purple-200">🔍</span>
            <input
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="Search quizzes..."
              className="bg-transparent outline-none flex-1 text-white placeholder:text-white/40"
            />
          </div>
        </div>

        {availableTags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {availableTags.map((tag) => {
              const active = selectedTags.some(
                (value) => value.toLowerCase() === tag.toLowerCase()
              );
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onToggleTag(tag)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    active
                      ? "border-purple-300 bg-purple-500/30 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/30"
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
            {selectedTags.length > 0 ? (
              <button
                type="button"
                onClick={onClearTags}
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-white/70 hover:border-white/30"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        {loadingQuizzes && quizzes.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/70">
            Loading quizzes…
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {quizzes.map((quiz) => (
            <div
              key={quiz._id}
              className="rounded-2xl p-4 border border-white/10 bg-white/5 hover:border-white/30 cursor-pointer transition"
              onClick={() => onEditQuiz(quiz._id)}
            >
              <div
                className={`h-24 rounded-xl mb-4 ${
                  quiz.backgroundImage
                    ? BACKGROUND_BASE_CLASS
                    : "bg-linear-to-br from-purple-400/30 to-indigo-500/30"
                }`}
                style={backgroundStyle(quiz.backgroundImage)}
              />

              <h3 className="text-lg font-semibold mb-1">{quiz.title}</h3>
              <p className="text-sm text-white/60">
                {(quiz.questions || []).length} Questions
              </p>
              {Array.isArray(quiz.tags) && quiz.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {quiz.tags.slice(0, 6).map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayQuiz(quiz._id);
                  }}
                  className="text-sm px-3 py-2 rounded-lg bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  Play
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteQuiz(quiz._id, quiz.title);
                  }}
                  disabled={deletingQuizId === quiz._id}
                  className="text-sm px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {deletingQuizId === quiz._id ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
            ))}
            {loadingQuizzes ? (
              <div className="col-span-3 text-sm text-white/50">
                Refreshing latest quizzes…
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
