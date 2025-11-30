import { io } from "socket.io-client";

export const socket = io({
  path: "/api/socket",
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionAttempts: 10,
  reconnectionDelayMax: 2000,
  transports: ['websocket', 'polling'],
});
