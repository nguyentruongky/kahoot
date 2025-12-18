import { io } from "socket.io-client";

const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
const socketPath =
  process.env.NEXT_PUBLIC_SOCKET_PATH ?? (socketUrl ? "/socket.io" : "/api/socket");

export const socket = io(socketUrl, {
  path: socketPath,
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionAttempts: 10,
  reconnectionDelayMax: 2000,
  transports: ["websocket", "polling"],
});

let debugWired = false;
function wireDebug() {
  if (debugWired) return;
  debugWired = true;
  socket.on("connect_error", (err) => {
    // eslint-disable-next-line no-console
    console.error("❌ socket connect_error", err?.message ?? err, err);
  });
  socket.on("disconnect", (reason) => {
    // eslint-disable-next-line no-console
    console.warn("🔌 socket disconnected", reason);
  });
  socket.on("server_info", (info) => {
    // eslint-disable-next-line no-console
    console.log("🧭 socket server_info", info);
  });
  socket.on("debug_pong", (info) => {
    // eslint-disable-next-line no-console
    console.log("🏓 socket debug_pong", info);
  });
}
wireDebug();

export async function initSocketServer(): Promise<void> {
  if (socketUrl) return;
  try {
    await fetch("/api/socket");
  } catch {
    // ignore
  }
}
