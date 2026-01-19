export interface Player {
  name: string;
  score: number;
}

export type QuizQuestion = {
  text: string;
  options: string[];
  correctAnswers: number[];
  durationSec?: number;
  media?: { kind: "image" | "video"; src: string; mime?: string };
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
  correctAnswers?: number[];
  results?: Record<
    string,
    { answer: number; correct: boolean; points: number; timeLeftSec: number }
  >;
};
