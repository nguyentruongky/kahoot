// src/lib/socketServer.js
const { Server } = require("socket.io");

let io = null;

function initSocket(server) {
  if (io) return io;

  io = new Server(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    console.log("🟢 Connected:", socket.id);

    socket.on("join_game", ({ pin, name }) => {
      socket.join(pin);
      io.to(pin).emit("player_joined", { name });
    });
  });

  return io;
}

module.exports = { initSocket };
