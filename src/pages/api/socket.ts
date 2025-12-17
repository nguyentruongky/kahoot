import { Server as IOServer } from "socket.io";
import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as NetServer } from "http";
import type { Socket as NetSocket } from "net";

const SOCKET_IO_VERSION = 3;

type PlayerInfo = { name: string; score: number };
type QuestionPayload = {
  text: string;
  options: string[];
  correctAnswer: number | string;
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
  if (!rooms[pin]) {
    rooms[pin] = { players: [] };
  }
  return rooms[pin];
};

const upsertPlayer = (pin: string, name: string) => {
  const room = getRoom(pin);
  const existing = room.players.find((p) => p.name === name);
  if (!existing) {
    room.players.push({ name, score: 0 });
  }
};

const awardPoints = (
  room: RoomState,
  name: string,
  answer: number
): { correct: boolean; points: number; timeLeftSec: number } => {
  const q = room.question;
  if (!q) return { correct: false, points: 0, timeLeftSec: 0 };

  const correctAnswer = Number(q.payload.correctAnswer);
  const correct = answer === correctAnswer;

  const elapsedSec = (Date.now() - q.startedAt) / 1000;
  const timeLeftSec = q.ended ? 0 : Math.max(0, q.durationSec - elapsedSec);
  const ratio = q.durationSec > 0 ? timeLeftSec / q.durationSec : 0;
  const points = correct ? Math.max(0, Math.round(1000 * ratio)) : 0;

  const player = room.players.find((p) => p.name === name);
  if (player) {
    player.score += points;
  }

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

export const config = {
  api: {
    bodyParser: false,
  },
};

type NextApiResponseServerIO = NextApiResponse & {
  socket: NetSocket & {
    server: NetServer & {
      io?: IOServer;
    };
  };
};

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket?.server) {
    res.status(500).end("Socket not available");
    return;
  }

  if (res.socket.server.io) {
    const existing = res.socket.server.io as IOServer & { _kahootVersion?: number };
    if (existing._kahootVersion !== SOCKET_IO_VERSION) {
      try {
        console.log("♻️ Recreating Socket.IO server (version changed)...");
        existing.removeAllListeners();
        existing.close();
      } catch (error) {
        console.warn("⚠️ Failed to close existing Socket.IO server:", error);
      }
      res.socket.server.io = undefined;
    }
  }

  if (!res.socket.server.io) {
    console.log("🧩 Setting up Socket.IO server...");
    const io = new IOServer(res.socket.server, {
      path: "/api/socket",
      cors: { origin: "*", methods: ["GET", "POST"] },
    });
    (io as IOServer & { _kahootVersion?: number })._kahootVersion =
      SOCKET_IO_VERSION;

    io.on("connection", (socket) => {
      console.log("🟢 Client connected:", socket.id);

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
        const perPlayer =
          (
            room.question as unknown as {
              perPlayer?: NonNullable<RoomState["question"]>["perPlayer"];
            }
          ).perPlayer ?? {};
        const results = room.players.reduce<
          Record<
            string,
            { answer: number | null; correct: boolean; points: number; timeLeftSec: number }
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

        console.log("⏱️ Time up / reveal question:", {
          pin,
          players: room.players.length,
          answered: room.question.answered.size,
        });
        io.to(pin).emit("end_question", {
          questionId: room.question.startedAt,
          correctAnswer: Number(room.question.payload.correctAnswer),
          results,
        });
      };

      // Host creates a room
      socket.on("host_create_room", ({ pin }) => {
        console.log("🎮 Host created room:", pin);
        socket.join(pin);
        broadcastRoomState(pin);
      });

      // Player joins a game
      socket.on("join_game", ({ pin, name }) => {
        console.log("👤 Player joining:", name, "to PIN:", pin);
        upsertPlayer(pin, name);
        socket.data.pin = pin;
        socket.data.name = name;
        socket.join(pin);
        io.to(pin).emit("player_joined", { name, players: getRoom(pin).players });
        broadcastRoomState(pin);
      });

      // Host starts a question
      socket.on(
        "start_question",
        ({ pin, question, durationSec }: { pin: string; question: QuestionPayload; durationSec?: number }) => {
        console.log("❓ Question sent to room:", pin);
        const room = getRoom(pin);
        if (room.question?.endTimeout) {
          clearTimeout(room.question.endTimeout);
        }
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
      });

      // Host ends/reveals a question (timer expired or host advanced)
      socket.on("end_question", ({ pin }: { pin: string }) => {
        revealQuestionIfActive(pin);
      });

      // Player submits an answer
      socket.on("player_answer", (data: { pin: string; name: string; answer: number }) => {
        console.log("📝 Answer received:", data);
        const room = getRoom(data.pin);
        if (!room.question) return;
        if (room.question.ended) return;
        if (room.question.answered.has(data.name)) return;

        room.question.answered.add(data.name);
        const { correct, points, timeLeftSec } = awardPoints(room, data.name, data.answer);
        if (!(room.question as any).perPlayer) (room.question as any).perPlayer = {};
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

        // If everyone has answered, auto end/reveal the question early.
        const totalPlayers = room.players.length;
        const answeredCount = room.question.answered.size;
        if (totalPlayers > 0 && answeredCount >= totalPlayers) {
          revealQuestionIfActive(data.pin);
        }
      });

      // Host ends the game
      socket.on("end_game", ({ pin }) => {
        console.log("🏁 Game ended:", pin);
        const room = getRoom(pin);
        if (room.question?.endTimeout) {
          clearTimeout(room.question.endTimeout);
        }
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
          byName,
        });
      });

      socket.on("disconnect", () => {
        console.log("🔴 Client disconnected:", socket.id);
        const { pin, name } = socket.data as { pin?: string; name?: string };
        if (pin && name) {
          getRoom(pin).players = getRoom(pin).players.filter((p) => p.name !== name);
          io.to(pin).emit("player_left", { name, players: getRoom(pin).players });
          broadcastRoomState(pin);
        }
      });
    });

    res.socket.server.io = io;
  } else {
    console.log("♻️ Socket.IO already running");
  }
  res.end();
}
