const LEVEL_KEYS: Record<string, string> = {
  "Excellent": "excellent",
  "Good": "good",
  "Average": "average",
  "Needs Improvement": "needs",
};

export function levelBadgeClass(level: string): string {
  return `badge badge-${LEVEL_KEYS[level] || "average"}`;
}

const QUESTION_TYPE_COLORS: Record<string, string> = {
  LIKERT_SCALE: "#2563EB",
  NUMERICAL_ABILITY: "#F59E0B",
};

export function questionTypeBadgeStyle(type: string): { background: string } {
  return { background: QUESTION_TYPE_COLORS[type] || "#94A3B8" };
}

const DIFFICULTY_KEYS: Record<string, string> = { easy: "good", medium: "average", hard: "needs" };

export function difficultyBadgeClass(difficulty: string): string {
  return `badge badge-${DIFFICULTY_KEYS[difficulty] || "average"}`;
}
