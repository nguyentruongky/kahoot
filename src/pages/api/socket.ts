import { Server } from "socket.io";
import type { NextApiRequest, NextApiResponse } from "next";

type PlayerInfo = { name: string; score: number };

const rooms: Record<string, PlayerInfo[]> = {};

const getRoomPlayers = (pin: string) => {
  if (!rooms[pin]) {
    rooms[pin] = [];
  }
  return rooms[pin];
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket.server.io) {
    console.log("🧩 Setting up Socket.IO server...");
    const io = new Server(res.socket.server, {
      path: "/api/socket",
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    io.on("connection", (socket) => {
      console.log("🟢 Client connected:", socket.id);

      const broadcastRoomState = (pin: string) => {
        io.to(pin).emit("room_state", { players: getRoomPlayers(pin) });
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
        const players = getRoomPlayers(pin);
        if (!players.find((p) => p.name === name)) {
          players.push({ name, score: 0 });
        }
        socket.data.pin = pin;
        socket.data.name = name;
        socket.join(pin);
        io.to(pin).emit("player_joined", { name, players });
        broadcastRoomState(pin);
      });

      // Host starts a question
      socket.on("start_question", ({ pin, question }) => {
        console.log("❓ Question sent to room:", pin);
        io.to(pin).emit("start_question", { question });
      });

      // Player submits an answer
      socket.on("player_answer", (data) => {
        console.log("📝 Answer received:", data);
        io.to(data.pin).emit("player_answer", data);
      });

      // Host ends the game
      socket.on("end_game", ({ pin }) => {
        console.log("🏁 Game ended:", pin);
        io.to(pin).emit("end_game");
      });

      socket.on("disconnect", () => {
        console.log("🔴 Client disconnected:", socket.id);
        const { pin, name } = socket.data as { pin?: string; name?: string };
        if (pin && name) {
          rooms[pin] = getRoomPlayers(pin).filter((p) => p.name !== name);
          io.to(pin).emit("player_left", { name, players: rooms[pin] });
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
