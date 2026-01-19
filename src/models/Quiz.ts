import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswer: { type: Number, required: false }, // 0-based index into `options` (legacy)
  correctAnswers: { type: [Number], required: true },
  durationSec: { type: Number, required: true, default: 20 },
  media: {
    kind: { type: String, enum: ["image", "video"], required: false },
    src: { type: String, required: false },
    mime: { type: String, required: false },
  },
});

const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  questions: { type: [QuestionSchema], required: true },
  backgroundImage: { type: String, required: false },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
});

if (mongoose.models.Quiz) {
  delete mongoose.models.Quiz;
}

export default mongoose.model("Quiz", QuizSchema);
