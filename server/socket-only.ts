import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import { attachGameHandlers } from "../src/lib/realtime/gameServer";

const port = Number(process.env.PORT ?? 3001);
const path = process.env.SOCKET_PATH ?? "/socket.io";

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("ok");
    return;
  }
  res.statusCode = 200;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end("socket server");
});

const io = new IOServer(httpServer, {
  path,
  cors: { origin: "*", methods: ["GET", "POST"] },
});
attachGameHandlers(io);

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Socket.IO listening on :${port}${path}`);
});

