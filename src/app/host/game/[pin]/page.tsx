"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { initSocketServer, socket } from "@/lib/socketClient";

interface Player {
  name: string;
  score: number;
}

type QuizQuestion = {
  text: string;
  options: string[];
  correctAnswer: number;
};

type PlayerAnswerPayload = {
  name: string;
  answer: number;
  correct: boolean;
  points: number;
  timeLeftSec: number;
};

export default function HostGamePage() {
  const router = useRouter();
  const params = useParams<{ pin?: string | string[] }>();
  const rawPin = params?.pin;
  const pin =
    typeof rawPin === "string"
      ? rawPin
      : Array.isArray(rawPin)
        ? rawPin[0] ?? ""
        : "";

  const [activeQuizTitle, setActiveQuizTitle] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [questionSet, setQuestionSet] = useState<QuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(
    null
  );
  const [answers, setAnswers] = useState<PlayerAnswerPayload[]>([]);
  const [timer, setTimer] = useState(20);
  const [durationSec, setDurationSec] = useState(20);
  const [finalResults, setFinalResults] = useState<Player[]>([]);
  const [stage, setStage] = useState<"lobby" | "question" | "final">("lobby");
  const endQuestionSentRef = useRef(false);

  const showResults =
    !!currentQuestion &&
    (timer === 0 ||
      (players.length > 0 && answers.length === players.length));
  const effectiveTimer = showResults ? 0 : timer;

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
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => osc.stop(), durationMs);
    } catch {
      // ignore
    }
  };

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
    const avatars = ["😀", "😎", "🦊", "🐻", "🐱", "🐶", "🐯", "🦁", "🐼", "🐸", "🐧", "🐨"];
    const hash = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return avatars[hash % avatars.length];
  };

  // LOAD GAME + QUIZ (supports refresh by resolving quizId from pin)
  useEffect(() => {
    if (!pin) return;
    let cancelled = false;

    const load = async () => {
      try {
        const gameRes = await fetch(`/api/game/${encodeURIComponent(pin)}`);
        if (!gameRes.ok) {
          alert("Game not found.");
          router.push("/host");
          return;
        }

        const gameData: { quizId: string } = await gameRes.json();
        const quizId = gameData.quizId;

        const quizRes = await fetch(`/api/quizzes/${quizId}`);
        if (!quizRes.ok) {
          alert("Error loading quiz.");
          router.push("/host");
          return;
        }

        const quizData: { title?: string; questions?: QuizQuestion[] } =
          await quizRes.json();
        const limitedQuestions = (quizData.questions ?? []).slice(0, 5);

        if (limitedQuestions.length === 0) {
          alert("This quiz has no questions!");
          router.push("/host");
          return;
        }

        if (cancelled) return;
        setActiveQuizTitle(quizData.title || "Quiz");
        setQuestionSet(limitedQuestions);
        setQuestionIndex(1);
      } catch (error) {
        console.error("HostGame load error:", error);
        alert("Error loading game.");
        router.push("/host");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [pin, router]);

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

    const handlePlayerAnswer = (data: PlayerAnswerPayload) => {
      setAnswers((prev) => [...prev, data]);
      setPlayers((prev) =>
        prev.map((p) =>
          p.name === data.name ? { ...p, score: p.score + (data.points ?? 0) } : p
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
    }
  }, [timer, currentQuestion, showResults]);

  useEffect(() => {
    if (!currentQuestion || !pin) return;
    if (!showResults) return;
    if (endQuestionSentRef.current) return;
    endQuestionSentRef.current = true;
    socket.emit("end_question", { pin });
  }, [showResults, currentQuestion, pin]);

  useEffect(() => {
    if (!currentQuestion) return;
    if (timer <= 5 && timer > 0 && !showResults) {
      playBeep(660, 90);
    }
  }, [timer, currentQuestion, showResults]);

  const finalizeGame = () => {
    socket.emit("end_game", { pin });
    const leaderboard = [...players].sort((a, b) => b.score - a.score);
    setFinalResults(leaderboard.slice(0, 3));
    setStage("final");
    setCurrentQuestion(null);
    setTimer(0);
  };

  const cancelAndExit = () => {
    socket.emit("end_game", { pin });
    router.push("/host");
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
    setDurationSec(20);
    setTimer(20);
    setAnswers([]);
    endQuestionSentRef.current = false;

    socket.emit("start_question", { pin, question, durationSec: 20 });

    setStage("question");
    setQuestionIndex((prev) => prev + 1);
  };

  const renderLobby = () => (
    <div className="min-h-[70vh] flex flex-col items-center justify-center bg-gradient-to-b from-[#120d25] to-[#0f0a1f] rounded-3xl border border-white/10">
      <p className="text-purple-200 mb-2">Waiting for players…</p>
      <h2 className="text-4xl font-bold mb-2">
        {activeQuizTitle || "Loading…"}
      </h2>

      <p className="text-purple-100 mt-6 mb-2">Join with PIN</p>

      <button
        onClick={() => navigator.clipboard.writeText(pin)}
        className="bg-black/40 rounded-2xl px-10 py-6 border border-white/10 shadow-2xl hover:border-purple-300/50 transition mb-6"
      >
        <div className="text-6xl font-extrabold tracking-[0.3rem]">{pin}</div>
      </button>

      <div className="flex items-center gap-3">
        <button
          onClick={cancelAndExit}
          className="px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-lg font-semibold hover:bg-white/15 transition"
        >
          Cancel Game
        </button>

        <button
          onClick={nextQuestion}
          disabled={questionSet.length === 0}
          className="px-10 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-lg font-semibold shadow-lg hover:scale-[1.02] transition disabled:opacity-60 disabled:hover:scale-100"
        >
          Start Game
        </button>
      </div>

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

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">
          Question {questionIndex - 1} of {questionSet.length}
        </p>
        <div className="w-12 h-12 rounded-full border-4 border-purple-200 flex items-center justify-center text-purple-700 font-bold">
          {effectiveTimer}
        </div>
      </div>

        <div className="w-full bg-gray-200 h-2 rounded-full mb-6">
          <div
            className="h-2 rounded-full bg-purple-500 transition-all duration-1000"
            style={{ width: `${(effectiveTimer / Math.max(1, durationSec)) * 100}%` }}
          />
        </div>

      <div className="bg-gray-100 rounded-2xl p-6 mb-6">
        <h3 className="text-2xl font-bold text-center">
          {currentQuestion?.text}
        </h3>
      </div>

      {!showResults ? (
        <div className="grid grid-cols-2 gap-4">
          {(currentQuestion?.options ?? []).map((opt, idx) => {
            const colors = [
              "bg-red-500",
              "bg-blue-500",
              "bg-yellow-500",
              "bg-green-500",
            ];
            const shapes = ["■", "△", "⬟", "◯"];

            return (
              <div
                key={idx}
                className={`${
                  colors[idx % 4]
                } text-white p-5 rounded-xl flex items-center gap-3 text-lg font-semibold`}
              >
                <span className="text-2xl">{shapes[idx % 4]}</span>
                {opt}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {(currentQuestion?.options ?? []).map((opt, idx) => {
            const count = answers.filter((a) => a.answer === idx).length;
            const percentage = answers.length
              ? (count / answers.length) * 100
              : 0;
            const isCorrect = idx === currentQuestion?.correctAnswer;

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

  const renderFinal = () => (
    <div className="bg-white text-gray-900 rounded-3xl shadow-2xl p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">Game Over</p>
          <h2 className="text-3xl font-bold">Here are your winners</h2>
        </div>

        <button
          onClick={() => router.push("/host")}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
        >
          Back to Host
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

  return (
    <div className="min-h-screen bg-[#0f0a1f] text-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold">
            K
          </div>
          <div>
            <p className="text-sm text-purple-200">Host Game</p>
            <h1 className="text-xl font-semibold">{activeQuizTitle || "…"}</h1>
          </div>
        </div>

        <button
          onClick={() => router.push("/host")}
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-white/20 hover:bg-white/10 transition"
        >
          Back
        </button>
      </header>

      <div className="p-8 space-y-6">
        {stage === "lobby" && renderLobby()}
        {stage === "question" && currentQuestion && renderQuestion()}
        {stage === "final" && renderFinal()}
      </div>
    </div>
  );
}
