export function crossedReminder(previous: number | undefined, remaining: number): number | null {
  if (previous === undefined || !Number.isFinite(previous) || !Number.isFinite(remaining)) return null;
  for (const threshold of [0, 5, 10]) if (previous > threshold && remaining <= threshold) return threshold;
  return null;
}
