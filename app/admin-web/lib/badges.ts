export function levelBadgeClass(level: string): string {
  const key = level.toLowerCase().replace(" ", "").replace("improvement", "needs");
  return `badge badge-${key}`;
}
