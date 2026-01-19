"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { initSocketServer, socket } from "@/lib/socketClient";
import { useRouter } from "next/navigation";
import { mergePlayers } from "@/app/host/game/utils";
import { HostConsoleHeader } from "@/app/host/_components/HostConsoleHeader";
import { HostDashboardScreen } from "@/app/host/_components/HostDashboardScreen";
import { HostLobbyScreen } from "@/app/host/_components/HostLobbyScreen";
import { HostQuestionScreen } from "@/app/host/_components/HostQuestionScreen";
import { HostFinalScreen } from "@/app/host/_components/HostFinalScreen";
import { readCachedQuizzes, writeCachedQuizzes } from "@/lib/quizzesCache";

const DEFAULT_QUESTION_DURATION_SEC = 20;
const DEFAULT_QUESTION_DURATION_MS = DEFAULT_QUESTION_DURATION_SEC * 1000;

interface Player {
  name: string;
  score: number;
}

type HostStage = "dashboard" | "lobby" | "question" | "final";

const normalizeDurationSec = (candidate: unknown) => {
  const raw =
    typeof candidate === "number"
      ? candidate
      : typeof candidate === "string" && candidate.trim() !== ""
        ? Number(candidate)
        : NaN;
  if (!Number.isFinite(raw)) return DEFAULT_QUESTION_DURATION_SEC;
  const value = Math.trunc(raw);
  if (value < 5) return 5;
  if (value > 300) return 300;
  return value;
};

