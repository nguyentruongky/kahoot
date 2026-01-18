"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { initSocketServer, socket } from "@/lib/socketClient";
import { useRouter } from "next/navigation";
import { mergePlayers } from "@/app/host/game/utils";
import { HostConsoleHeader } from "@/app/host/_components/HostConsoleHeader";
import { HostJsonImportInput } from "@/app/host/_components/HostJsonImportInput";
import { HostDashboardScreen } from "@/app/host/_components/HostDashboardScreen";
import { HostBuilderScreen } from "@/app/host/_components/HostBuilderScreen";
import { HostLobbyScreen } from "@/app/host/_components/HostLobbyScreen";
import { HostQuestionScreen } from "@/app/host/_components/HostQuestionScreen";
import { HostFinalScreen } from "@/app/host/_components/HostFinalScreen";

const QUESTION_DURATION_SEC = 20;
const QUESTION_DURATION_MS = QUESTION_DURATION_SEC * 1000;

interface Player {
  name: string;
  score: number;
}

type HostStage = "dashboard" | "builder" | "lobby" | "question" | "final";

type EditableQuestion = {
  text: string;
  options: string[];
  correctAnswer: number;
  media?: { kind: "image" | "video"; src: string; mime?: string };
};

export default function HostPage() {
  const router = useRouter();
  const endQuestionSentRef = useRef(false);
  
  // STAGES
  const [stage, setStage] = useState<HostStage>("dashboard");

  // QUIZZES
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [activeQuizTitle, setActiveQuizTitle] = useState("");
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);

  // GAME STATE
  const [pin, setPin] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [questionSet, setQuestionSet] = useState<any[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [timer, setTimer] = useState(QUESTION_DURATION_SEC);
  const [timerMs, setTimerMs] = useState(QUESTION_DURATION_MS);
  const [gameEnded, setGameEnded] = useState(false);
  const [finalResults, setFinalResults] = useState<Player[]>([]);

  // SEARCH
  const [searchTerm, setSearchTerm] = useState("");

  // BUILDER
  const [builderTitle, setBuilderTitle] = useState("");
  const [builderQuizId, setBuilderQuizId] = useState<string | null>(null);
  const [builderQuestions, setBuilderQuestions] = useState<EditableQuestion[]>([
    { text: "Untitled question", options: ["", "", "", ""], correctAnswer: 0 },
  ]);
  const [builderIndex, setBuilderIndex] = useState(0);

  // FILE IMPORT
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [copyToast, setCopyToast] = useState("");

  const refreshQuizzes = () => {
    fetch("/api/quizzes")
      .then((res) => res.json())
      .then((data) => setQuizzes(data));
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

  const normalizeImportedQuestions = (raw: unknown) => {
    const payload =
      raw && typeof raw === "object" && "questions" in raw
        ? (raw as { questions: unknown; title?: unknown })
        : null;

    const questionsSource = Array.isArray(raw)
      ? raw
      : Array.isArray(payload?.questions)
      ? payload?.questions
      : null;

    if (!questionsSource) {
      throw new Error(
        "Invalid JSON format. Expected an array of questions or an object with a `questions` array."
      );
    }

    const normalizeOptions = (options: unknown) => {
      const list = Array.isArray(options)
        ? options.map((opt) => String(opt ?? ""))
        : [];
      const trimmed = list.slice(0, 4);
      while (trimmed.length < 4) trimmed.push("");
      return trimmed;
    };

    const normalizeCorrectIndex = (candidate: unknown, optionCount: number) => {
      const num =
        typeof candidate === "number"
          ? candidate
          : typeof candidate === "string" && candidate.trim() !== ""
          ? Number(candidate)
          : NaN;

      if (Number.isFinite(num)) {
        const idx = Math.trunc(num);
        if (idx >= 0 && idx < optionCount) return idx; // 0-based
        if (idx - 1 >= 0 && idx - 1 < optionCount) return idx - 1; // 1-based
      }

      return 0;
    };

    const questions: EditableQuestion[] = [];
    for (const q of questionsSource) {
      if (!q || typeof q !== "object") continue;
      const obj = q as Record<string, unknown>;

      const text =
        (typeof obj.text === "string" && obj.text) ||
        (typeof obj.question === "string" && obj.question) ||
        (typeof obj.prompt === "string" && obj.prompt) ||
        "Untitled question";

      const options = normalizeOptions(obj.options ?? obj.choices);

      let correctAnswer = 0;
      if (typeof obj.correctAnswer !== "undefined") {
        correctAnswer = normalizeCorrectIndex(obj.correctAnswer, options.length);
      } else if (typeof obj.answerIndex !== "undefined") {
        correctAnswer = normalizeCorrectIndex(obj.answerIndex, options.length);
      } else if (typeof obj.answer !== "undefined") {
        if (typeof obj.answer === "string") {
          const idx = options.findIndex((opt) => opt === obj.answer);
          correctAnswer = idx >= 0 ? idx : 0;
        } else {
          correctAnswer = normalizeCorrectIndex(obj.answer, options.length);
        }
      }

      const media =
        obj.media && typeof obj.media === "object"
          ? (obj.media as { kind?: unknown; src?: unknown; mime?: unknown })
          : null;
      const kind =
        media?.kind === "image" || media?.kind === "video"
          ? (media.kind as "image" | "video")
          : null;
      const src = typeof media?.src === "string" ? media.src : "";
      const mime = typeof media?.mime === "string" ? media.mime : undefined;

      if (kind && src) {
        questions.push({ text, options, correctAnswer, media: { kind, src, mime } });
      } else {
        questions.push({ text, options, correctAnswer });
      }
    }

    if (questions.length === 0) {
      throw new Error("No valid questions found in JSON.");
    }

    return {
      title:
        payload && typeof payload.title === "string"
          ? payload.title
          : undefined,
      questions,
    };
  };

  // INITIALIZE
  useEffect(() => {
    refreshQuizzes();
  }, []);

  useEffect(() => {
    if (!copyToast) return;
    const t = setTimeout(() => setCopyToast(""), 2000);
    return () => clearTimeout(t);
  }, [copyToast]);

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
      answer: number;
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
    const durationMs = QUESTION_DURATION_MS;
    const start = performance.now();
    setTimerMs(durationMs);
    setTimer(Math.ceil(durationMs / 1000));

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

    setCurrentQuestion(question);
    setTimer(QUESTION_DURATION_SEC);
    setTimerMs(QUESTION_DURATION_MS);
    setAnswers([]);
    setShowResults(false);
    endQuestionSentRef.current = false;

    socket.emit("start_question", { pin, question, durationSec: 20 });

    setStage("question");
    setQuestionIndex((prev) => prev + 1);
  };

  // BUILDER FUNCTIONS — unchanged
  const startEditingQuiz = (quizId: string) => {
    const quiz = quizzes.find((q) => q._id === quizId);
    if (!quiz) return;

    setBuilderQuizId(quizId);
    setBuilderTitle(quiz.title || "Untitled Quiz");
    setBuilderQuestions(
      (quiz.questions || []).map((q: any) => ({
        text: q.text,
        options: q.options,
        correctAnswer: Number(q.correctAnswer) || 0,
        media: q.media,
      }))
    );
    setBuilderIndex(0);
    setStage("builder");
  };

  const createNewQuiz = () => {
    setBuilderQuizId(null);
    setBuilderTitle("New Quiz");
    setBuilderQuestions([
      {
        text: "Untitled question",
        options: ["", "", "", ""],
        correctAnswer: 0,
      },
    ]);
    setBuilderIndex(0);
    setStage("builder");
  };

  const saveQuiz = async () => {
    const sanitized = builderQuestions.map((q) => ({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      media: q.media,
    }));

    const url = builderQuizId
      ? `/api/quizzes/${builderQuizId}`
      : "/api/quizzes";
    const method = builderQuizId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: builderTitle,
        questions: sanitized,
      }),
    });

    if (!res.ok) {
      alert("Error saving quiz.");
      return;
    }

    refreshQuizzes();
    setBuilderQuizId(null);
    setStage("dashboard");
  };

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) =>
      q.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [quizzes, searchTerm]);

  const screens = {
    dashboard: (
      <HostDashboardScreen
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        quizzes={filteredQuizzes}
        deletingQuizId={deletingQuizId}
        onCreateNewQuiz={createNewQuiz}
        onEditQuiz={startEditingQuiz}
        onPlayQuiz={startGame}
        onDeleteQuiz={deleteQuiz}
      />
    ),
    builder: (
      <HostBuilderScreen
        fileInputRef={fileInputRef}
        mediaInputRef={mediaInputRef}
        builderTitle={builderTitle}
        builderQuestions={builderQuestions}
        builderIndex={builderIndex}
        onBuilderTitleChange={setBuilderTitle}
        onSelectQuestion={setBuilderIndex}
        onAddQuestion={() =>
          setBuilderQuestions((prev) => [
            ...prev,
            { text: "New question", options: ["", "", "", ""], correctAnswer: 0 },
          ])
        }
        onUpdateQuestionText={(text) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) => (i === builderIndex ? { ...q, text } : q))
          )
        }
        onUpdateOption={(optionIndex, value) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) =>
              i === builderIndex
                ? {
                    ...q,
                    options: q.options.map((o, oi) => (oi === optionIndex ? value : o)),
                  }
                : q
            )
          )
        }
        onSelectCorrect={(optionIndex) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) => (i === builderIndex ? { ...q, correctAnswer: optionIndex } : q))
          )
        }
        onSetMedia={(media) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) => (i === builderIndex ? { ...q, media } : q))
          )
        }
        onCancel={() => setStage("dashboard")}
        onSave={saveQuiz}
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
          durationMs={QUESTION_DURATION_MS}
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
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const maxBytes = 8 * 1024 * 1024;
            if (file.size > maxBytes) {
              alert("Media is too large (max 8MB).");
              return;
            }

            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () => reject(new Error("read failed"));
              reader.onload = () => resolve(String(reader.result || ""));
              reader.readAsDataURL(file);
            });

            const kind = file.type.startsWith("video/") ? "video" : "image";
            setBuilderQuestions((prev) =>
              prev.map((q, i) =>
                i === builderIndex
                  ? { ...q, media: { kind, src: dataUrl, mime: file.type } }
                  : q
              )
            );
          } finally {
            e.target.value = "";
          }
        }}
      />

      <HostJsonImportInput
        inputRef={fileInputRef}
        onImportText={async (text) => {
          const parsed = JSON.parse(text) as unknown;
          const { title, questions } = normalizeImportedQuestions(parsed);
          if (title) setBuilderTitle(title);
          setBuilderQuestions(questions);
          setBuilderIndex(0);
          setBuilderQuizId(null);
          setStage("builder");
        }}
        onError={(message) => alert(message)}
      />

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
