const mongoose = require('mongoose');

// MongoDB connection URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kahoot-clone';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Define schemas
const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswer: { type: Number, required: true },
});

const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  questions: { type: [QuestionSchema], required: true },
});

const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', QuizSchema);

// Sample quiz data with 20 questions
const sampleQuiz = {
  title: "General Knowledge Quiz",
  questions: [
    {
      text: "What is the capital of France?",
      options: ["London", "Berlin", "Paris", "Madrid"],
      correctAnswer: 2
    },
    {
      text: "Which planet is known as the Red Planet?",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      correctAnswer: 1
    },
    {
      text: "What is 2 + 2?",
      options: ["3", "4", "5", "6"],
      correctAnswer: 1
    },
    {
      text: "Who painted the Mona Lisa?",
      options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Michelangelo"],
      correctAnswer: 2
    },
    {
      text: "What is the largest ocean on Earth?",
      options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
      correctAnswer: 3
    },
    {
      text: "In which year did World War II end?",
      options: ["1943", "1944", "1945", "1946"],
      correctAnswer: 2
    },
    {
      text: "What is the smallest prime number?",
      options: ["0", "1", "2", "3"],
      correctAnswer: 2
    },
    {
      text: "Which element has the chemical symbol 'O'?",
      options: ["Gold", "Oxygen", "Silver", "Carbon"],
      correctAnswer: 1
    },
    {
      text: "How many continents are there?",
      options: ["5", "6", "7", "8"],
      correctAnswer: 2
    },
    {
      text: "What is the fastest land animal?",
      options: ["Lion", "Cheetah", "Leopard", "Tiger"],
      correctAnswer: 1
    },
    {
      text: "What is the tallest mountain in the world?",
      options: ["K2", "Kilimanjaro", "Mount Everest", "Denali"],
      correctAnswer: 2
    },
    {
      text: "Who wrote 'Romeo and Juliet'?",
      options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
      correctAnswer: 1
    },
    {
      text: "What is the square root of 144?",
      options: ["10", "11", "12", "13"],
      correctAnswer: 2
    },
    {
      text: "Which country is home to the kangaroo?",
      options: ["New Zealand", "Australia", "South Africa", "Brazil"],
      correctAnswer: 1
    },
    {
      text: "What is the boiling point of water in Celsius?",
      options: ["90°C", "95°C", "100°C", "105°C"],
      correctAnswer: 2
    },
    {
      text: "Who invented the telephone?",
      options: ["Thomas Edison", "Alexander Graham Bell", "Nikola Tesla", "Benjamin Franklin"],
      correctAnswer: 1
    },
    {
      text: "What is the currency of Japan?",
      options: ["Yuan", "Yen", "Won", "Rupee"],
      correctAnswer: 1
    },
    {
      text: "How many sides does a hexagon have?",
      options: ["4", "5", "6", "7"],
      correctAnswer: 2
    },
    {
      text: "What is the largest mammal in the world?",
      options: ["African Elephant", "Blue Whale", "Giraffe", "Polar Bear"],
      correctAnswer: 1
    },
    {
      text: "In which continent is Egypt located?",
      options: ["Asia", "Africa", "Europe", "South America"],
      correctAnswer: 1
    }
  ]
};

// Seed function
async function seedDatabase() {
  try {
    // Clear existing quizzes
    await Quiz.deleteMany({});
    console.log('🗑️  Cleared existing quizzes');

    // Insert sample quiz
    const quiz = await Quiz.create(sampleQuiz);
    console.log('✅ Created quiz:', quiz.title);
    console.log('📝 Number of questions:', quiz.questions.length);
    console.log('🆔 Quiz ID:', quiz._id);

    console.log('\n✨ Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seed function
seedDatabase();
