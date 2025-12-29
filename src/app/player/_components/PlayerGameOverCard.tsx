"use client";

type PlayerGameOverCardProps = {
  score: number;
  onJoinAnother: () => void;
};

export function PlayerGameOverCard({
  score,
  onJoinAnother,
}: PlayerGameOverCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
      <h2 className="text-4xl font-bold text-purple-700 mb-4">Game Over!</h2>
      <div className="text-6xl mb-4">🎉</div>
      <p className="text-2xl text-gray-700 mb-2">Final Score</p>
      <p className="text-5xl font-bold text-green-600 mb-6">{score}</p>
      <button
        onClick={onJoinAnother}
        className="bg-purple-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-purple-700 transition"
      >
        Join Another Game
      </button>
    </div>
  );
}
