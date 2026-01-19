import type { Server as IOServer, Socket } from "socket.io";
import { connectDB } from "@/lib/db";
import Game from "@/models/Game";
import GameHistory from "@/models/GameHistory";
import Quiz from "@/models/Quiz";

type PlayerInfo = { name: string; score: number };
type QuestionPayload = {
  text: string;
  options: string[];
  correctAnswer?: number | string;
  correctAnswers?: number[];
};

const instanceId = `${process.pid}-${Math.random().toString(16).slice(2)}`;
const instanceMeta = {
  instanceId,
  pid: process.pid,
  hostname: process.env.HOSTNAME ?? null,
};

type RoomState = {
  players: PlayerInfo[];
  startedAt?: number;
  history: {
    questionId: number;
    text: string;
    options: string[];
    correctAnswers: number[];
    startedAt: number;
    durationSec: number;
    results: Record<
      string,
      {
        answer: number | number[] | null;
        correct: boolean;
        points: number;
        timeLeftSec: number;
      }
    >;
  }[];
  historySaved?: boolean;
  question?: {
    payload: QuestionPayload;
    startedAt: number; // epoch ms (server)
    durationSec: number;
    answered: Set<string>;
    perPlayer: Record<
      string,
      {
        answer: number | number[];
        correct: boolean;
        points: number;
        timeLeftSec: number;
      }
    >;
    ended?: boolean;
    endTimeout?: ReturnType<typeof setTimeout>;
  };
};

const rooms: Record<string, RoomState> = {};

const getRoom = (pin: string) => {
  if (!rooms[pin]) rooms[pin] = { players: [], history: [] };
  return rooms[pin];
};

const upsertPlayer = (pin: string, name: string) => {
  const room = getRoom(pin);
  const existing = room.players.find((p) => p.name === name);
  if (!existing) room.players.push({ name, score: 0 });
};

const awardPoints = (
  room: RoomState,
  name: string,
  answer: number | number[],
): { correct: boolean; points: number; timeLeftSec: number } => {
  const q = room.question;
  if (!q) return { correct: false, points: 0, timeLeftSec: 0 };

  const normalizedCorrect = Array.isArray(q.payload.correctAnswers)
    ? q.payload.correctAnswers
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    : [];
  const correctAnswers =
    normalizedCorrect.length > 0
      ? normalizedCorrect
      : Number.isFinite(Number(q.payload.correctAnswer))
        ? [Number(q.payload.correctAnswer)]
        : [];
  const selected = Array.isArray(answer)
    ? answer.map((v) => Number(v))
    : [answer];
  const uniqueSelected = Array.from(new Set(selected)).sort((a, b) => a - b);
  const normalizedAnswers = Array.from(new Set(correctAnswers)).sort(
    (a, b) => a - b,
  );
  const correct =
    uniqueSelected.length > 0 &&
    uniqueSelected.length === normalizedAnswers.length &&
    uniqueSelected.every((value, index) => value === normalizedAnswers[index]);

  const elapsedSec = (Date.now() - q.startedAt) / 1000;
  const timeLeftSec = q.ended ? 0 : Math.max(0, q.durationSec - elapsedSec);
  const ratio = q.durationSec > 0 ? timeLeftSec / q.durationSec : 0;
  const points = correct ? Math.max(0, Math.round(1000 * ratio)) : 0;

  const player = room.players.find((p) => p.name === name);
  if (player) player.score += points;

  return { correct, points, timeLeftSec };
};

const computeLeaderboard = (players: PlayerInfo[]) => {
  const sorted = players
    .slice()
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((p, index) => {
    if (lastScore === null || p.score !== lastScore) {
      lastRank = index + 1;
      lastScore = p.score;
    }
    return { name: p.name, score: p.score, rank: lastRank };
  });
};

type SocketData = { pin?: string; name?: string };

