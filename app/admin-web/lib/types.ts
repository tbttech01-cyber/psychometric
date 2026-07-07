export const QUESTION_TYPES = [
  "LIKERT_SCALE", "SITUATIONAL", "NUMERICAL_ABILITY", "PERCENTAGE_TYPE",
  "PUZZLE_TYPE", "LOGICAL_ABILITY", "VERBAL_ABILITY", "IMAGE_BASED",
  "MULTI_SELECT", "RANKING",
] as const;
export type QuestionTypeKind = typeof QUESTION_TYPES[number];

// Only these render with a real editor today; the rest are shown in the
// selector (so the admin can see the full target list) but disabled.
export const PHASE1_ENABLED_TYPES: QuestionTypeKind[] = ["LIKERT_SCALE", "NUMERICAL_ABILITY"];

export const QUESTION_TYPE_LABELS: Record<QuestionTypeKind, string> = {
  LIKERT_SCALE: "Likert Scale",
  SITUATIONAL: "Situational",
  NUMERICAL_ABILITY: "Numerical Ability",
  PERCENTAGE_TYPE: "Percentage",
  PUZZLE_TYPE: "Puzzle",
  LOGICAL_ABILITY: "Logical Ability",
  VERBAL_ABILITY: "Verbal Ability",
  IMAGE_BASED: "Image Based",
  MULTI_SELECT: "Multi-Select",
  RANKING: "Ranking",
};

export const DIMENSIONS = [
  "Communication", "Leadership", "Problem Solving", "Risk Taking", "Teamwork",
  "Creativity", "Financial Awareness", "Business Mindset", "Emotional Intelligence",
  "Numerical Ability", "Logical Ability", "Verbal Ability",
] as const;
export type Dimension = typeof DIMENSIONS[number];

export type Difficulty = "easy" | "medium" | "hard";

export type QCategory = { _id: string; name: string; color: string };

export type AnswerOption = {
  _id?: string;
  optionText: string;
  optionImageUrl?: string;
  score: number;
  isCorrect?: boolean;
  dimensionScores?: Record<string, number>;
  order: number;
};

export type Question = {
  _id: string;
  text: string;
  order: number;
  isActive: boolean;
  typeId: QCategory | string;
  questionType: QuestionTypeKind;
  dimension: Dimension;
  subDimension?: string;
  difficulty: Difficulty;
  marks: number;
  timeLimitSeconds?: number | null;
  hasAudio?: boolean;
  audioUrl?: string;
  imageUrl?: string;
  instructionText?: string;
  isReverseScored?: boolean;
  correctOptionId?: string | null;
  explanation?: string;
  options: AnswerOption[];
};

export type DashboardCards = {
  totalUsersRegistered: number;
  totalAssessmentsCompleted: number;
  totalAssessmentsInProgress: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  activeSharedCodes: number;
};

export type RecentResult = {
  _id: string;
  totalMarks: number;
  maxScore: number;
  level: string;
  createdAt: string;
  userId?: { name: string; email: string; sharedCode: string };
};

export type DashboardData = {
  cards: DashboardCards;
  barChart: { labels: string[]; data: number[] };
  pieChart: { labels: string[]; data: number[] };
  recentResults: RecentResult[];
};
