import { Server } from "socket.io";
import type { NextApiRequest, NextApiResponse } from "next";

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

      socket.on("join_game", ({ pin, name }) => {
        socket.join(pin);
        io.to(pin).emit("player_joined", { name });
      });

      socket.on("disconnect", () => {
        console.log("🔴 Client disconnected:", socket.id);
      });
    });

    res.socket.server.io = io;
  } else {
    console.log("♻️ Socket.IO already running");
  }
  res.end();
}
