"use client";
import { initSocketServer, socket } from "@/lib/socketClient";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FinalPopupState, Question, ResultPopupState } from "./types";
import { PlayerFinalResultsModal } from "@/app/player/_components/PlayerFinalResultsModal";
import { PlayerGameOverCard } from "@/app/player/_components/PlayerGameOverCard";
import { PlayerHeaderBar } from "@/app/player/_components/PlayerHeaderBar";
import { PlayerQuestionView } from "@/app/player/_components/PlayerQuestionView";
import { PlayerResultOverlay } from "@/app/player/_components/PlayerResultOverlay";
import { PlayerWaitingCard } from "@/app/player/_components/PlayerWaitingCard";

import {
  BACKGROUND_BASE_CLASS,
  DEFAULT_BACKGROUND_IMAGE,
  backgroundStyle,
} from "@/lib/backgrounds";

const playerBackgroundImage = DEFAULT_BACKGROUND_IMAGE;

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
  const [resultPopup, setResultPopup] = useState<ResultPopupState | null>(null);
  const [finalPopup, setFinalPopup] = useState<FinalPopupState | null>(null);
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

  const screenByStatus = {
    waiting: <PlayerWaitingCard playerName={name} />,
    playing: currentQuestion ? (
      <PlayerQuestionView
        question={currentQuestion}
        answered={answered}
        answersRevealed={answersRevealed}
        selectedAnswer={selectedAnswer}
        getAnswerClassName={getAnswerColorClass}
        onSelectAnswer={handleAnswerSelect}
      />
    ) : null,
    ended: (
      <PlayerGameOverCard
        score={score}
        onJoinAnother={() => router.push("/join")}
      />
    ),
  } satisfies Record<typeof gameStatus, React.ReactNode>;

  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center bg-purple-900 p-4 ${BACKGROUND_BASE_CLASS}`}
      style={backgroundStyle(playerBackgroundImage)}
    >
      {finalPopup?.open && (
        <PlayerFinalResultsModal
          popup={finalPopup}
          playerName={name}
          onJoinAnother={() => router.push("/join")}
        />
      )}

      {resultPopup?.open && (
        <PlayerResultOverlay popup={resultPopup} totalScore={score} />
      )}

      {/* Header */}
      {gameStatus !== "waiting" && (
        <PlayerHeaderBar name={name} score={score} />
      )}

      {screenByStatus[gameStatus]}
    </div>
  );
}
