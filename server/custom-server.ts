import { createServer } from "http";
import next from "next";
import { Server as IOServer } from "socket.io";
import { attachGameHandlers } from "../src/lib/realtime/gameServer";

const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== "production";
const SOCKET_IO_VERSION = 3;

const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new IOServer(httpServer, {
    path: "/api/socket",
    cors: { origin: "*", methods: ["GET", "POST"] },
  });
  (io as IOServer & { _kahootVersion?: number })._kahootVersion = SOCKET_IO_VERSION;
  (httpServer as typeof httpServer & { io?: IOServer }).io = io;
  attachGameHandlers(io);

  httpServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Custom server listening on http://localhost:${port}`);
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
