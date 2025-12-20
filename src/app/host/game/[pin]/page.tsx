"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { initSocketServer, socket } from "@/lib/socketClient";
import { PseudoQrCode } from "@/components/PseudoQrCode";
import { kahootShapeForIndex, KahootShapeIcon } from "@/components/KahootShapeIcon";

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

type EndQuestionPayload = {
  questionId?: number;
  correctAnswer?: number;
  results?: Record<
    string,
    { answer: number; correct: boolean; points: number; timeLeftSec: number }
  >;
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
  const [postQuestionScreen, setPostQuestionScreen] = useState<
    "results" | "scoreboard"
  >("results");
  const endQuestionSentRef = useRef(false);
  const [expectedAnswerCount, setExpectedAnswerCount] = useState(0);
  const [questionEnded, setQuestionEnded] = useState(false);
  const [joinHost, setJoinHost] = useState<string>("");
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [joinLinkCopyState, setJoinLinkCopyState] = useState<
    "idle" | "copied"
  >("idle");
  const joinLinkCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const showResults =
    !!currentQuestion &&
    (questionEnded ||
      timer === 0 ||
      (expectedAnswerCount > 0 && answers.length >= expectedAnswerCount));
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

  useEffect(() => {
    if (!pin) return;
    if (typeof window === "undefined") return;
    setJoinHost(window.location.host);
    setJoinUrl(`${window.location.origin}/join?pin=${encodeURIComponent(pin)}`);
  }, [pin]);

  useEffect(() => {
    return () => {
      if (joinLinkCopyTimeoutRef.current) {
        clearTimeout(joinLinkCopyTimeoutRef.current);
        joinLinkCopyTimeoutRef.current = null;
      }
    };
  }, []);

  const copyToClipboard = async (value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // ignore
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = value;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textArea);
      return ok;
    } catch {
      return false;
    }
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
    const handleEndQuestion = (data: EndQuestionPayload) => {
      setQuestionEnded(true);
      setTimer(0);
      setPostQuestionScreen("results");
      endQuestionSentRef.current = true;

      if (data?.results) {
        const mapped: PlayerAnswerPayload[] = Object.entries(data.results).map(
          ([name, payload]) => ({
            name,
            answer: payload.answer,
            correct: payload.correct,
            points: payload.points,
            timeLeftSec: payload.timeLeftSec,
          })
        );
        setAnswers(mapped);
      }
    };
    socket.on("end_question", handleEndQuestion);

    return () => {
      socket.off("room_state", handleRoomState);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("player_left", handlePlayerLeft);
      socket.off("player_answer", handlePlayerAnswer);
      socket.off("end_question", handleEndQuestion);
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
    if (questionEnded) return;
    if (expectedAnswerCount > 0 && answers.length >= expectedAnswerCount) {
      setQuestionEnded(true);
      setTimer(0);
      setPostQuestionScreen("results");
      if (!endQuestionSentRef.current) {
        endQuestionSentRef.current = true;
        socket.emit("end_question", { pin });
      }
    }
  }, [answers.length, currentQuestion, expectedAnswerCount, pin, questionEnded]);

  useEffect(() => {
    if (!currentQuestion || !pin) return;
    if (questionEnded) return;
    if (timer !== 0) return;
    if (endQuestionSentRef.current) return;
    endQuestionSentRef.current = true;
    socket.emit("end_question", { pin });
  }, [timer, currentQuestion, pin, questionEnded]);

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
    setPostQuestionScreen("results");
    setExpectedAnswerCount(players.length);
    setQuestionEnded(false);

    socket.emit("start_question", { pin, question, durationSec: 20 });

    setStage("question");
    setQuestionIndex((prev) => prev + 1);
  };

  const startEnabled = questionSet.length > 0;
  const joinDisplayHost = joinHost || "this site";
  const joinDisplayUrl = useMemo(() => {
    if (joinUrl) return joinUrl;
    if (!pin) return "/join";
    return `/join?pin=${encodeURIComponent(pin)}`;
  }, [joinUrl, pin]);

  const copyJoinLink = async () => {
    const ok = await copyToClipboard(joinDisplayUrl);
    if (!ok) return;
    setJoinLinkCopyState("copied");
    if (joinLinkCopyTimeoutRef.current) {
      clearTimeout(joinLinkCopyTimeoutRef.current);
    }
    joinLinkCopyTimeoutRef.current = setTimeout(() => {
      setJoinLinkCopyState("idle");
    }, 1000);
  };

  const renderLobby = () => (
    <div className="relative min-h-screen overflow-hidden bg-[#2a0b5c] text-white">
      <div className="absolute inset-0 opacity-70">
        <div className="absolute -left-48 -top-48 h-[520px] w-[520px] rounded-full bg-purple-700/40 blur-3xl" />
        <div className="absolute -right-56 top-24 h-[560px] w-[560px] rounded-full bg-fuchsia-600/25 blur-3xl" />
        <div className="absolute left-1/3 -bottom-72 h-[680px] w-[680px] rounded-full bg-indigo-500/25 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="flex items-stretch gap-5 border-b border-white/10 bg-black/20 px-6 py-5 backdrop-blur">
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={cancelAndExit}
              className="h-11 w-11 rounded-full bg-white text-[#2a0b5c] shadow-sm ring-1 ring-black/5 hover:bg-white/90"
              aria-label="Exit"
            >
              <span className="inline-flex items-center justify-center text-xl">
                ⟵
              </span>
            </button>
            <button
              type="button"
              className="h-11 w-11 rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15"
              aria-label="Audio"
            >
              <span className="inline-flex items-center justify-center text-lg">
                🔊
              </span>
            </button>
            <button
              type="button"
              className="h-11 w-11 rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15"
              aria-label="Controls"
            >
              <span className="inline-flex items-center justify-center text-lg">
                ⎚
              </span>
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-5xl">
              <div className="grid grid-cols-12 overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10">
                <div className="col-span-4 bg-white px-6 py-4 text-gray-800">
                  <p className="text-lg leading-snug">
                    Join at{" "}
                    <span className="font-extrabold tracking-tight">
                      {joinDisplayHost}
                    </span>{" "}
                    <span className="whitespace-nowrap">/join</span>
                    <br />
                    or with the app
                  </p>
                </div>

                <div className="col-span-5 flex items-center justify-center bg-white px-6 py-3 text-gray-900">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-700">
                      Game PIN:
                    </p>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(pin)}
                      className="mt-1 text-6xl font-black tracking-[0.22em] hover:text-gray-700"
                      title="Copy PIN"
                    >
                      {pin || "—"}
                    </button>
                  </div>
                </div>

                <div className="col-span-3 flex items-center justify-center bg-white p-4">
                  <PseudoQrCode
                    data={joinDisplayUrl}
                    size={136}
                    className="rounded-md"
                    label="Join game QR code"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-white/80">
                <button
                  type="button"
                  onClick={copyJoinLink}
                  className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15 hover:bg-white/15"
                  title="Copy join link"
                >
                  {joinLinkCopyState === "copied" ? "Copied" : "Copy join link"}
                </button>
                <span className="truncate">{joinDisplayUrl}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center px-6">
          <div className="absolute left-6 top-6">
            <div className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3 ring-1 ring-white/10 backdrop-blur">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-black/25 ring-1 ring-white/10">
                <span className="text-2xl">👤</span>
              </div>
              <div className="text-2xl font-extrabold tabular-nums">
                {players.length}
              </div>
            </div>
          </div>

          <div className="absolute right-6 top-6">
            <div className="flex items-stretch gap-3">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 ${
                  startEnabled ? "text-white" : "text-white/60"
                }`}
                aria-hidden="true"
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7.5 10V8.5C7.5 6.01472 9.51472 4 12 4C14.4853 4 16.5 6.01472 16.5 8.5V10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6.5 10H17.5C18.6046 10 19.5 10.8954 19.5 12V18C19.5 19.1046 18.6046 20 17.5 20H6.5C5.39543 20 4.5 19.1046 4.5 18V12C4.5 10.8954 5.39543 10 6.5 10Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <button
                type="button"
                onClick={nextQuestion}
                disabled={!startEnabled}
                className="h-14 rounded-xl bg-white px-8 text-xl font-extrabold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="text-[92px] font-black tracking-tight drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              Kahoot!
            </div>

            <div className="mt-7 rounded-xl bg-black/35 px-7 py-4 text-2xl font-semibold ring-1 ring-white/10 backdrop-blur">
              Waiting for players…
            </div>

            {players.length > 0 && (
              <div className="mt-10 flex max-w-4xl flex-wrap justify-center gap-3 px-6">
                {players.slice(0, 18).map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-white ring-1 ring-white/15"
                    title={p.name}
                  >
                    <span className="text-xl">{avatarForName(p.name)}</span>
                    <span className="max-w-[12rem] truncate font-semibold">
                      {p.name}
                    </span>
                  </div>
                ))}
                {players.length > 18 && (
                  <div className="rounded-full bg-white/10 px-4 py-2 text-white/90 ring-1 ring-white/15">
                    +{players.length - 18} more
                  </div>
                )}
              </div>
            )}

            <div className="mt-10 text-white/80">
              {activeQuizTitle || "Loading quiz…"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderQuestion = () => (
    <>
      {showResults ? (
        <div className="relative min-h-[calc(100vh-88px)] bg-gradient-to-br from-[#2a0b5c] via-[#1b0b2e] to-[#0b1b4a] text-white overflow-hidden">
          <div className="absolute inset-0 opacity-75">
            <div className="absolute -left-48 -top-48 h-[620px] w-[620px] rounded-full bg-purple-700/35 blur-3xl" />
            <div className="absolute -right-56 top-24 h-[680px] w-[680px] rounded-full bg-fuchsia-600/25 blur-3xl" />
            <div className="absolute left-1/3 -bottom-72 h-[760px] w-[760px] rounded-full bg-indigo-500/25 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.10),rgba(255,255,255,0)_55%)]" />
          </div>

          <div className="relative z-10 flex min-h-[calc(100vh-88px)] flex-col px-6 pt-6 pb-20">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 flex justify-center">
                <div className="max-w-5xl w-full rounded-xl bg-white px-8 py-5 shadow-2xl ring-1 ring-black/10">
                  <h2 className="text-center text-4xl font-extrabold tracking-tight text-gray-900">
                    {postQuestionScreen === "scoreboard"
                      ? "Scoreboard"
                      : currentQuestion?.text}
                  </h2>
                </div>
              </div>

              <div className="shrink-0 flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (postQuestionScreen === "results") {
                      setPostQuestionScreen("scoreboard");
                      return;
                    }
                    nextQuestion();
                  }}
                  className="rounded-lg bg-white px-5 py-3 text-lg font-bold text-gray-900 shadow ring-1 ring-black/10 hover:bg-white/90"
                >
                  Next
                </button>
              </div>
            </div>

            {(() => {
              if (postQuestionScreen === "scoreboard") {
                const leaderboard = players
                  .slice()
                  .sort((a, b) => b.score - a.score);

                return (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-5xl px-2">
                      <div className="mt-12 space-y-4">
                        {leaderboard.slice(0, 10).map((p) => (
                          <div
                            key={p.name}
                            className="h-20 rounded-xl bg-white shadow-2xl ring-1 ring-black/10 flex items-center justify-between px-6"
                          >
                            <div className="flex items-center gap-5">
                              <div className="h-12 w-12 rounded-lg bg-gray-100 ring-1 ring-black/5 flex items-center justify-center text-2xl">
                                {avatarForName(p.name)}
                              </div>
                              <div className="text-3xl font-extrabold tracking-tight text-gray-900">
                                {p.name}
                              </div>
                            </div>
                            <div className="text-4xl font-black tabular-nums text-gray-900">
                              {p.score}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              const options = (currentQuestion?.options ?? []).slice(0, 4);
              const counts = options.map(
                (_, idx) => answers.filter((a) => a.answer === idx).length
              );
              const maxCount = Math.max(1, ...counts);
              const meta = [
                {
                  bg: "bg-red-600/85",
                  bar: "bg-red-500",
                  tile: "bg-red-600",
                  chip: "bg-red-600/90",
                  shape: kahootShapeForIndex(0),
                },
                {
                  bg: "bg-blue-600/85",
                  bar: "bg-blue-500",
                  tile: "bg-blue-600",
                  chip: "bg-blue-600/90",
                  shape: kahootShapeForIndex(1),
                },
                {
                  bg: "bg-yellow-600/85",
                  bar: "bg-yellow-500",
                  tile: "bg-yellow-600",
                  chip: "bg-yellow-600/90",
                  shape: kahootShapeForIndex(2),
                },
                {
                  bg: "bg-green-700/85",
                  bar: "bg-green-500",
                  tile: "bg-green-700",
                  chip: "bg-green-700/90",
                  shape: kahootShapeForIndex(3),
                },
              ] as const;

              return (
                <>
                  <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-4xl">
                      <div className="h-[320px] flex items-end justify-center gap-10">
                        {counts.map((count, idx) => {
                          const heightPct = (count / maxCount) * 100;
                          const barHeight =
                            count === 0 ? 0 : Math.max(10, heightPct);
                          return (
                            <div
                              key={idx}
                              className="flex flex-col items-center justify-end h-full"
                            >
                              <div
                                className={`w-[92px] rounded-md shadow-2xl ring-1 ring-black/20 ${meta[idx].bar}`}
                                style={{ height: `${barHeight}%` }}
                                title={`${count} answers`}
                              >
                                <div className="h-full w-full flex items-end justify-start">
                                  <div className="flex items-center gap-2 px-3 py-2 text-white text-lg font-extrabold drop-shadow">
                                    <span className="inline-flex items-center justify-center">
                                      <KahootShapeIcon
                                        kind={meta[idx].shape}
                                        className="h-5 w-5 text-white"
                                      />
                                    </span>
                                    <span className="tabular-nums">{count}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-6 flex items-center justify-center gap-3">
                        {counts.map((count, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 rounded-md px-4 py-2 text-white font-bold shadow ring-1 ring-black/20 ${meta[idx].chip}`}
                          >
                            <span className="inline-flex items-center justify-center">
                              <KahootShapeIcon
                                kind={meta[idx].shape}
                                className="h-5 w-5 text-white"
                              />
                            </span>
                            <span className="tabular-nums">{count}</span>
                            {idx === currentQuestion?.correctAnswer && (
                              <KahootShapeIcon
                                kind={meta[idx].shape}
                                variant="outline"
                                className="h-5 w-5 text-white/90"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 grid grid-cols-2 gap-0 overflow-hidden rounded-xl ring-1 ring-white/10 shadow-2xl">
                    {options.map((opt, idx) => {
                      const isCorrect = idx === currentQuestion?.correctAnswer;
                      return (
                        <div
                          key={idx}
                          className={`relative h-[120px] ${meta[idx].tile}`}
                        >
                          <div className="relative h-full flex items-center justify-between px-8">
                            <div className="flex items-center gap-5">
                              <KahootShapeIcon
                                kind={meta[idx].shape}
                                className="h-10 w-10 text-white"
                              />
                              <div className="text-3xl font-extrabold tracking-tight text-white/90">
                                {opt}
                              </div>
                            </div>
                            <div className="text-4xl font-black text-white/70">
                              {isCorrect ? (
                                <KahootShapeIcon
                                  kind={meta[idx].shape}
                                  variant="outline"
                                  className="h-9 w-9 text-white/85"
                                />
                              ) : (
                                "✕"
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            <div className="absolute bottom-0 left-0 right-0">
              <div className="h-14 bg-gradient-to-r from-purple-950/60 via-indigo-950/60 to-fuchsia-950/60 backdrop-blur ring-1 ring-white/10 px-6 flex items-center justify-between text-white/90">
                <div className="font-semibold tabular-nums">
                  {Math.max(1, questionIndex - 1)}/{Math.max(1, questionSet.length)}
                </div>
                <div className="font-semibold">
                  <span className="opacity-90">kahoot.it</span>
                  <span className="mx-3 opacity-60">•</span>
                  <span className="opacity-90">Game PIN:</span>{" "}
                  <span className="font-extrabold tracking-wide">{pin}</span>
                </div>
                <div className="w-[80px]" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white text-gray-900 rounded-3xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-purple-600 font-semibold">
                Game PIN: {pin}
              </span>
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
              style={{
                width: `${(effectiveTimer / Math.max(1, durationSec)) * 100}%`,
              }}
            />
          </div>

          <div className="bg-gray-100 rounded-2xl p-6 mb-6">
            <h3 className="text-2xl font-bold text-center">
              {currentQuestion?.text}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(currentQuestion?.options ?? []).map((opt, idx) => {
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
        </div>
      )}
    </>
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
    stage === "lobby" ? (
      renderLobby()
    ) : (
      <div className="min-h-screen bg-[#0f0a1f] text-white">
        <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-black/30 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold">
              K
            </div>
            <div>
              <p className="text-sm text-purple-200">Host Game</p>
              <h1 className="text-xl font-semibold">
                {activeQuizTitle || "…"}
              </h1>
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
          {stage === "question" && currentQuestion && renderQuestion()}
          {stage === "final" && renderFinal()}
        </div>
      </div>
    )
  );
}
