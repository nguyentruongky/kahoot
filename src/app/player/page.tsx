"use client";
import { initSocketServer, socket } from "@/lib/socketClient";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  kahootShapeForIndex,
  KahootShapeIcon,
} from "@/components/KahootShapeIcon";
import { KahootCheckIcon } from "@/components/KahootCheckIcon";

interface Question {
  text: string;
  options: string[];
  correctAnswer: number | string;
}

export default function PlayerPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [answerStreak, setAnswerStreak] = useState(0);
  const [gameStatus, setGameStatus] = useState<"waiting" | "playing" | "ended">(
    "waiting"
  );
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(
    null
  );
  const [revealedCorrectAnswer, setRevealedCorrectAnswer] = useState<
    number | null
  >(null);
  const [resultPopup, setResultPopup] = useState<{
    open: boolean;
    title: string;
    points: number;
    variant: "success" | "danger" | "neutral";
    streak: number;
  } | null>(null);
  const [finalPopup, setFinalPopup] = useState<{
    open: boolean;
    score: number;
    rank?: number;
    totalPlayers?: number;
    leaderboardWindow?: Array<{ name: string; score: number; rank?: number }>;
  } | null>(null);
  const questionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedAnswerRef = useRef<number | null>(null);
  const pinRef = useRef<string>("");
  const nameRef = useRef<string>("");
  const currentQuestionRef = useRef<Question | null>(null);
  const appliedQuestionIdsRef = useRef<Set<number>>(new Set());
  const answerStreakRef = useRef(0);
  const scoreRef = useRef(0);

  const playBeep = (frequency = 880, durationMs = 120) => {
    try {
      const AudioContextCtor =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx: AudioContext =
        (window as any).__kahootAudioCtx || new AudioContextCtor();
      (window as any).__kahootAudioCtx = ctx;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => osc.stop(), durationMs);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    initSocketServer().catch(console.error);

    // Get player info from sessionStorage
    const storedPin = sessionStorage.getItem("gamePin");
    const storedName = sessionStorage.getItem("playerName");

    if (!storedPin || !storedName) {
      router.push("/join");
      return;
    }

    setPin(storedPin);
    setName(storedName);
    pinRef.current = storedPin;
    nameRef.current = storedName;

    // Ensure socket is connected
    if (!socket.connected) {
      console.log("🔌 Player connecting socket...");
      socket.connect();
    }

    socket.on("connect", () => {
      console.log("✅ Player socket connected:", socket.id);
    });

    // Join the game room
    const joinGame = () => {
      console.log("👤 PLAYER EMITTING join_game:", {
        pin: storedPin,
        name: storedName,
      });
      console.log("Socket connected?", socket.connected);
      console.log("Socket ID:", socket.id);
      socket.emit("join_game", { pin: storedPin, name: storedName });
    };

    // Wait a bit for socket to connect
    const timer = setTimeout(() => {
      if (socket.connected) {
        joinGame();
      } else {
        console.log("⏳ Waiting for socket connection...");
        socket.once("connect", () => {
          console.log("🔗 Socket connected, now joining");
          joinGame();
        });
      }
    }, 1000);

    // Listen for new questions
    const handleStartQuestion = (data: {
      question: Question;
      startedAt?: number;
      durationSec?: number;
    }) => {
      console.log("📝 New question received:", data);
      setCurrentQuestion(data.question);
      currentQuestionRef.current = data.question;
      setSelectedAnswer(null);
      selectedAnswerRef.current = null;
      setAnswered(false);
      setFeedback(null);
      setRevealedCorrectAnswer(null);
      setResultPopup(null);
      setGameStatus("playing");
      playBeep(523, 120);

      const durationSec =
        typeof data.durationSec === "number" && data.durationSec > 0
          ? data.durationSec
          : 20;
      const startedAt =
        typeof data.startedAt === "number" && data.startedAt > 0
          ? data.startedAt
          : Date.now();
      const endAt = startedAt + durationSec * 1000;

      if (questionTimeoutRef.current) {
        clearTimeout(questionTimeoutRef.current);
      }
      questionTimeoutRef.current = setTimeout(() => {
        setAnswered(true);
      }, Math.max(0, endAt - Date.now()));
    };

    // Listen for game end
    const handleEndGame = (data?: {
      totalPlayers?: number;
      byName?: Record<string, { score: number; rank: number }>;
      leaderboardAll?: Array<{ name: string; score: number; rank: number }>;
    }) => {
      console.log("🎉 Game ended");
      const me = data?.byName?.[nameRef.current];
      const leaderboard =
        Array.isArray(data?.leaderboardAll) ? data?.leaderboardAll : [];
      const myIdx = leaderboard.findIndex((p) => p.name === nameRef.current);
      const leaderboardWindow = (() => {
        if (leaderboard.length === 0) return undefined;
        if (leaderboard.length <= 5) return leaderboard;
        if (myIdx === -1) return leaderboard.slice(0, 5);

        let start = Math.max(0, myIdx - 2);
        let end = Math.min(leaderboard.length, myIdx + 3);

        while (end - start < 5) {
          if (start > 0) start -= 1;
          else if (end < leaderboard.length) end += 1;
          else break;
        }

        return leaderboard.slice(start, end);
      })();
      setFinalPopup({
        open: true,
        score: typeof me?.score === "number" ? me.score : scoreRef.current,
        rank: typeof me?.rank === "number" ? me.rank : undefined,
        totalPlayers:
          typeof data?.totalPlayers === "number"
            ? data.totalPlayers
            : undefined,
        leaderboardWindow,
      });
      setResultPopup(null);
      setGameStatus("ended");
      setCurrentQuestion(null);
    };

    socket.on("start_question", handleStartQuestion);
    socket.on("end_game", handleEndGame);
    const handleEndQuestion = (data: {
      questionId?: number;
      correctAnswer: number;
      results?: Record<
        string,
        {
          answer: number | null;
          correct: boolean;
          points: number;
          timeLeftSec: number;
        }
      >;
    }) => {
      if (
        typeof data.questionId === "number" &&
        appliedQuestionIdsRef.current.has(data.questionId)
      ) {
        return;
      }
      if (typeof data.questionId === "number") {
        appliedQuestionIdsRef.current.add(data.questionId);
      }

      setAnswered(true);
      setRevealedCorrectAnswer(
        Number.isFinite(data.correctAnswer) ? data.correctAnswer : null
      );
      const selected = selectedAnswerRef.current;

      const myResult = data.results?.[nameRef.current];
      const points = typeof myResult?.points === "number" ? myResult.points : 0;
      setScore((prev) => {
        const next = prev + points;
        scoreRef.current = next;
        return next;
      });

      const q = currentQuestionRef.current;
      const isCorrect = selected !== null && selected === data.correctAnswer;
      const variant: "success" | "danger" | "neutral" =
        selected === null ? "neutral" : isCorrect ? "success" : "danger";
      const title =
        selected === null ? "Time's up!" : isCorrect ? "Correct" : "Wrong";

      const nextStreak =
        selected === null ? 0 : isCorrect ? answerStreakRef.current + 1 : 0;
      answerStreakRef.current = nextStreak;
      setAnswerStreak(nextStreak);

      setFeedback(
        selected === null ? null : isCorrect ? "correct" : "incorrect"
      );
      setResultPopup({
        open: true,
        title,
        points,
        variant,
        streak: nextStreak,
      });
    };
    socket.on("end_question", handleEndQuestion);
    const handlePlayerAnswer = (data: { name: string; points?: number }) => {
      if (data.name !== nameRef.current) return;
      // Keep this listener for compatibility, but points are shown on `end_question`.
    };
    socket.on("player_answer", handlePlayerAnswer);

    return () => {
      clearTimeout(timer);
      if (questionTimeoutRef.current) clearTimeout(questionTimeoutRef.current);
      socket.off("connect");
      socket.off("start_question", handleStartQuestion);
      socket.off("end_game", handleEndGame);
      socket.off("end_question", handleEndQuestion);
      socket.off("player_answer", handlePlayerAnswer);
    };
  }, [router]);

  const handleAnswerSelect = (index: number) => {
    if (answered) return;

    setSelectedAnswer(index);
    selectedAnswerRef.current = index;
    setAnswered(true);

    // Emit answer to server
    socket.emit("player_answer", {
      pin: pinRef.current || pin,
      name: nameRef.current || name,
      answer: index,
    });
  };

  const answersRevealed = revealedCorrectAnswer !== null;

  const getBaseAnswerColorClass = (
    index: number,
    interactive: boolean
  ): string => {
    const colors = interactive
      ? [
          "bg-red-500 hover:bg-red-600",
          "bg-blue-500 hover:bg-blue-600",
          "bg-yellow-500 hover:bg-yellow-600",
          "bg-green-500 hover:bg-green-600",
        ]
      : ["bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-green-500"];
    return colors[index % 4];
  };

  const getAnswerColorClass = (index: number) => {
    if (!answered) {
      return getBaseAnswerColorClass(index, true);
    }

    // Don't reveal correctness/colors until host ends/reveals the question.
    if (!answersRevealed) {
      return getBaseAnswerColorClass(index, false);
    }

    // After answering, show correct/incorrect
    if (index === selectedAnswer) {
      if (!feedback) return "bg-purple-600";
      return feedback === "correct" ? "bg-green-600" : "bg-red-600";
    }

    if (index === revealedCorrectAnswer) {
      return "bg-green-600";
    }

    return "bg-gray-400";
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-purple-900 p-4">
      {finalPopup?.open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-linear-to-br from-fuchsia-600 via-purple-700 to-indigo-900 p-6">
          <div className="absolute inset-0 opacity-80">
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl" />
            <div className="absolute top-1/3 -right-28 h-80 w-80 rounded-full bg-yellow-200/25 blur-3xl" />
            <div className="absolute -bottom-28 left-1/3 h-80 w-80 rounded-full bg-pink-300/30 blur-3xl" />
          </div>

          <div className="relative w-full max-w-md rounded-[32px] border border-white/20 bg-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.55)] overflow-hidden backdrop-blur-xl">
            <div className="p-8 text-center text-white">
              <p className="text-white/70 font-semibold">Final Results</p>
              <h2 className="mt-2 text-4xl font-extrabold tracking-tight">
                Game Over
              </h2>

              {(() => {
                const rank = finalPopup.rank;
                if (typeof rank !== "number") return null;
                if (rank === 1)
                  return (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-yellow-300/25 px-4 py-2 text-sm font-extrabold text-yellow-50 ring-1 ring-yellow-200/40">
                      <span className="text-base">🏆</span> Winner
                    </div>
                  );
                if (rank === 2)
                  return (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-extrabold text-white ring-1 ring-white/20">
                      <span className="text-base">🥈</span> Runner-up
                    </div>
                  );
                if (rank === 3)
                  return (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-300/20 px-4 py-2 text-sm font-extrabold text-amber-50 ring-1 ring-amber-200/35">
                      <span className="text-base">🥉</span> Top 3
                    </div>
                  );
                return null;
              })()}

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/12 border border-white/15 p-5">
                  <p className="text-white/70 text-sm">Total score</p>
                  <p className="mt-2 text-3xl font-black">{finalPopup.score}</p>
                </div>
                <div className="rounded-2xl bg-white/12 border border-white/15 p-5">
                  <p className="text-white/70 text-sm">Position</p>
                  <p className="mt-2 text-3xl font-black">
                    {typeof finalPopup.rank === "number"
                      ? `#${finalPopup.rank}`
                      : "—"}
                  </p>
                  {typeof finalPopup.totalPlayers === "number" && (
                    <p className="text-white/60 text-xs mt-1">
                      out of {finalPopup.totalPlayers}
                    </p>
                  )}
                </div>
              </div>

              {Array.isArray(finalPopup.leaderboardWindow) &&
                finalPopup.leaderboardWindow.length > 0 && (
                  <div className="mt-7 rounded-2xl border border-white/15 bg-black/15 p-4 text-left ring-1 ring-white/10">
                    <p className="text-sm font-semibold text-white/85 px-1">
                      Standings
                    </p>
                    <div className="mt-3 space-y-2">
                      {finalPopup.leaderboardWindow.map((p) => {
                        const isMe = p.name === nameRef.current;
                        const rank = typeof p.rank === "number" ? p.rank : null;
                        const rowTone =
                          rank === 1
                            ? "bg-yellow-300/25 ring-yellow-200/30"
                            : rank === 2
                              ? "bg-white/18 ring-white/25"
                              : rank === 3
                                ? "bg-amber-300/20 ring-amber-200/25"
                                : "bg-black/15 ring-white/10";
                        const meTone = isMe ? "ring-2 ring-purple-200/60" : "";
                        const medal =
                          rank === 1
                            ? "🥇"
                            : rank === 2
                              ? "🥈"
                              : rank === 3
                                ? "🥉"
                                : null;
                        return (
                          <div
                            key={p.name}
                            className={`flex items-center justify-between rounded-xl px-4 py-3 ring-1 ${rowTone} ${meTone}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-12 text-white/80 font-mono text-sm">
                                {typeof p.rank === "number" ? `#${p.rank}` : "—"}
                              </span>
                              {medal && (
                                <span className="w-6 text-lg leading-none">
                                  {medal}
                                </span>
                              )}
                              <span
                                className={`truncate font-semibold ${
                                  isMe ? "text-white" : "text-white/90"
                                }`}
                              >
                                {p.name}
                              </span>
                              {isMe && (
                                <span className="shrink-0 text-xs font-semibold text-purple-100">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 font-mono text-white">
                              {p.score}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              <button
                onClick={() => router.push("/join")}
                className="mt-8 w-full rounded-2xl bg-white text-purple-900 font-extrabold py-3 hover:bg-white/90 transition shadow-[0_10px_0_rgba(0,0,0,0.18)] active:translate-y-0.5 active:shadow-[0_6px_0_rgba(0,0,0,0.18)]"
              >
                Join Another Game
              </button>
            </div>
          </div>
        </div>
      )}

      {resultPopup?.open && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center ${
            resultPopup.variant === "success"
              ? "bg-[#66bb2e]"
              : resultPopup.variant === "danger"
              ? "bg-[#e53935]"
              : "bg-[#f4b400]"
          }`}
        >
          <div className="w-full max-w-md px-6 py-10 text-center text-white">
            <h3 className="text-6xl font-extrabold tracking-tight drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]">
              {resultPopup.title}
            </h3>

            <div className="mt-6 flex items-center justify-center">
              <div className="text-7xl font-black drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]">
                {resultPopup.variant === "success" ? (
                  <KahootCheckIcon className="h-20 w-20 text-white" />
                ) : resultPopup.variant === "danger" ? (
                  "✕"
                ) : (
                  "⏱"
                )}
              </div>
            </div>

            <div className="mt-10 flex items-center justify-center gap-3 text-2xl font-extrabold drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">
              <span>Answer Streak</span>
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-orange-500 shadow-[0_4px_0_rgba(0,0,0,0.25)] border border-white/30">
                {resultPopup.streak}
              </span>
            </div>

            <div className="mt-8 rounded-lg overflow-hidden shadow-[0_10px_0_rgba(0,0,0,0.18)]">
              <div className="bg-black/35 px-6 py-5 text-5xl font-extrabold tracking-tight">
                + {resultPopup.points}
              </div>
            </div>

            <p className="mt-10 text-3xl font-extrabold drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">
              {resultPopup.variant === "success"
                ? "You're on the podium!"
                : resultPopup.variant === "danger"
                ? "Try again next time!"
                : "Waiting for next question…"}
            </p>

            <p className="mt-3 text-white/90 font-semibold">
              Total: {score} pts
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full max-w-2xl mb-6 text-center">
        <div className="bg-white rounded-lg shadow-lg p-4 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Player</p>
            <p className="text-lg font-bold text-purple-700">{name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Score</p>
            <p className="text-lg font-bold text-green-600">{score}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">PIN</p>
            <p className="text-lg font-bold text-purple-700 font-mono">{pin}</p>
          </div>
        </div>
      </div>

      {/* Game Content */}
      {gameStatus === "waiting" && (
        <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
          <div className="animate-pulse">
            <h2 className="text-3xl font-bold text-purple-700 mb-4">
              Waiting for host to start...
            </h2>
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce delay-100"></div>
              <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        </div>
      )}

      {gameStatus === "playing" && currentQuestion && (
        <div className="w-full max-w-2xl">
          {/* Question Text */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-800">
              {currentQuestion.text}
            </h2>
          </div>

          {/* Answer Options */}
          <div className="grid grid-cols-2 gap-4">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={answered}
                className={`${getAnswerColorClass(index)} ${
                  answered && !answersRevealed && selectedAnswer === index
                    ? "ring-4 ring-white/80"
                    : ""
                } text-white font-bold py-8 px-6 rounded-xl shadow-lg transform transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:transform-none`}
              >
                <div className="mb-2 flex justify-center">
                  <KahootShapeIcon
                    kind={kahootShapeForIndex(index)}
                    className="h-10 w-10 text-white"
                  />
                </div>
                <div className="text-lg">{option}</div>
              </button>
            ))}
          </div>

          {/* Feedback */}
          {answered && !answersRevealed && (
            <div
              className={`mt-6 p-4 rounded-lg text-center text-white font-bold text-xl ${"bg-gray-700"}`}
            >
              {(() => {
                if (!answersRevealed) {
                  if (selectedAnswer === null) {
                    return "⏰ Time's up! Waiting for host…";
                  }
                  return "Answer submitted! Waiting for host…";
                }
              })()}
            </div>
          )}
        </div>
      )}

      {gameStatus === "ended" && (
        <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
          <h2 className="text-4xl font-bold text-purple-700 mb-4">
            Game Over!
          </h2>
          <div className="text-6xl mb-4">🎉</div>
          <p className="text-2xl text-gray-700 mb-2">Final Score</p>
          <p className="text-5xl font-bold text-green-600 mb-6">{score}</p>
          <button
            onClick={() => router.push("/join")}
            className="bg-purple-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-purple-700 transition"
          >
            Join Another Game
          </button>
        </div>
      )}
    </div>
  );
}
