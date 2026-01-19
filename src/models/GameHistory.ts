import mongoose from "mongoose";

const AnswerSchema = new mongoose.Schema(
  {
    name: String,
    answer: mongoose.Schema.Types.Mixed,
    correct: Boolean,
    points: Number,
    timeLeftSec: Number,
  },
  { _id: false },
);

const QuestionHistorySchema = new mongoose.Schema(
  {
    questionId: Number,
    text: String,
    options: [String],
    correctAnswers: [Number],
    startedAt: Date,
    durationSec: Number,
    results: [AnswerSchema],
  },
  { _id: false },
);

const PlayerSnapshotSchema = new mongoose.Schema(
  {
    name: String,
    score: Number,
    rank: Number,
  },
  { _id: false },
);

const GameHistorySchema = new mongoose.Schema(
  {
    pin: { type: String, required: true, index: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz" },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    startedAt: { type: Date },
    endedAt: { type: Date },
    totalPlayers: { type: Number, default: 0 },
    players: [PlayerSnapshotSchema],
    questions: [QuestionHistorySchema],
    leaderboard: [PlayerSnapshotSchema],
    leaderboardAll: [PlayerSnapshotSchema],
  },
  { timestamps: true },
);

if (mongoose.models.GameHistory) {
  delete mongoose.models.GameHistory;
}

export default mongoose.model("GameHistory", GameHistorySchema);
