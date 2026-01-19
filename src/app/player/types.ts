export type Question = {
  text: string;
  options: string[];
  correctAnswers?: number[];
  correctAnswer?: number | string;
  durationSec?: number;
  media?: { kind: "image" | "video"; src: string; mime?: string };
};

export type ResultPopupState = {
  open: boolean;
  title: string;
  points: number;
  variant: "success" | "danger" | "neutral";
  streak: number;
};

export type FinalPopupState = {
  open: boolean;
  score: number;
  rank?: number;
  totalPlayers?: number;
  leaderboardWindow?: Array<{ name: string; score: number; rank?: number }>;
};
