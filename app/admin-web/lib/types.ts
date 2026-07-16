export const QUESTION_TYPES = [
  "LIKERT_SCALE", "SITUATIONAL", "NUMERICAL_ABILITY", "PERCENTAGE_TYPE",
  "PUZZLE_TYPE", "LOGICAL_ABILITY", "VERBAL_ABILITY", "IMAGE_BASED",
  "MULTI_SELECT", "RANKING",
] as const;
export type QuestionTypeKind = typeof QUESTION_TYPES[number];

// Every question type now has a real editor (Phase 1 + Phase 2 complete).
export const ENABLED_TYPES: QuestionTypeKind[] = [...QUESTION_TYPES];

// The 5 remaining single-correct-answer types share NUMERICAL_ABILITY's
// exact editor/evaluation behavior — grouped here so the form only needs
// one branch for all of them.
export const SINGLE_CORRECT_TYPES: QuestionTypeKind[] = [
  "NUMERICAL_ABILITY", "PERCENTAGE_TYPE", "PUZZLE_TYPE", "LOGICAL_ABILITY", "VERBAL_ABILITY", "IMAGE_BASED",
];

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
  explanationAudioText?: string;
  isReverseScored?: boolean;
  correctOptionId?: string | null;
  correctOptionIds?: string[];
  idealOrder?: string[];
  scoringMode?: "exact" | "partial";
  explanation?: string;
  options: AnswerOption[];
};

// A named group of questions with its own timer, assigned to access codes.
// `questionIds` is ordered (array position = per-set question order). The list
// endpoint returns bare id strings plus the two computed counts; the detail
// endpoint (getSet) populates `questionIds` with Question docs for the editor.
export type QuestionSet = {
  _id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  questionIds: (Question | string)[];
  isActive: boolean;
  createdAt: string;
  questionCount?: number;
  assignedCodeCount?: number;
};

// Mirrors the Phase-2 fields on backend models/Result.js — optional since
// older Result documents predate these and never got them backfilled.
export type Result = {
  _id: string;
  userId?: { name: string; email: string; sharedCode: string };
  totalMarks: number;
  maxScore: number;
  percentage: number;
  level: "Excellent" | "Good" | "Average" | "Needs Improvement";
  categoryScores: Record<string, number>;
  categoryPercentages: Record<string, number>;
  highestCategory: string[];
  recommendedBusiness: string[];
  explanation: string;
  improvementAreas: { category: string; score: number; suggestion: string }[];
  createdAt: string;
  dimensionScores?: Record<string, number>;
  dimensionPercentages?: Record<string, number>;
  correctCount?: number;
  wrongCount?: number;
  skippedCount?: number;
  businessReadinessPercent?: number;
  recommendations?: { business: string; explanation: string }[];
  strongDimensions?: string[];
  weakDimensions?: string[];
  aptitudeScore?: number;
  personalityScore?: number;
  businessMindsetScore?: number;
  financialAwarenessScore?: number;
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
