"use client";
import { useState, useEffect } from "react";
import { socket } from "@/lib/socketClient";

interface Player {
  name: string;
  score: number;
}

export default function HostPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [gameStarted, setGameStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionSet, setQuestionSet] = useState<any[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [timer, setTimer] = useState(20);
  const [gameEnded, setGameEnded] = useState(false);
  const [finalResults, setFinalResults] = useState<Player[]>([]);

  const mergePlayers = (incoming: Player[], previous: Player[]) => {
    const scoreMap = new Map(previous.map((p) => [p.name, p.score]));
    const seen = new Set<string>();

    return incoming.reduce<Player[]>((acc, player) => {
      if (seen.has(player.name)) return acc;
      seen.add(player.name);
      acc.push({
        name: player.name,
        score: scoreMap.get(player.name) ?? player.score ?? 0,
      });
      return acc;
    }, []);
  };

  // --- Load available quizzes ---
  useEffect(() => {
    fetch("/api/quizzes")
      .then((res) => res.json())
      .then((data) => setQuizzes(data));
  }, []);

  // --- Set up socket listeners once ---
  useEffect(() => {
    // Initialize socket server by calling the API endpoint
    fetch("/api/socket").catch(console.error);

    // Ensure socket is connected
    if (!socket.connected) {
      console.log("🔌 Connecting socket...");
      socket.connect();
    }

    socket.on("connect", () => {
      console.log("✅ Host socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("❌ Host socket disconnected");
    });

    const handleRoomState = (data: { players: Player[] }) => {
      setPlayers((prev) => mergePlayers(data.players ?? [], prev));
    };

    const handlePlayerJoined = (data: { name: string; players?: Player[] }) => {
      console.log("🟢 HOST RECEIVED: Player joined:", data);
      setPlayers((prev) =>
        mergePlayers(
          data.players ?? [...prev, { name: data.name, score: 0 }],
          prev
        )
      );
    };

    const handlePlayerLeft = (data: { name: string; players?: Player[] }) => {
      console.log("🔴 HOST RECEIVED: Player left:", data);
      setPlayers((prev) =>
        mergePlayers(
          (data.players ?? prev).filter((p) => p.name !== data.name),
          prev
        )
      );
    };

    const handlePlayerAnswer = (data: any) => {
      console.log("📝 HOST RECEIVED: Player answered:", data);
      setAnswers((prev) => [...prev, data]);

      // Update player score if answer is correct
      if (data.correct) {
        setPlayers((prev) =>
          prev.map((player) =>
            player.name === data.name
              ? { ...player, score: player.score + 100 }
              : player
          )
        );
      }
    };

    socket.on("room_state", handleRoomState);
    socket.on("player_joined", handlePlayerJoined);
    socket.on("player_left", handlePlayerLeft);
    socket.on("player_answer", handlePlayerAnswer);

    console.log("👂 Host listening for events");

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room_state", handleRoomState);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("player_left", handlePlayerLeft);
      socket.off("player_answer", handlePlayerAnswer);
    };
  }, []);

  // --- Join host room when pin is available ---
  useEffect(() => {
    if (pin) {
      const joinRoom = () => {
        console.log("🎮 Host joining room with PIN:", pin);
        console.log("Socket connected?", socket.connected);
        console.log("Socket ID:", socket.id);
        socket.emit("host_create_room", { pin });
      };

      // Give socket a moment to be ready
      const timer = setTimeout(() => {
        if (socket.connected) {
          joinRoom();
        } else {
          console.log("⏳ Waiting for socket connection...");
          socket.once("connect", () => {
            console.log("🔗 Socket connected, now joining room");
            joinRoom();
          });
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [pin]);

  // --- Timer countdown for questions ---
  useEffect(() => {
    if (currentQuestion && timer > 0 && !showResults) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (timer === 0 && currentQuestion && !showResults) {
      setShowResults(true);
    }
  }, [currentQuestion, timer, showResults]);

  // --- Auto-show results when all players answered ---
  useEffect(() => {
    if (
      currentQuestion &&
      !showResults &&
      players.length > 0 &&
      answers.length === players.length
    ) {
      console.log("🎯 All players answered! Showing results...");
      setShowResults(true);
      setTimer(0);
    }
  }, [answers.length, players.length, currentQuestion, showResults]);

  // --- Create new game (generate PIN) ---
  const startGame = async () => {
    if (!selectedQuiz) return;
    try {
      const [gameRes, quizRes] = await Promise.all([
        fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId: selectedQuiz }),
        }),
        fetch(`/api/quizzes/${selectedQuiz}`),
      ]);

      if (!gameRes.ok || !quizRes.ok) {
        alert("Error creating game. Please try again.");
        return;
      }

      const [gameData, quizData] = await Promise.all([
        gameRes.json(),
        quizRes.json(),
      ]);

      const limitedQuestions = (quizData?.questions ?? []).slice(0, 5);
      if (limitedQuestions.length === 0) {
        alert("This quiz has no questions!");
        return;
      }

      setPin(gameData.pin);
      setGameEnded(false);
      setFinalResults([]);
      setQuestionSet(limitedQuestions);
      setQuestionIndex(0);
      setCurrentQuestion(null);
      setAnswers([]);
      setShowResults(false);
      setTimer(20);
      setPlayers([]);
      setGameStarted(true);
    } catch (error) {
      console.error("Error starting game:", error);
      alert("Error starting game. Please try again.");
    }
  };

  const finalizeGame = () => {
    socket.emit("end_game", { pin });
    const leaderboard = [...players].sort((a, b) => b.score - a.score);
    setFinalResults(leaderboard.slice(0, 3));
    setGameEnded(true);
    setCurrentQuestion(null);
    setShowResults(false);
    setTimer(0);
  };

  const resetToLobby = () => {
    setGameStarted(false);
    setGameEnded(false);
    setCurrentQuestion(null);
    setQuestionIndex(0);
    setQuestionSet([]);
    setPlayers([]);
    setAnswers([]);
    setShowResults(false);
    setTimer(20);
    setFinalResults([]);
    setPin("");
  };

  // --- Send next question ---
  const nextQuestion = () => {
    const totalQuestions = questionSet.length;

    if (totalQuestions === 0) {
      alert("No questions loaded for this game.");
      return;
    }

    if (questionIndex >= totalQuestions) {
      finalizeGame();
      return;
    }

    const question = questionSet[questionIndex];
    if (!question) {
      finalizeGame();
      return;
    }

    setCurrentQuestion(question);
    setTimer(20);
    setAnswers([]);
    setShowResults(false);
    socket.emit("start_question", { pin, question });
    setQuestionIndex((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800">
      {!gameStarted ? (
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold text-purple-700 mb-3">
                Host Dashboard
              </h1>
              <p className="text-gray-600 text-lg">
                Select a quiz to start your game
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Choose Quiz
                </label>
                <select
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl text-lg focus:border-purple-500 focus:outline-none text-gray-900 bg-white"
                  onChange={(e) => setSelectedQuiz(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a quiz
                  </option>
                  {quizzes.map((q) => (
                    <option key={q._id} value={q._id}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={startGame}
                disabled={!selectedQuiz}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-105 active:scale-95 text-lg shadow-lg"
              >
                Create Game
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen p-6">
          {/* Header with PIN */}
          <div className="max-w-6xl mx-auto mb-6">
            <div className="bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-2xl p-6 text-center">
              <p className="text-white/80 text-sm font-medium mb-1">GAME PIN</p>
              <h1 className="text-6xl font-bold text-white font-mono tracking-wider">
                {pin}
              </h1>
            </div>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Players List - Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">Players</h3>
                  <span className="bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded-full text-sm">
                    {players.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {players.length === 0 ? (
                    <p className="text-gray-400 text-center py-8 text-sm">
                      Waiting for players to join...
                    </p>
                  ) : (
                    players.map((player, idx) => (
                      <div
                        key={idx}
                        className="bg-gradient-to-r from-purple-50 to-indigo-50 p-3 rounded-lg flex justify-between items-center"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {idx + 1}
                          </div>
                          <span className="font-medium text-gray-800">
                            {player.name}
                          </span>
                        </div>
                        <span className="text-green-600 font-bold">
                          {player.score}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-2">
              {gameEnded ? (
                <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-4xl font-bold text-gray-800 mb-2">
                    Final Standings
                  </h2>
                  <p className="text-gray-600 mb-8">
                    Congratulations to the top players!
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {finalResults.length === 0 && (
                      <p className="text-gray-500 col-span-3">No players joined.</p>
                    )}
                    {finalResults.map((player, idx) => {
                      const colors = ["from-yellow-400 to-orange-500", "from-gray-300 to-gray-400", "from-amber-200 to-amber-300"];
                      const medals = ["🥇", "🥈", "🥉"];
                      return (
                        <div
                          key={player.name}
                          className={`bg-gradient-to-br ${colors[idx]} text-gray-900 rounded-2xl p-6 shadow-lg flex flex-col items-center`}
                        >
                          <div className="text-5xl mb-2">{medals[idx]}</div>
                          <div className="text-2xl font-bold">{player.name}</div>
                          <div className="text-lg font-semibold text-gray-700 mt-2">
                            {player.score} pts
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={resetToLobby}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold px-10 py-4 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition transform hover:scale-105 text-lg shadow-lg"
                  >
                    Back to Lobby
                  </button>
                </div>
              ) : currentQuestion ? (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                  {/* Timer Bar */}
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-white font-semibold">
                        Question {questionIndex}
                      </h4>
                      <div
                        className={`text-4xl font-bold ${
                          timer <= 5 ? "text-red-300 animate-pulse" : "text-white"
                        }`}
                      >
                        {timer}s
                      </div>
                    </div>
                    <div className="w-full bg-white/30 rounded-full h-2">
                      <div
                        className="bg-white h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${(timer / 20) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-8">
                    <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                      {currentQuestion.text}
                    </h3>

                    {!showResults ? (
                      <div className="grid grid-cols-2 gap-4">
                        {currentQuestion.options.map((opt: string, i: number) => {
                          const colors = [
                            "bg-red-500",
                            "bg-blue-500",
                            "bg-yellow-500",
                            "bg-green-500",
                          ];
                          const shapes = ["△", "◇", "○", "□"];
                          return (
                            <div
                              key={i}
                              className={`${colors[i % 4]} text-white p-6 rounded-2xl shadow-lg`}
                            >
                              <div className="text-4xl mb-2">{shapes[i % 4]}</div>
                              <div className="font-bold text-lg">{opt}</div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                          Results
                        </h4>
                        {currentQuestion.options.map((opt: string, i: number) => {
                          const count = answers.filter((a) => a.answer === i).length;
                          const isCorrect = i === Number(currentQuestion.correctAnswer);
                          const percentage =
                            answers.length > 0 ? (count / answers.length) * 100 : 0;

                          return (
                            <div
                              key={i}
                              className={`border-2 p-4 rounded-xl transition-all ${
                                isCorrect
                                  ? "bg-green-50 border-green-500"
                                  : "bg-gray-50 border-gray-200"
                              }`}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-800">
                                    {opt}
                                  </span>
                                  {isCorrect && (
                                    <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
                                      CORRECT
                                    </span>
                                  )}
                                </div>
                                <span className="text-gray-600 font-semibold">
                                  {count} ({percentage.toFixed(0)}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all duration-500 ${
                                    isCorrect ? "bg-green-500" : "bg-purple-500"
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}

                        <div className="text-center pt-4">
                          <p className="text-gray-600 mb-4">
                            {answers.length} of {players.length} players answered
                          </p>
                          <button
                            onClick={nextQuestion}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-8 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition transform hover:scale-105 shadow-lg"
                          >
                            Continue →
                          </button>
                        </div>
                      </div>
                    )}

                    {!showResults && (
                      <div className="mt-6 text-center">
                        <p className="text-gray-600 font-medium">
                          {answers.length} / {players.length} answered
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                  <div className="mb-6">
                    <div className="text-6xl mb-4">🎮</div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">
                      Ready to Start?
                    </h2>
                    <p className="text-gray-600">
                      {players.length} player{players.length !== 1 ? "s" : ""} waiting
                    </p>
                  </div>
                  <button
                    onClick={nextQuestion}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold px-10 py-4 rounded-xl hover:from-green-700 hover:to-emerald-700 transition transform hover:scale-105 text-lg shadow-lg"
                  >
                    Start First Question
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
