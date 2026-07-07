const LEVEL_KEYS: Record<string, string> = {
  "Excellent": "excellent",
  "Good": "good",
  "Average": "average",
  "Needs Improvement": "needs",
};

export function levelBadgeClass(level: string): string {
  return `badge badge-${LEVEL_KEYS[level] || "average"}`;
}
