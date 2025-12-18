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

export async function initSocketServer(): Promise<void> {
  if (socketUrl) return;
  try {
    await fetch("/api/socket");
  } catch {
    // ignore
  }
}
