"use client";
import { socket } from "@/lib/socketClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Question {
  text: string;
  options: string[];
  correctAnswer: number;
}

export default function PlayerPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<"waiting" | "playing" | "ended">("waiting");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);

  useEffect(() => {
    // Initialize socket server by calling the API endpoint
    fetch("/api/socket").catch(console.error);

    // Get player info from sessionStorage
    const storedPin = sessionStorage.getItem("gamePin");
    const storedName = sessionStorage.getItem("playerName");

    if (!storedPin || !storedName) {
      router.push("/join");
      return;
    }

    setPin(storedPin);
    setName(storedName);

    // Ensure socket is connected
    if (!socket.connected) {
      console.log("🔌 Player connecting socket...");
      socket.connect();
    }

    socket.on("connect", () => {
      console.log("✅ Player socket connected:", socket.id);
    });

    // Join the game room
    const joinGame = () => {
      console.log("👤 PLAYER EMITTING join_game:", { pin: storedPin, name: storedName });
      console.log("Socket connected?", socket.connected);
      console.log("Socket ID:", socket.id);
      socket.emit("join_game", { pin: storedPin, name: storedName });
    };

    // Wait a bit for socket to connect
    const timer = setTimeout(() => {
      if (socket.connected) {
        joinGame();
      } else {
        console.log("⏳ Waiting for socket connection...");
        socket.once("connect", () => {
          console.log("🔗 Socket connected, now joining");
          joinGame();
        });
      }
    }, 1000);

    // Listen for new questions
    const handleStartQuestion = (data: { question: Question }) => {
      console.log("📝 New question received:", data);
      setCurrentQuestion(data.question);
      setSelectedAnswer(null);
      setAnswered(false);
      setFeedback(null);
      setGameStatus("playing");
    };

    // Listen for game end
    const handleEndGame = () => {
      console.log("🎉 Game ended");
      setGameStatus("ended");
      setCurrentQuestion(null);
    };

    socket.on("start_question", handleStartQuestion);
    socket.on("end_game", handleEndGame);

    return () => {
      clearTimeout(timer);
      socket.off("connect");
      socket.off("start_question", handleStartQuestion);
      socket.off("end_game", handleEndGame);
    };
  }, [router]);

  const handleAnswerSelect = (index: number) => {
    if (answered) return;

    setSelectedAnswer(index);
    setAnswered(true);

    // Check if answer is correct (convert to number in case it's a string from DB)
    const isCorrect = currentQuestion && index === Number(currentQuestion.correctAnswer);
    setFeedback(isCorrect ? "correct" : "incorrect");

    if (isCorrect) {
      setScore((prev) => prev + 100);
    }

    // Emit answer to server
    socket.emit("player_answer", {
      pin,
      name,
      answer: index,
      correct: isCorrect,
    });
  };

  const getAnswerColorClass = (index: number) => {
    if (!answered) {
      // Default colors before answering
      const colors = [
        "bg-red-500 hover:bg-red-600",
        "bg-blue-500 hover:bg-blue-600",
        "bg-yellow-500 hover:bg-yellow-600",
        "bg-green-500 hover:bg-green-600",
      ];
      return colors[index % 4];
    }

    // After answering, show correct/incorrect
    if (index === selectedAnswer) {
      return feedback === "correct" ? "bg-green-600" : "bg-red-600";
    }

    if (currentQuestion && index === Number(currentQuestion.correctAnswer)) {
      return "bg-green-600";
    }

    return "bg-gray-400";
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-purple-900 p-4">
      {/* Header */}
      <div className="w-full max-w-2xl mb-6 text-center">
        <div className="bg-white rounded-lg shadow-lg p-4 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Player</p>
            <p className="text-lg font-bold text-purple-700">{name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Score</p>
            <p className="text-lg font-bold text-green-600">{score}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">PIN</p>
            <p className="text-lg font-bold text-purple-700 font-mono">{pin}</p>
          </div>
        </div>
      </div>

      {/* Game Content */}
      {gameStatus === "waiting" && (
        <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
          <div className="animate-pulse">
            <h2 className="text-3xl font-bold text-purple-700 mb-4">
              Waiting for host to start...
            </h2>
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce delay-100"></div>
              <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        </div>
      )}

      {gameStatus === "playing" && currentQuestion && (
        <div className="w-full max-w-2xl">
          {/* Question Text */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-800">
              {currentQuestion.text}
            </h2>
          </div>

          {/* Answer Options */}
          <div className="grid grid-cols-2 gap-4">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={answered}
                className={`${getAnswerColorClass(
                  index
                )} text-white font-bold py-8 px-6 rounded-xl shadow-lg transform transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:transform-none`}
              >
                <div className="text-4xl mb-2">
                  {["△", "◇", "○", "□"][index % 4]}
                </div>
                <div className="text-lg">{option}</div>
              </button>
            ))}
          </div>

          {/* Feedback */}
          {answered && feedback && (
            <div
              className={`mt-6 p-4 rounded-lg text-center text-white font-bold text-xl ${
                feedback === "correct" ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {feedback === "correct" ? "✓ Correct! +100 points" : "✗ Incorrect"}
            </div>
          )}
        </div>
      )}

      {gameStatus === "ended" && (
        <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
          <h2 className="text-4xl font-bold text-purple-700 mb-4">
            Game Over!
          </h2>
          <div className="text-6xl mb-4">🎉</div>
          <p className="text-2xl text-gray-700 mb-2">Final Score</p>
          <p className="text-5xl font-bold text-green-600 mb-6">{score}</p>
          <button
            onClick={() => router.push("/join")}
            className="bg-purple-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-purple-700 transition"
          >
            Join Another Game
          </button>
        </div>
      )}
    </div>
  );
}
