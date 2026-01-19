"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import { normalizeCorrectAnswers } from "@/lib/quizDefaults";

const DEFAULT_QUESTION_DURATION_SEC = 20;
const DEFAULT_QUESTION_DURATION_MS = DEFAULT_QUESTION_DURATION_SEC * 1000;

interface Player {
  name: string;
  score: number;
}

type HostStage = "dashboard" | "builder" | "lobby" | "question" | "final";

type EditableQuestion = {
  text: string;
  options: string[];
  correctAnswers: number[];
  durationSec: number;
  media?: { kind: "image" | "video"; src: string; mime?: string };
};

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
  const [timer, setTimer] = useState(DEFAULT_QUESTION_DURATION_SEC);
  const [timerMs, setTimerMs] = useState(DEFAULT_QUESTION_DURATION_MS);
  const [gameEnded, setGameEnded] = useState(false);
  const [finalResults, setFinalResults] = useState<Player[]>([]);

  // SEARCH
  const [searchTerm, setSearchTerm] = useState("");

  // BUILDER
  const [builderTitle, setBuilderTitle] = useState("");
  const [builderBackgroundImage, setBuilderBackgroundImage] = useState<
    string | undefined
  >(undefined);
  const [builderQuizId, setBuilderQuizId] = useState<string | null>(null);
  const [builderQuestions, setBuilderQuestions] = useState<EditableQuestion[]>([
    {
      text: "Untitled question",
      options: ["", "", "", ""],
      correctAnswers: [0],
      durationSec: DEFAULT_QUESTION_DURATION_SEC,
    },
  ]);
  const [builderIndex, setBuilderIndex] = useState(0);
  const deletedQuestionStackRef = useRef<
    { question: EditableQuestion; index: number; replace?: boolean }[]
  >([]);
  const [deletedQuestionStackSize, setDeletedQuestionStackSize] = useState(0);
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [jsonPasteText, setJsonPasteText] = useState("");

  // FILE IMPORT
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [copyToast, setCopyToast] = useState("");

  const refreshQuizzes = async () => {
    setLoadingQuizzes(true);
    try {
      const res = await fetch("/api/quizzes");
      const data = await res.json();
      setQuizzes(data);
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

  const normalizeImportedQuestions = (raw: unknown) => {
    const payload =
      raw && typeof raw === "object" && "questions" in raw
        ? (raw as {
            questions: unknown;
            title?: unknown;
            backgroundImage?: unknown;
          })
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

    const normalizeCorrectAnswers = (
      candidate: unknown,
      options: string[]
    ): number[] => {
      const indices = new Set<number>();

      const parseIndex = (value: unknown): number | undefined => {
        if (typeof value === "number" && Number.isFinite(value)) {
          const idx = Math.trunc(value);
          if (idx >= 0 && idx < options.length) return idx;
          if (idx - 1 >= 0 && idx - 1 < options.length) return idx - 1;
          return undefined;
        }

        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed) return undefined;
          const letterMatch = trimmed.match(/^[a-d]$/i);
          if (letterMatch) {
            return letterMatch[0].toLowerCase().charCodeAt(0) - "a".charCodeAt(0);
          }
          const asNum = Number(trimmed);
          if (Number.isFinite(asNum)) {
            const idx = Math.trunc(asNum);
            if (idx >= 0 && idx < options.length) return idx;
            if (idx - 1 >= 0 && idx - 1 < options.length) return idx - 1;
          }
          const byText = options.findIndex((opt) => opt === trimmed);
          if (byText >= 0) return byText;
        }

        return undefined;
      };

      const addValue = (value: unknown) => {
        if (typeof value === "string" && /[,;|]/.test(value)) {
          value
            .split(/[,;|]/g)
            .map((part) => part.trim())
            .filter(Boolean)
            .forEach((part) => {
              const idx = parseIndex(part);
              if (typeof idx === "number") indices.add(idx);
            });
          return;
        }
        const idx = parseIndex(value);
        if (typeof idx === "number") indices.add(idx);
      };

      if (Array.isArray(candidate)) {
        candidate.forEach(addValue);
      } else if (typeof candidate !== "undefined") {
        addValue(candidate);
      }

      if (indices.size === 0) indices.add(0);

      return Array.from(indices).sort((a, b) => a - b);
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

      const candidate =
        typeof obj.correctAnswers !== "undefined"
          ? obj.correctAnswers
          : typeof obj.correctAnswer !== "undefined"
            ? obj.correctAnswer
            : typeof obj.answerIndex !== "undefined"
              ? obj.answerIndex
              : obj.answer;
      const correctAnswers = normalizeCorrectAnswers(candidate, options);
      const durationSec = normalizeDurationSec(
        typeof obj.durationSec !== "undefined" ? obj.durationSec : obj.duration
      );

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
        questions.push({
          text,
          options,
          correctAnswers,
          durationSec,
          media: { kind, src, mime },
        });
      } else {
        questions.push({ text, options, correctAnswers, durationSec });
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
      backgroundImage:
        payload && typeof payload.backgroundImage === "string"
          ? payload.backgroundImage
          : undefined,
      questions,
    };
  };

  const parseRawQuizText = (text: string) => {
    const stripDiacritics = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\u0111/g, "d")
        .replace(/\u0110/g, "D");

    const isAnswerLine = (line: string) => {
      const normalized = stripDiacritics(line).toLowerCase();
      return normalized.startsWith("dap an") || normalized.startsWith("answer");
    };

    const extractAnswerIndex = (line: string, optionCount: number) => {
      const afterColon = line.includes(":") ? line.split(":").slice(1).join(":") : line;
      const letters = afterColon.match(/[a-d]/gi) ?? [];
      if (letters.length > 0) {
        const letter = letters[0].toLowerCase();
        return letter.charCodeAt(0) - "a".charCodeAt(0);
      }
      const numbers = afterColon.match(/\d+/g) ?? [];
      if (numbers.length > 0) {
        const value = Number(numbers[0]);
        if (Number.isFinite(value)) {
          const idx = Math.trunc(value);
          if (idx >= 0 && idx < optionCount) return idx;
          if (idx - 1 >= 0 && idx - 1 < optionCount) return idx - 1;
        }
      }
      return 0;
    };

    const lines = text.split(/\r?\n/);
    const blocks: string[][] = [];
    let current: string[] = [];

    const pushCurrent = () => {
      if (current.length > 0) blocks.push(current);
      current = [];
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^\d+\.\s*/.test(trimmed) && current.length > 0) {
        pushCurrent();
      }
      current.push(trimmed);
    }
    pushCurrent();

    if (blocks.length === 0 && text.trim()) {
      blocks.push([text.trim()]);
    }

    const questions: EditableQuestion[] = [];
    for (const block of blocks) {
      let questionText = "";
      const options: string[] = [];
      let answerIndex: number | null = null;

      for (const rawLine of block) {
        if (!rawLine) continue;
        const line = rawLine.trim();
        if (!line) continue;

        if (isAnswerLine(line)) {
          answerIndex = extractAnswerIndex(line, options.length || 4);
          continue;
        }

        const optionMatch = line.match(/^\s*([a-d])[\.\)]\s*(.+)$/i);
        if (optionMatch) {
          const optionText = optionMatch[2]?.trim() ?? "";
          options.push(optionText);
          continue;
        }

        if (!questionText) {
          questionText = line.replace(/^\d+\.\s*/, "").trim();
          continue;
        }

        if (options.length === 0) {
          questionText = `${questionText} ${line}`.trim();
        }
      }

      if (!questionText && options.length === 0) continue;
      const normalizedOptions = options.slice(0, 4);
      while (normalizedOptions.length < 4) normalizedOptions.push("");
      const normalizedAnswer =
        answerIndex !== null
          ? Math.max(0, Math.min(normalizedOptions.length - 1, answerIndex))
          : 0;

      questions.push({
        text: questionText || "Untitled question",
        options: normalizedOptions,
        correctAnswers: [normalizedAnswer],
        durationSec: DEFAULT_QUESTION_DURATION_SEC,
      });
    }

    return { questions };
  };

  const applyImportedText = (text: string) => {
    try {
      const parsed = JSON.parse(text) as unknown;
      const { title, questions, backgroundImage } =
        normalizeImportedQuestions(parsed);
      if (title) setBuilderTitle(title);
      setBuilderBackgroundImage(
        typeof backgroundImage === "string" && backgroundImage.trim()
          ? backgroundImage
          : undefined
      );
      setBuilderQuestions(questions);
      setBuilderIndex(0);
      setBuilderQuizId(null);
      deletedQuestionStackRef.current = [];
      setDeletedQuestionStackSize(0);
      setStage("builder");
      return;
    } catch (error) {
      const { questions } = parseRawQuizText(text);
      if (questions.length === 0) {
        const message =
          error instanceof Error
            ? error.message
            : "Invalid JSON or raw quiz format.";
        throw new Error(message);
      }
      setBuilderQuestions(questions);
      setBuilderIndex(0);
      setBuilderQuizId(null);
      setBuilderBackgroundImage(undefined);
      deletedQuestionStackRef.current = [];
      setDeletedQuestionStackSize(0);
      setStage("builder");
    }
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

  // BUILDER FUNCTIONS — unchanged
  const startEditingQuiz = (quizId: string) => {
    const quiz = quizzes.find((q) => q._id === quizId);
    if (!quiz) return;

    setBuilderQuizId(quizId);
    setBuilderTitle(quiz.title || "Untitled Quiz");
    setBuilderBackgroundImage(
      typeof quiz.backgroundImage === "string" ? quiz.backgroundImage : undefined
    );
    setBuilderQuestions(
      (quiz.questions || []).map((q: any) => ({
        text: q.text,
        options: q.options,
        correctAnswers: normalizeCorrectAnswers(
          typeof q.correctAnswers !== "undefined" ? q.correctAnswers : q.correctAnswer,
          Array.isArray(q.options) ? q.options : ["", "", "", ""]
        ),
        durationSec: normalizeDurationSec(q.durationSec),
        media: q.media,
      }))
    );
    setBuilderIndex(0);
    deletedQuestionStackRef.current = [];
    setDeletedQuestionStackSize(0);
    setStage("builder");
  };

  const createNewQuiz = () => {
    setBuilderQuizId(null);
    setBuilderTitle("New Quiz");
    setBuilderBackgroundImage(undefined);
    setBuilderQuestions([
      {
        text: "Untitled question",
        options: ["", "", "", ""],
        correctAnswers: [0],
        durationSec: DEFAULT_QUESTION_DURATION_SEC,
      },
    ]);
    setBuilderIndex(0);
    deletedQuestionStackRef.current = [];
    setDeletedQuestionStackSize(0);
    setStage("builder");
  };

  const deleteBuilderQuestion = (index: number) => {
    const target = builderQuestions[index];
    if (target) {
      const replace = builderQuestions.length <= 1;
      deletedQuestionStackRef.current = [
        ...deletedQuestionStackRef.current,
        { question: target, index, replace },
      ];
      setDeletedQuestionStackSize(deletedQuestionStackRef.current.length);
    }

    setBuilderQuestions((prev) => {
      if (prev.length <= 1) {
        return [
          {
            text: "Untitled question",
            options: ["", "", "", ""],
            correctAnswers: [0],
            durationSec: DEFAULT_QUESTION_DURATION_SEC,
          },
        ];
      }
      return prev.filter((_, i) => i !== index);
    });
    setBuilderIndex((prevIndex) => {
      if (index < prevIndex) return prevIndex - 1;
      if (index === prevIndex) return Math.max(0, prevIndex - 1);
      return prevIndex;
    });
  };

  const undoDeleteBuilderQuestion = useCallback(() => {
    const stack = deletedQuestionStackRef.current;
    if (stack.length === 0) return;
    const last = stack[stack.length - 1];
    deletedQuestionStackRef.current = stack.slice(0, -1);
    setDeletedQuestionStackSize(deletedQuestionStackRef.current.length);
    setBuilderQuestions((prev) => {
      if (last.replace) {
        return [last.question];
      }
      const next = [...prev];
      const insertAt = Math.min(Math.max(last.index, 0), next.length);
      next.splice(insertAt, 0, last.question);
      return next;
    });
    setBuilderIndex(last.index);
  }, []);

  useEffect(() => {
    if (stage !== "builder") return;
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") {
        return;
      }
      if (event.shiftKey) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTextInput =
        tagName === "input" || tagName === "textarea" || target?.isContentEditable;
      if (isTextInput) return;

      event.preventDefault();
      undoDeleteBuilderQuestion();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stage, undoDeleteBuilderQuestion]);

  const saveQuiz = async () => {
    const sanitized = builderQuestions.map((q) => ({
      text: q.text,
      options: q.options,
      correctAnswers: q.correctAnswers,
      durationSec: normalizeDurationSec(q.durationSec),
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
        backgroundImage: builderBackgroundImage ?? null,
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
        loadingQuizzes={loadingQuizzes}
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
        backgroundInputRef={backgroundInputRef}
        builderTitle={builderTitle}
        builderBackgroundImage={builderBackgroundImage}
        builderQuestions={builderQuestions}
        builderIndex={builderIndex}
        onBuilderTitleChange={setBuilderTitle}
        onSetBackgroundImage={setBuilderBackgroundImage}
        onSelectQuestion={setBuilderIndex}
        onAddQuestion={() =>
          setBuilderQuestions((prev) => [
            ...prev,
            {
              text: "New question",
              options: ["", "", "", ""],
              correctAnswers: [0],
              durationSec: DEFAULT_QUESTION_DURATION_SEC,
            },
          ])
        }
        onDeleteQuestion={deleteBuilderQuestion}
        onReorderQuestion={(fromIndex, toIndex) => {
          setBuilderQuestions((prev) => {
            if (fromIndex < 0 || fromIndex >= prev.length) return prev;
            if (toIndex < 0 || toIndex >= prev.length) return prev;
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return next;
          });
          setBuilderIndex((prevIndex) => {
            if (prevIndex === fromIndex) return toIndex;
            if (fromIndex < prevIndex && toIndex >= prevIndex) return prevIndex - 1;
            if (fromIndex > prevIndex && toIndex <= prevIndex) return prevIndex + 1;
            return prevIndex;
          });
        }}
        onUpdateQuestionText={(text) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) => (i === builderIndex ? { ...q, text } : q))
          )
        }
        onUpdateDuration={(durationSec) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) =>
              i === builderIndex ? { ...q, durationSec } : q
            )
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
        onToggleCorrect={(optionIndex) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) => {
              if (i !== builderIndex) return q;
              const current = q.correctAnswers ?? [];
              const has = current.includes(optionIndex);
              const next = has
                ? current.filter((idx) => idx !== optionIndex)
                : [...current, optionIndex];
              const normalized = next.length > 0 ? next : [optionIndex];
              return { ...q, correctAnswers: normalized.sort((a, b) => a - b) };
            })
          )
        }
        onSetMedia={(media) =>
          setBuilderQuestions((prev) =>
            prev.map((q, i) => (i === builderIndex ? { ...q, media } : q))
          )
        }
        onCancel={() => setStage("dashboard")}
        onOpenPasteJson={() => {
          setJsonPasteText("");
          setShowJsonPaste(true);
        }}
        canUndoDelete={deletedQuestionStackSize > 0}
        onUndoDelete={undoDeleteBuilderQuestion}
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
      <input
        ref={backgroundInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const maxBytes = 5 * 1024 * 1024;
            if (file.size > maxBytes) {
              alert("Background image is too large (max 5MB).");
              return;
            }

            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = () => reject(new Error("read failed"));
              reader.onload = () => resolve(String(reader.result || ""));
              reader.readAsDataURL(file);
            });

            setBuilderBackgroundImage(dataUrl);
          } finally {
            e.target.value = "";
          }
        }}
      />

      <HostJsonImportInput
        inputRef={fileInputRef}
        onImportText={async (text) => {
          applyImportedText(text);
        }}
        onError={(message) => alert(message)}
      />

      {showJsonPaste ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white text-gray-900 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Paste JSON</h2>
              <button
                onClick={() => setShowJsonPaste(false)}
                className="px-3 py-1 rounded-md border border-gray-200 text-gray-600"
              >
                Close
              </button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                value={jsonPasteText}
                onChange={(e) => setJsonPasteText(e.target.value)}
                className="w-full h-64 rounded-xl border border-gray-200 p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-200"
                placeholder='{"title":"My Quiz","questions":[{"text":"Question?","options":["A","B"],"correctAnswers":[0],"durationSec":20}]}'
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowJsonPaste(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    try {
                      applyImportedText(jsonPasteText);
                      setJsonPasteText("");
                      setShowJsonPaste(false);
                    } catch (error) {
                      const message =
                        error instanceof Error ? error.message : "Invalid JSON";
                      alert(message);
                    }
                  }}
                  className="px-5 py-2 rounded-lg bg-purple-600 text-white font-semibold"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
