import type { Server as IOServer, Socket } from "socket.io";

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
  question?: {
    payload: QuestionPayload;
    startedAt: number; // epoch ms (server)
    durationSec: number;
    answered: Set<string>;
    perPlayer: Record<
      string,
      { answer: number; correct: boolean; points: number; timeLeftSec: number }
    >;
    ended?: boolean;
    endTimeout?: ReturnType<typeof setTimeout>;
  };
};

const rooms: Record<string, RoomState> = {};

const getRoom = (pin: string) => {
  if (!rooms[pin]) rooms[pin] = { players: [] };
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
  answer: number
): { correct: boolean; points: number; timeLeftSec: number } => {
  const q = room.question;
  if (!q) return { correct: false, points: 0, timeLeftSec: 0 };

  const correctAnswers = Array.isArray(q.payload.correctAnswers)
    ? q.payload.correctAnswers.map((value) => Number(value))
    : Number.isFinite(Number(q.payload.correctAnswer))
      ? [Number(q.payload.correctAnswer)]
      : [];
  const correct = correctAnswers.includes(answer);

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
          answer: number | null;
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

    const correctAnswers = Array.isArray(room.question.payload.correctAnswers)
      ? room.question.payload.correctAnswers.map((value) => Number(value))
      : Number.isFinite(Number(room.question.payload.correctAnswer))
        ? [Number(room.question.payload.correctAnswer)]
        : [];

    io.to(pin).emit("end_question", {
      questionId: room.question.startedAt,
      correctAnswers,
      results,
    });
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
      if (room.question?.endTimeout) clearTimeout(room.question.endTimeout);
      room.question = {
        payload: question,
        startedAt: Date.now(),
        durationSec: typeof durationSec === "number" && durationSec > 0 ? durationSec : 20,
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
    }
  );

  socket.on("end_question", ({ pin }: { pin: string }) => {
    revealQuestionIfActive(pin);
  });

  socket.on(
    "player_answer",
    (data: { pin: string; name: string; answer: number }) => {
      const room = getRoom(data.pin);
      if (!room.question) return;
      if (room.question.ended) return;
      if (room.question.answered.has(data.name)) return;

      room.question.answered.add(data.name);
      const { correct, points, timeLeftSec } = awardPoints(room, data.name, data.answer);
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
    }
  );

  socket.on("end_game", ({ pin }: { pin: string }) => {
    const room = getRoom(pin);
    if (room.question?.endTimeout) clearTimeout(room.question.endTimeout);
    room.question = undefined;

    const leaderboard = computeLeaderboard(room.players);
    const byName = leaderboard.reduce<Record<string, { score: number; rank: number }>>(
      (acc, p) => {
        acc[p.name] = { score: p.score, rank: p.rank };
        return acc;
      },
      {}
    );

    io.to(pin).emit("end_game", {
      totalPlayers: room.players.length,
      leaderboard: leaderboard.slice(0, 10),
      leaderboardAll: leaderboard,
      byName,
    });
  });

  socket.on("disconnect", () => {
    const { pin, name } = socket.data as SocketData;
    if (pin && name) {
      getRoom(pin).players = getRoom(pin).players.filter((p) => p.name !== name);
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
