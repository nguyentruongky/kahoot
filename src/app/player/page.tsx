"use client";
import { socket } from "@/lib/socketClient";
import { useEffect } from "react";

export default function PlayerPage() {
  useEffect(() => {
    socket.emit("join_game", { pin: "123456", name: "Trang" });

    socket.on("player_joined", (data) => {
      console.log("Another player joined:", data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return <div className="p-6 text-center">Joined game room 🎮</div>;
}
