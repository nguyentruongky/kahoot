export interface Player {
  name: string;
  score: number;
}

export type QuizQuestion = {
  text: string;
  options: string[];
  correctAnswer: number;
};

export type PlayerAnswerPayload = {
  name: string;
  answer: number;
  correct: boolean;
  points: number;
  timeLeftSec: number;
};

export type EndQuestionPayload = {
  questionId?: number;
  correctAnswer?: number;
  results?: Record<
    string,
    { answer: number; correct: boolean; points: number; timeLeftSec: number }
  >;
};
