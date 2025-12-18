import { Server as IOServer } from "socket.io";
import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as NetServer } from "http";
import type { Socket as NetSocket } from "net";
import { attachGameHandlers } from "@/lib/realtime/gameServer";

const SOCKET_IO_VERSION = 3;

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
    attachGameHandlers(io);

    res.socket.server.io = io;
  } else {
    console.log("♻️ Socket.IO already running");
  }
  res.end();
}
