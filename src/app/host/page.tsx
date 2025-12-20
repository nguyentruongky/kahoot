"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { initSocketServer, socket } from "@/lib/socketClient";
import { useRouter } from "next/navigation";
import {
  kahootShapeForIndex,
  KahootShapeIcon,
} from "@/components/KahootShapeIcon";
import { KahootCheckIcon } from "@/components/KahootCheckIcon";

interface Player {
  name: string;
  score: number;
}

type HostStage = "dashboard" | "builder" | "lobby" | "question" | "final";

type EditableQuestion = {
  text: string;
  options: string[];
  correctAnswer: number;
};

export default function HostPage() {
  const router = useRouter();
  const endQuestionSentRef = useRef(false);

  // STAGES
  const [stage, setStage] = useState<HostStage>("dashboard");

  // QUIZZES
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [activeQuizTitle, setActiveQuizTitle] = useState("");

  // GAME STATE
  const [pin, setPin] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [questionSet, setQuestionSet] = useState<any[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [timer, setTimer] = useState(20);
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
  const [copyToast, setCopyToast] = useState("");

  // HELPERS
  const mergePlayers = (incoming: Player[], previous: Player[]) => {
    const scoreMap = new Map(previous.map((p) => [p.name, p.score]));
    const seen = new Set<string>();

    return incoming.reduce<Player[]>((acc, player) => {
      if (seen.has(player.name)) return acc;
      seen.add(player.name);
      acc.push({
        name: player.name,
        score: scoreMap.get(player.name) ?? player.score ?? 0,
      });
      return acc;
    }, []);
  };

  const avatarForName = (name: string) => {
    const avatars = [
      "😀",
      "😎",
      "🦊",
      "🐻",
      "🐱",
      "🐶",
      "🐯",
      "🦁",
      "🐼",
      "🐸",
      "🐧",
      "🐨",
    ];
    const hash = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return avatars[hash % avatars.length];
  };

  const refreshQuizzes = () => {
    fetch("/api/quizzes")
      .then((res) => res.json())
      .then((data) => setQuizzes(data));
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

    const questions: EditableQuestion[] = questionsSource
      .map((q) => {
        if (!q || typeof q !== "object") return null;
        const obj = q as Record<string, unknown>;

        const text =
          (typeof obj.text === "string" && obj.text) ||
          (typeof obj.question === "string" && obj.question) ||
          (typeof obj.prompt === "string" && obj.prompt) ||
          "Untitled question";

        const options = normalizeOptions(obj.options ?? obj.choices);

        let correctAnswer = 0;
        if (typeof obj.correctAnswer !== "undefined") {
          correctAnswer = normalizeCorrectIndex(
            obj.correctAnswer,
            options.length
          );
        } else if (typeof obj.answerIndex !== "undefined") {
          correctAnswer = normalizeCorrectIndex(
            obj.answerIndex,
            options.length
          );
        } else if (typeof obj.answer !== "undefined") {
          if (typeof obj.answer === "string") {
            const idx = options.findIndex((opt) => opt === obj.answer);
            correctAnswer = idx >= 0 ? idx : 0;
          } else {
            correctAnswer = normalizeCorrectIndex(obj.answer, options.length);
          }
        }

        return { text, options, correctAnswer };
      })
      .filter((q): q is EditableQuestion => Boolean(q));

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
    if (currentQuestion && timer > 0 && !showResults) {
      const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
      return () => clearInterval(interval);
    } else if (timer === 0 && currentQuestion && !showResults) {
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
    setTimer(20);
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

  // UI SECTIONS — dashboard changed to Option A behavior
  const renderDashboard = () => (
    <div className="grid grid-cols-12 gap-8">
      <aside className="col-span-3 bg-white/5 rounded-2xl p-6 border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-linear-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-lg font-bold">
            H
          </div>
          <div>
            <p className="text-sm text-purple-200">Host Account</p>
            <p className="font-semibold text-white">Welcome back!</p>
          </div>
        </div>

        <button
          onClick={createNewQuiz}
          className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition"
        >
          + Create New Quiz
        </button>
      </aside>

      {/* MAIN QUIZ LIST */}
      <main className="col-span-9 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Your Quizzes</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-3 rounded-xl flex-1">
            <span className="text-purple-200">🔍</span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search quizzes..."
              className="bg-transparent outline-none flex-1 text-white placeholder:text-white/40"
            />
          </div>
        </div>

        {/* QUIZ GRID — CARD CLICK = EDIT, BUTTON = PLAY */}
        <div className="grid grid-cols-3 gap-4">
          {filteredQuizzes.map((quiz) => (
            <div
              key={quiz._id}
              className="rounded-2xl p-4 border border-white/10 bg-white/5 hover:border-white/30 cursor-pointer transition"
              onClick={() => startEditingQuiz(quiz._id)} // CLICK = EDIT
            >
              <div className="h-24 rounded-xl bg-linear-to-br from-purple-400/30 to-indigo-500/30 mb-4" />

              <h3 className="text-lg font-semibold mb-1">{quiz.title}</h3>
              <p className="text-sm text-white/60">
                {(quiz.questions || []).length} Questions
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startGame(quiz._id);
                  }}
                  className="text-sm px-3 py-2 rounded-lg bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  Play
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );

  // BUILDER (unchanged)
  const renderBuilder = () => (
    <div className="bg-white text-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[600px] max-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between px-8 py-5 border-b shrink-0">
        <div className="flex items-center gap-3 w-1/2">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
            ✦
          </div>
          <div className="w-full">
            <p className="text-sm text-gray-500">Quiz Builder</p>
            <input
              value={builderTitle}
              onChange={(e) => setBuilderTitle(e.target.value)}
              className="text-2xl font-bold outline-none w-full"
              placeholder="Quiz title"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setStage("dashboard")}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
          >
            Cancel
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
          >
            Import JSON
          </button>

          <button
            onClick={saveQuiz}
            className="px-5 py-2 rounded-lg bg-purple-600 text-white font-semibold"
          >
            Save Quiz
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 flex-1 min-h-0">
        <aside className="col-span-3 border-r bg-gray-50 p-6 space-y-4 min-h-0 overflow-y-auto">
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            Questions
          </p>

          {builderQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => setBuilderIndex(idx)}
              className={`w-full text-left p-3 rounded-xl border ${
                builderIndex === idx
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="text-xs text-gray-400">Question {idx + 1}</div>
              <div className="font-semibold truncate">
                {q.text || "Untitled"}
              </div>
            </button>
          ))}

          <button
            onClick={() =>
              setBuilderQuestions((prev) => [
                ...prev,
                {
                  text: "New question",
                  options: ["", "", "", ""],
                  correctAnswer: 0,
                },
              ])
            }
            className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold"
          >
            + Add question
          </button>
        </aside>

        <main className="col-span-9 p-8 space-y-6 min-h-0 overflow-y-auto">
          <div className="bg-gray-100 rounded-2xl p-6">
            <input
              value={builderQuestions[builderIndex]?.text || ""}
              onChange={(e) => {
                const newText = e.target.value;
                setBuilderQuestions((prev) =>
                  prev.map((q, i) =>
                    i === builderIndex ? { ...q, text: newText } : q
                  )
                );
              }}
              className="w-full text-2xl font-bold bg-white rounded-xl p-4 border border-gray-200 outline-none"
              placeholder="Type your question..."
            />

            <div className="mt-6 h-48 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center text-gray-500">
              <span className="text-2xl mb-2">🖼️</span>
              <p className="font-semibold">Drop image or video here</p>
              <p className="text-sm">
                You can drag and drop or click to upload.
              </p>
              <button className="mt-4 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700">
                Upload Media
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {builderQuestions[builderIndex]?.options.map((opt, idx) => {
              const colors = [
                "bg-red-500",
                "bg-blue-500",
                "bg-yellow-500",
                "bg-green-500",
              ];
              const isCorrect =
                builderQuestions[builderIndex]?.correctAnswer === idx;

              return (
                <div
                  key={idx}
                  className={`${
                    colors[idx % 4]
                  } text-white rounded-2xl p-4 shadow-lg`}
                >
                  <div className="flex items-center gap-3">
                    <KahootShapeIcon
                      kind={kahootShapeForIndex(idx)}
                      className="h-7 w-7 text-white"
                    />

                    <input
                      value={opt}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setBuilderQuestions((prev) =>
                          prev.map((q, i) =>
                            i === builderIndex
                              ? {
                                  ...q,
                                  options: q.options.map((o, oi) =>
                                    oi === idx ? newValue : o
                                  ),
                                }
                              : q
                          )
                        );
                      }}
                      className="flex-1 bg-white/10 rounded-lg px-3 py-2 outline-none placeholder:text-white/70"
                      placeholder={`Answer ${idx + 1}`}
                    />

                    <button
                      onClick={() =>
                        setBuilderQuestions((prev) =>
                          prev.map((q, i) =>
                            i === builderIndex
                              ? { ...q, correctAnswer: idx }
                              : q
                          )
                        )
                      }
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                        isCorrect
                          ? "bg-white text-green-600 border-white"
                          : "border-white/60 text-white/80"
                      }`}
                    >
                      <KahootCheckIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );

  // LOBBY
  const renderLobby = () => (
    <div className="min-h-[70vh] flex flex-col items-center justify-center bg-linear-to-b from-[#120d25] to-[#0f0a1f] rounded-3xl border border-white/10">
      <p className="text-purple-200 mb-2">Waiting for players…</p>
      <h2 className="text-4xl font-bold mb-2">{activeQuizTitle}</h2>

      <p className="text-purple-100 mt-6 mb-2">Join with PIN</p>

      <button
        onClick={() => navigator.clipboard.writeText(pin)}
        className="bg-black/40 rounded-2xl px-10 py-6 border border-white/10 shadow-2xl hover:border-purple-300/50 transition mb-6"
      >
        <div className="text-6xl font-extrabold tracking-[0.3rem]">{pin}</div>
      </button>

      <button
        onClick={nextQuestion}
        className="px-10 py-4 rounded-2xl bg-linear-to-r from-purple-500 to-pink-500 text-lg font-semibold shadow-lg hover:scale-[1.02] transition"
      >
        Start Game
      </button>

      <div className="mt-8 w-full max-w-4xl">
        <p className="text-center mb-4 text-purple-200">
          {players.length} Player{players.length !== 1 ? "s" : ""} Joined
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {players.map((p) => (
            <div
              key={p.name}
              className="bg-white/10 border border-white/20 rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-2">
                <span className="text-4xl h-10 flex items-center justify-center">
                  {avatarForName(p.name)}
                </span>
                <span className="font-semibold text-white">{p.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // QUESTION SCREEN
  const renderQuestion = () => (
    <div className="bg-white text-gray-900 rounded-3xl shadow-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-purple-600 font-semibold">Game PIN: {pin}</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-700">Players: {players.length}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-gray-700">
            {answers.length} / {players.length} answers
          </span>

          <button
            onClick={finalizeGame}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Quit Game
          </button>
        </div>
      </div>

      {/* QUESTION HEADER */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">
          Question {questionIndex - 1} of {questionSet.length}
        </p>
        <div className="w-12 h-12 rounded-full border-4 border-purple-200 flex items-center justify-center text-purple-700 font-bold">
          {timer}
        </div>
      </div>

      {/* TIMER BAR */}
      <div className="w-full bg-gray-200 h-2 rounded-full mb-6">
        <div
          className="h-2 rounded-full bg-purple-500 transition-all duration-1000"
          style={{ width: `${(timer / 20) * 100}%` }}
        />
      </div>

      {/* QUESTION */}
      <div className="bg-gray-100 rounded-2xl p-6 mb-6">
        <h3 className="text-2xl font-bold text-center">
          {currentQuestion.text}
        </h3>
      </div>

      {/* ANSWER OPTIONS */}
      {!showResults ? (
        <div className="grid grid-cols-2 gap-4">
          {currentQuestion.options.map((opt: string, idx: number) => {
            const colors = [
              "bg-red-500",
              "bg-blue-500",
              "bg-yellow-500",
              "bg-green-500",
            ];

            return (
              <div
                key={idx}
                className={`${
                  colors[idx % 4]
                } text-white p-5 rounded-xl flex items-center gap-3 text-lg font-semibold`}
              >
                <KahootShapeIcon
                  kind={kahootShapeForIndex(idx)}
                  className="h-7 w-7 text-white"
                />
                {opt}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {currentQuestion.options.map((opt: string, idx: number) => {
            const count = answers.filter((a) => a.answer === idx).length;
            const percentage = answers.length
              ? (count / answers.length) * 100
              : 0;
            const isCorrect = idx === currentQuestion.correctAnswer;

            return (
              <div
                key={idx}
                className={`border rounded-xl p-4 flex items-center justify-between ${
                  isCorrect ? "border-green-400 bg-green-50" : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{opt}</span>
                  {isCorrect && (
                    <span className="text-xs px-2 py-1 rounded bg-green-500 text-white">
                      Correct
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  <span>{count} answers</span>
                  <span className="text-gray-400">|</span>
                  <span>{percentage.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}

          <div className="flex justify-end gap-3">
            <button
              onClick={finalizeGame}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700"
            >
              Skip to Results
            </button>

            <button
              onClick={nextQuestion}
              className="px-5 py-2 rounded-lg bg-purple-600 text-white font-semibold"
            >
              Next Question
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // FINAL LEADERBOARD
  const renderFinal = () => (
    <div className="bg-white text-gray-900 rounded-3xl shadow-2xl p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">Game Over</p>
          <h2 className="text-3xl font-bold">Here are your winners</h2>
        </div>

        <button
          onClick={resetToLobby}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
        >
          Play Again
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {finalResults.map((p, idx) => {
          const colors = [
            "border-yellow-400",
            "border-gray-400",
            "border-amber-300",
          ];
          const titles = ["1st Place", "2nd Place", "3rd Place"];

          return (
            <div
              key={p.name}
              className={`rounded-2xl border-2 ${colors[idx]} p-4 bg-gray-50`}
            >
              <p className="text-sm text-gray-500">{titles[idx]}</p>
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className="text-purple-600 font-semibold">{p.score} pts</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <p className="font-semibold">Final Leaderboard</p>
        </div>

        <div className="divide-y">
          {players
            .slice()
            .sort((a, b) => b.score - a.score)
            .map((p, idx) => (
              <div
                key={p.name}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center font-bold text-gray-600">
                    {idx + 1}
                  </span>
                  <span className="font-semibold">{p.name}</span>
                </div>
                <span className="text-purple-600 font-bold">{p.score} pts</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  // RENDER ROOT
  return (
    <div className="min-h-screen bg-[#0f0a1f] text-white">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          try {
            const parsed = JSON.parse(text) as unknown;
            const { title, questions } = normalizeImportedQuestions(parsed);
            if (title) setBuilderTitle(title);
            setBuilderQuestions(questions);
            setBuilderIndex(0);
            setBuilderQuizId(null);
            setStage("builder");
          } catch {
            alert("Invalid JSON");
          } finally {
            e.target.value = "";
          }
        }}
      />

      {/* HEADER */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold">
            K
          </div>
          <div>
            <p className="text-sm text-purple-200">Host Console</p>
            <h1 className="text-xl font-semibold">Kahoot Clone</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStage("dashboard")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              stage === "dashboard"
                ? "bg-white text-black"
                : "border border-white/20"
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={createNewQuiz}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            Create
          </button>
        </div>
      </header>

      <div className="p-8 space-y-6">
        {stage === "dashboard" && renderDashboard()}
        {stage === "builder" && renderBuilder()}
        {stage === "lobby" && renderLobby()}
        {stage === "question" && currentQuestion && renderQuestion()}
        {stage === "final" && renderFinal()}
      </div>
    </div>
  );
}