export default function HostPage() {
  const router = useRouter();
  const endQuestionSentRef = useRef(false);
  
  // STAGES
  const [stage, setStage] = useState<HostStage>("dashboard");

  // QUIZZES
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [activeQuizTitle] = useState("");
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);

  // GAME STATE
  const [pin, setPin] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [questionSet, setQuestionSet] = useState<any[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [timer, setTimer] = useState(DEFAULT_QUESTION_DURATION_SEC);
  const [timerMs, setTimerMs] = useState(DEFAULT_QUESTION_DURATION_MS);
  const [gameEnded, setGameEnded] = useState(false);
  const [finalResults, setFinalResults] = useState<Player[]>([]);

  // SEARCH
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const refreshQuizzes = async () => {
    setLoadingQuizzes(true);
    try {
      const res = await fetch("/api/quizzes");
      const data = await res.json();
      setQuizzes(data);
      writeCachedQuizzes(Array.isArray(data) ? data : []);
    } finally {
      setLoadingQuizzes(false);
    }
  };

  const deleteQuiz = async (quizId: string, quizTitle?: string) => {
    if (deletingQuizId) return;

    const confirmed = window.confirm(
      `Delete quiz${quizTitle ? ` “${quizTitle}”` : ""}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingQuizId(quizId);
    try {
      const res = await fetch(`/api/quizzes/${quizId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        alert(payload?.error || "Failed to delete quiz.");
        return;
      }
      refreshQuizzes();
    } finally {
      setDeletingQuizId(null);
    }
  };

  // INITIALIZE
  useEffect(() => {
    let active = true;
    let networkLoaded = false;
    readCachedQuizzes().then((cached) => {
      if (!active || networkLoaded) return;
      if (cached && cached.length > 0) {
        setQuizzes(cached);
      }
    });
    const load = async () => {
      try {
        await refreshQuizzes();
      } finally {
        networkLoaded = true;
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  // SOCKET SETUP
  useEffect(() => {
    initSocketServer().catch(console.error);

    if (!socket.connected) socket.connect();

    const handleRoomState = (data: { players: Player[] }) => {
      setPlayers((prev) => mergePlayers(data.players ?? [], prev));
    };

    const handlePlayerJoined = (data: { name: string; players?: Player[] }) => {
      setPlayers((prev) =>
        mergePlayers(
          data.players ?? [...prev, { name: data.name, score: 0 }],
          prev
        )
      );
    };

    const handlePlayerLeft = (data: { name: string; players?: Player[] }) => {
      setPlayers((prev) =>
        mergePlayers(
          (data.players ?? prev).filter((p) => p.name !== data.name),
          prev
        )
      );
    };

    const handlePlayerAnswer = (data: {
      name: string;
      answer: number | number[];
      correct: boolean;
      points?: number;
      timeLeftSec?: number;
    }) => {
      setAnswers((prev) => [...prev, data]);
      setPlayers((prev) =>
        prev.map((p) =>
          p.name === data.name
            ? { ...p, score: p.score + (data.points ?? 0) }
            : p
        )
      );
    };

    socket.on("room_state", handleRoomState);
    socket.on("player_joined", handlePlayerJoined);
    socket.on("player_left", handlePlayerLeft);
    socket.on("player_answer", handlePlayerAnswer);

    return () => {
      socket.off("room_state", handleRoomState);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("player_left", handlePlayerLeft);
      socket.off("player_answer", handlePlayerAnswer);
    };
  }, []);

  // JOIN HOST ROOM
  useEffect(() => {
    if (!pin) return;

    const joinRoom = () => {
      socket.emit("host_create_room", { pin });
    };

    const timerId = setTimeout(() => {
      if (socket.connected) joinRoom();
      else socket.once("connect", joinRoom);
    }, 100);

    return () => clearTimeout(timerId);
  }, [pin]);

  // TIMER
  useEffect(() => {
    if (!currentQuestion || showResults) return;
    const durationSec = normalizeDurationSec(currentQuestion.durationSec);
    const durationMs = durationSec * 1000;
    const start = performance.now();
    setTimerMs(durationMs);
    setTimer(Math.ceil(durationSec));

    let rafId = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const remaining = Math.max(0, durationMs - elapsed);
      setTimerMs(remaining);
      setTimer(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [currentQuestion, showResults]);

  useEffect(() => {
    if (timer === 0 && currentQuestion && !showResults) {
      setShowResults(true);
    }
  }, [timer, currentQuestion, showResults]);

  useEffect(() => {
    if (!pin || !currentQuestion) return;
    if (!showResults) return;
    if (endQuestionSentRef.current) return;
    endQuestionSentRef.current = true;
    socket.emit("end_question", { pin });
  }, [showResults, currentQuestion, pin]);

  // AUTO SHOW RESULTS
  useEffect(() => {
    if (
      currentQuestion &&
      !showResults &&
      players.length > 0 &&
      answers.length === players.length
    ) {
      setShowResults(true);
      setTimer(0);
      setTimerMs(0);
    }
  }, [answers.length, players.length, currentQuestion, showResults]);

  // START GAME (NOW ALWAYS PASSES QUIZ ID)
  const startGame = async (quizId: string) => {
    try {
      const gameRes = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      });
      if (!gameRes.ok) {
        alert("Error creating game.");
        return;
      }

      const gameData = await gameRes.json();
      const pin = String(gameData?.pin ?? "").trim();
      if (!pin) {
        console.error("Invalid game response:", gameData);
        alert("Error creating game (missing PIN).");
        return;
      }
      router.push(`/host/game/${encodeURIComponent(pin)}`);
    } catch (error) {
      console.error("StartGame Error:", error);
      alert("Error starting game.");
    }
  };

  // FINALIZE GAME
  const finalizeGame = () => {
    socket.emit("end_game", { pin });
    const leaderboard = [...players].sort((a, b) => b.score - a.score);
    setFinalResults(leaderboard.slice(0, 3));
    setGameEnded(true);
    setStage("final");
    setCurrentQuestion(null);
    setShowResults(false);
    setTimer(0);
    setTimerMs(0);
  };

  const resetToLobby = () => {
    setStage("dashboard");
    setPin("");
    setPlayers([]);
    setAnswers([]);
    setQuestionSet([]);
    setCurrentQuestion(null);
    setQuestionIndex(0);
    setGameEnded(false);
  };

  const nextQuestion = () => {
    if (questionIndex > questionSet.length) {
      finalizeGame();
      return;
    }

    const question = questionSet[questionIndex - 1];
    if (!question) {
      finalizeGame();
      return;
    }

    const durationSec = normalizeDurationSec(question.durationSec);
    setCurrentQuestion(question);
    setTimer(durationSec);
    setTimerMs(durationSec * 1000);
    setAnswers([]);
    setShowResults(false);
    endQuestionSentRef.current = false;

    socket.emit("start_question", { pin, question, durationSec });

    setStage("question");
    setQuestionIndex((prev) => prev + 1);
  };

  const startEditingQuiz = (quizId: string) => {
    router.push(`/host/builder/${encodeURIComponent(quizId)}`);
  };

  const createNewQuiz = () => {
    router.push("/host/builder");
  };

  const filteredQuizzes = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    const normalizedSelected = selectedTags.map((tag) => tag.toLowerCase());

    return quizzes.filter((q) => {
      const title = String(q.title ?? "").toLowerCase();
      const tags = Array.isArray(q.tags)
        ? q.tags.map((tag: string) => String(tag ?? ""))
        : [];
      const tagsLower = tags.map((tag) => tag.toLowerCase());
      const matchesTerm =
        !normalizedTerm ||
        title.includes(normalizedTerm) ||
        tagsLower.some((tag) => tag.includes(normalizedTerm));
      const matchesTags =
        normalizedSelected.length === 0 ||
        normalizedSelected.every((tag) => tagsLower.includes(tag));
      return matchesTerm && matchesTags;
    });
  }, [quizzes, searchTerm, selectedTags]);

  const availableTags = useMemo(() => {
    const seen = new Map<string, string>();
    for (const quiz of quizzes) {
      if (!Array.isArray(quiz.tags)) continue;
      for (const raw of quiz.tags) {
        const tag = String(raw ?? "").trim();
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (!seen.has(key)) seen.set(key, tag);
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [quizzes]);

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) => {
      const exists = prev.some((value) => value.toLowerCase() === tag.toLowerCase());
      if (exists) {
        return prev.filter((value) => value.toLowerCase() !== tag.toLowerCase());
      }
      return [...prev, tag];
    });
  };

  const screens = {
    dashboard: (
      <HostDashboardScreen
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        quizzes={filteredQuizzes}
        availableTags={availableTags}
        selectedTags={selectedTags}
        onToggleTag={toggleTagFilter}
        onClearTags={() => setSelectedTags([])}
        loadingQuizzes={loadingQuizzes}
        deletingQuizId={deletingQuizId}
        onCreateNewQuiz={createNewQuiz}
        onEditQuiz={startEditingQuiz}
        onPlayQuiz={startGame}
        onDeleteQuiz={deleteQuiz}
      />
    ),
    lobby: (
      <HostLobbyScreen
        activeQuizTitle={activeQuizTitle}
        pin={pin}
        players={players}
        onCopyPin={() => navigator.clipboard.writeText(pin)}
        onStartGame={nextQuestion}
      />
    ),
    question: currentQuestion ? (
        <HostQuestionScreen
          pin={pin}
          players={players}
          answers={answers}
          questionIndex={questionIndex}
          questionSetLength={questionSet.length}
          timer={timer}
          timerMs={timerMs}
          durationMs={normalizeDurationSec(currentQuestion.durationSec) * 1000}
          currentQuestion={currentQuestion}
          showResults={showResults}
          onQuitGame={finalizeGame}
          onSkipToResults={finalizeGame}
          onNextQuestion={nextQuestion}
        />
      ) : null,
    final: (
      <HostFinalScreen
        finalResults={finalResults}
        players={players}
        onPlayAgain={resetToLobby}
      />
    ),
  } satisfies Record<HostStage, React.ReactNode>;

  // RENDER ROOT
  return (
    <div className="min-h-screen bg-[#0f0a1f] text-white">
      <HostConsoleHeader
        stage={stage}
        onGoDashboard={() => setStage("dashboard")}
        onCreate={createNewQuiz}
      />

      <div className="p-8 space-y-6">
        {screens[stage]}
      </div>
    </div>
  );
}