function wireConnection(io: IOServer, socket: Socket) {
  socket.emit("server_info", instanceMeta);
  socket.on("debug_ping", () => {
    socket.emit("debug_pong", instanceMeta);
  });

  const broadcastRoomState = (pin: string) => {
    io.to(pin).emit("room_state", { players: getRoom(pin).players });
  };

  const revealQuestionIfActive = (pin: string) => {
    const room = getRoom(pin);
    if (!room.question) return;
    if (room.question.ended) return;
    if (room.question.endTimeout) {
      clearTimeout(room.question.endTimeout);
      room.question.endTimeout = undefined;
    }
    room.question.ended = true;

    const perPlayer = room.question.perPlayer ?? {};
    const results = room.players.reduce<
      Record<
        string,
        {
          answer: number | number[] | null;
          correct: boolean;
          points: number;
          timeLeftSec: number;
        }
      >
    >((acc, player) => {
      acc[player.name] = perPlayer[player.name] ?? {
        answer: null,
        correct: false,
        points: 0,
        timeLeftSec: 0,
      };
      return acc;
    }, {});

    const normalizedCorrect = Array.isArray(
      room.question.payload.correctAnswers,
    )
      ? room.question.payload.correctAnswers
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
      : [];
    const correctAnswers =
      normalizedCorrect.length > 0
        ? normalizedCorrect
        : Number.isFinite(Number(room.question.payload.correctAnswer))
          ? [Number(room.question.payload.correctAnswer)]
          : [];

    io.to(pin).emit("end_question", {
      questionId: room.question.startedAt,
      correctAnswers,
      results,
    });

    const existing = room.history.find(
      (entry) => entry.questionId === room.question?.startedAt,
    );
    if (!existing && room.question) {
      room.history.push({
        questionId: room.question.startedAt,
        text: room.question.payload.text,
        options: room.question.payload.options,
        correctAnswers,
        startedAt: room.question.startedAt,
        durationSec: room.question.durationSec,
        results,
      });
    }
  };

  socket.on("host_create_room", ({ pin }: { pin: string }) => {
    socket.join(pin);
    broadcastRoomState(pin);
  });

  socket.on("join_game", ({ pin, name }: { pin: string; name: string }) => {
    upsertPlayer(pin, name);
    (socket.data as SocketData).pin = pin;
    (socket.data as SocketData).name = name;
    socket.join(pin);
    io.to(pin).emit("player_joined", { name, players: getRoom(pin).players });
    broadcastRoomState(pin);
  });

  socket.on(
    "start_question",
    ({
      pin,
      question,
      durationSec,
    }: {
      pin: string;
      question: QuestionPayload;
      durationSec?: number;
    }) => {
      const room = getRoom(pin);
      if (!room.startedAt) room.startedAt = Date.now();
      if (room.question?.endTimeout) clearTimeout(room.question.endTimeout);
      room.question = {
        payload: question,
        startedAt: Date.now(),
        durationSec:
          typeof durationSec === "number" && durationSec > 0 ? durationSec : 20,
        answered: new Set<string>(),
        perPlayer: {},
        ended: false,
      };

      room.question.endTimeout = setTimeout(() => {
        revealQuestionIfActive(pin);
      }, room.question.durationSec * 1000);

      io.to(pin).emit("start_question", {
        question,
        startedAt: room.question.startedAt,
        durationSec: room.question.durationSec,
      });
    },
  );

  socket.on("end_question", ({ pin }: { pin: string }) => {
    revealQuestionIfActive(pin);
  });

  socket.on(
    "player_answer",
    (data: { pin: string; name: string; answer: number | number[] }) => {
      const room = getRoom(data.pin);
      if (!room.question) return;
      if (room.question.ended) return;
      if (room.question.answered.has(data.name)) return;

      room.question.answered.add(data.name);
      const { correct, points, timeLeftSec } = awardPoints(
        room,
        data.name,
        data.answer,
      );
      room.question.perPlayer[data.name] = {
        answer: data.answer,
        correct,
        points,
        timeLeftSec,
      };

      io.to(data.pin).emit("player_answer", {
        pin: data.pin,
        name: data.name,
        answer: data.answer,
        correct,
        points,
        timeLeftSec,
      });
      broadcastRoomState(data.pin);

      const totalPlayers = room.players.length;
      const answeredCount = room.question.answered.size;
      if (totalPlayers > 0 && answeredCount >= totalPlayers) {
        revealQuestionIfActive(data.pin);
      }
    },
  );

  socket.on("end_game", ({ pin }: { pin: string }) => {
    const room = getRoom(pin);
    if (room.question?.endTimeout) clearTimeout(room.question.endTimeout);
    room.question = undefined;

    const leaderboard = computeLeaderboard(room.players);
    const byName = leaderboard.reduce<
      Record<string, { score: number; rank: number }>
    >((acc, p) => {
      acc[p.name] = { score: p.score, rank: p.rank };
      return acc;
    }, {});

    io.to(pin).emit("end_game", {
      totalPlayers: room.players.length,
      leaderboard: leaderboard.slice(0, 10),
      leaderboardAll: leaderboard,
      byName,
    });

    if (!room.historySaved) {
      room.historySaved = true;
      void (async () => {
        try {
          await connectDB();
          const game = await Game.findOne({ pin });
          if (!game) return;
          const historyQuestions = room.history.map((entry) => ({
            questionId: entry.questionId,
            text: entry.text,
            options: entry.options,
            correctAnswers: entry.correctAnswers,
            startedAt: new Date(entry.startedAt),
            durationSec: entry.durationSec,
            results: Object.entries(entry.results).map(([name, payload]) => ({
              name,
              answer: payload.answer,
              correct: payload.correct,
              points: payload.points,
              timeLeftSec: payload.timeLeftSec,
            })),
          }));
          const ownerId =
            game.ownerId ??
            (await Quiz.findById(game.quizId).select({ ownerId: 1 }).lean())
              ?.ownerId ??
            undefined;
          await GameHistory.create({
            pin,
            quizId: game.quizId,
            ownerId,
            startedAt: room.startedAt ? new Date(room.startedAt) : new Date(),
            endedAt: new Date(),
            totalPlayers: room.players.length,
            players: leaderboard,
            questions: historyQuestions,
            leaderboard,
            leaderboardAll: leaderboard,
          });
          await Game.findOneAndUpdate(
            { pin },
            { status: "finished", players: room.players },
          );
        } catch (error) {
          console.error("Failed to persist game history:", error);
        }
      })();
    }
  });

  socket.on("disconnect", () => {
    const { pin, name } = socket.data as SocketData;
    if (pin && name) {
      getRoom(pin).players = getRoom(pin).players.filter(
        (p) => p.name !== name,
      );
      io.to(pin).emit("player_left", { name, players: getRoom(pin).players });
      broadcastRoomState(pin);
    }
  });
}

export function attachGameHandlers(io: IOServer) {
  io.on("connection", (socket) => {
    wireConnection(io, socket);
  });
}
