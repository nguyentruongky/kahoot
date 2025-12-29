import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswer: { type: Number, required: true }, // 0-based index into `options`
});

const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  questions: { type: [QuestionSchema], required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
});

if (mongoose.models.Quiz) {
  delete mongoose.models.Quiz;
}

export default mongoose.model("Quiz", QuizSchema);
