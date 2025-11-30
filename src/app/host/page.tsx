"use client";
import { useState, useEffect } from "react";
import { socket } from "@/lib/socketClient";

export default function HostPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [gameStarted, setGameStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  // --- Load available quizzes ---
  useEffect(() => {
    fetch("/api/quizzes")
      .then((res) => res.json())
      .then((data) => setQuizzes(data));
  }, []);

  // --- Listen for players joining ---
  useEffect(() => {
    socket.on("player_joined", (data) => {
      console.log("🟢 Player joined:", data);
    });
    return () => socket.off("player_joined");
  }, []);

  // --- Create new game (generate PIN) ---
  const startGame = async () => {
    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId: selectedQuiz }),
    });
    const data = await res.json();
    setPin(data.pin);
    setGameStarted(true);
  };

  // --- Send next question ---
  const nextQuestion = async () => {
    const res = await fetch(`/api/quizzes/${selectedQuiz}`);
    const quiz = await res.json();
    const question = quiz.questions[questionIndex];
    if (question) {
      setCurrentQuestion(question);
      socket.emit("start_question", { pin, question });
      setQuestionIndex(questionIndex + 1);
    } else {
      socket.emit("end_game", { pin });
      alert("🎉 Quiz finished!");
      setGameStarted(false);
      setQuestionIndex(0);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-purple-50 p-6">
      <h1 className="text-3xl font-bold text-purple-700 mb-4">
        Host Dashboard 🎮
      </h1>

      {!gameStarted ? (
        <>
          <select
            className="border rounded p-2 mb-3"
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
          <button
            onClick={startGame}
            disabled={!selectedQuiz}
            className="bg-purple-600 text-white rounded-full px-6 py-2 hover:bg-purple-700 disabled:opacity-50"
          >
            Start Game
          </button>
        </>
      ) : (
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Game PIN: <span className="font-mono text-purple-600">{pin}</span>
          </h2>
          {currentQuestion ? (
            <div className="bg-white shadow p-4 rounded-xl mt-4 w-96">
              <h3 className="text-xl font-bold mb-2">{currentQuestion.text}</h3>
              <ul>
                {currentQuestion.options.map((opt: string, i: number) => (
                  <li
                    key={i}
                    className="border p-2 rounded mb-1 text-left bg-purple-100"
                  >
                    {opt}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <button
              onClick={nextQuestion}
              className="bg-green-600 text-white rounded-full px-6 py-2 hover:bg-green-700 mt-6"
            >
              Next Question →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
