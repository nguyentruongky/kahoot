import mongoose from "mongoose";

const PlayerSchema = new mongoose.Schema({
  name: String,
  score: { type: Number, default: 0 },
});

const GameSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz" },
  pin: { type: String, required: true },
  players: [PlayerSchema],
  status: { type: String, default: "waiting" }, // waiting | active | finished
  backgroundImage: { type: String, required: false },
});

export default mongoose.models.Game || mongoose.model("Game", GameSchema);
