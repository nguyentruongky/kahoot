"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { initSocketServer, socket } from "@/lib/socketClient";
import type {
  EndQuestionPayload,
  Player,
  PlayerAnswerPayload,
  QuizQuestion,
} from "@/app/host/game/types";
import {
  BACKGROUND_BASE_CLASS,
  DEFAULT_BACKGROUND_IMAGE,
  backgroundStyle,
} from "@/lib/backgrounds";
import { mergePlayers } from "@/app/host/game/utils";
import { HostLobbyScreen } from "@/app/host/game/_components/HostLobbyScreen";
import { HostQuestionScreen } from "@/app/host/game/_components/HostQuestionScreen";
import { HostFinalScreen } from "@/app/host/game/_components/HostFinalScreen";

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
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>(
    DEFAULT_BACKGROUND_IMAGE
  );
  const [answers, setAnswers] = useState<PlayerAnswerPayload[]>([]);
  const [timer, setTimer] = useState(20);
  const [timerMs, setTimerMs] = useState(20000);
  const [durationSec, setDurationSec] = useState(20);
  const [stage, setStage] = useState<"lobby" | "question" | "final">("lobby");
  const [postQuestionScreen, setPostQuestionScreen] = useState<
    "results" | "scoreboard"
  >("results");
  const endQuestionSentRef = useRef(false);
  const [expectedAnswerCount, setExpectedAnswerCount] = useState(0);
  const [questionEnded, setQuestionEnded] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [joinLinkCopyState, setJoinLinkCopyState] = useState<"idle" | "copied">(
    "idle"
  );
  const joinLinkCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const showResults =
    !!currentQuestion &&
    (questionEnded ||
      timer === 0 ||
      (expectedAnswerCount > 0 && answers.length >= expectedAnswerCount));
  const effectiveTimer = showResults ? 0 : timer;
  const effectiveTimerMs = showResults ? 0 : timerMs;

  const playBeep = (frequency = 880, durationMs = 120) => {
    try {
      const AudioContextCtor =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx: AudioContext =
        (window as any).__quizzaAudioCtx || new AudioContextCtor();
      (window as any).__quizzaAudioCtx = ctx;
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

  useEffect(() => {
    if (!pin) return;
    if (typeof window === "undefined") return;
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

        const quizData: {
          title?: string;
          questions?: QuizQuestion[];
          backgroundImage?: string;
        } = await quizRes.json();
        const questions = quizData.questions ?? [];

        if (questions.length === 0) {
          alert("This quiz has no questions!");
          router.push("/host");
          return;
        }

        if (cancelled) return;
        setActiveQuizTitle(quizData.title || "Quiz");
        setBackgroundImage(
          typeof quizData.backgroundImage === "string" &&
            quizData.backgroundImage.trim()
            ? quizData.backgroundImage
            : undefined
        );
        setQuestionSet(questions);
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
    const handleEndQuestion = (data: EndQuestionPayload) => {
      setQuestionEnded(true);
      setTimer(0);
      setTimerMs(0);
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
    if (!currentQuestion || showResults) return;
    const durationMs = Math.max(1, durationSec) * 1000;
    const start = performance.now();
    setTimerMs(durationMs);
    setTimer(durationSec);

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
  }, [currentQuestion, durationSec, showResults]);

  useEffect(() => {
    if (!currentQuestion || !pin) return;
    if (questionEnded) return;
    if (expectedAnswerCount > 0 && answers.length >= expectedAnswerCount) {
      setQuestionEnded(true);
      setTimer(0);
      setTimerMs(0);
      setPostQuestionScreen("results");
      if (!endQuestionSentRef.current) {
        endQuestionSentRef.current = true;
        socket.emit("end_question", { pin });
      }
    }
  }, [
    answers.length,
    currentQuestion,
    expectedAnswerCount,
    pin,
    questionEnded,
  ]);

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
    setStage("final");
    setCurrentQuestion(null);
    setTimer(0);
    setTimerMs(0);
  };

  const requestEndGame = () => {
    const confirmed = window.confirm(
      "End the game now? This will stop the game for everyone and show final results."
    );
    if (!confirmed) return;
    finalizeGame();
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

    const nextDurationSec = 20;
    setCurrentQuestion(question);
    setDurationSec(nextDurationSec);
    setTimer(nextDurationSec);
    setTimerMs(nextDurationSec * 1000);
    setAnswers([]);
    endQuestionSentRef.current = false;
    setPostQuestionScreen("results");
    setExpectedAnswerCount(players.length);
    setQuestionEnded(false);

    socket.emit("start_question", {
      pin,
      question,
      durationSec: nextDurationSec,
    });

    setStage("question");
    setQuestionIndex((prev) => prev + 1);
  };

  const startEnabled = questionSet.length > 0;
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

  const handleQuestionNext = () => {
    if (postQuestionScreen === "results") {
      setPostQuestionScreen("scoreboard");
      return;
    }
    nextQuestion();
  };

  const activeBackgroundStyle = backgroundStyle(
    backgroundImage || DEFAULT_BACKGROUND_IMAGE
  );
  const backgroundClassName = BACKGROUND_BASE_CLASS;

  const fallbackScreen = (
    <div
      className={`min-h-screen text-white ${backgroundClassName}`}
      style={activeBackgroundStyle}
    >
      <header className="flex items-center justify-between border-b border-white/10 bg-black/30 px-8 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-purple-500 to-pink-500 text-xl font-bold">
            K
          </div>
          <div>
            <p className="text-sm text-purple-200">Host Game</p>
            <h1 className="text-xl font-semibold">{activeQuizTitle || "…"}</h1>
          </div>
        </div>

        <button
          onClick={() => router.push("/host")}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
        >
          Back
        </button>
      </header>

      <div className="space-y-6 p-8" />
    </div>
  );

  const screens = {
    lobby: (
      <HostLobbyScreen
        backgroundClassName={backgroundClassName}
        backgroundStyle={activeBackgroundStyle}
        activeQuizTitle={activeQuizTitle}
        pin={pin}
        joinDisplayUrl={joinDisplayUrl}
        joinLinkCopyState={joinLinkCopyState}
        players={players}
        startEnabled={startEnabled}
        onClose={cancelAndExit}
        onStart={nextQuestion}
        onCopyJoinLink={copyJoinLink}
      />
    ),
    question: currentQuestion ? (
      <HostQuestionScreen
        backgroundClassName={backgroundClassName}
        backgroundStyle={activeBackgroundStyle}
        showResults={showResults}
        postQuestionScreen={postQuestionScreen}
        currentQuestion={currentQuestion}
        players={players}
        answers={answers}
        effectiveTimer={effectiveTimer}
        effectiveTimerMs={effectiveTimerMs}
        durationSec={durationSec}
        questionIndex={questionIndex}
        questionSetLength={questionSet.length}
        pin={pin}
        onEndGame={requestEndGame}
        onNext={handleQuestionNext}
      />
    ) : null,
    final: (
      <HostFinalScreen
        backgroundClassName={backgroundClassName}
        backgroundStyle={activeBackgroundStyle}
        activeQuizTitle={activeQuizTitle}
        pin={pin}
        players={players}
        onBackToHost={() => router.push("/host")}
      />
    ),
  } satisfies Record<typeof stage, React.ReactNode>;

  return screens[stage] ?? fallbackScreen;
}
