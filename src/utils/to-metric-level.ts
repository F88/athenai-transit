export interface MetricLevelOptions {
  direction?: 'ascending' | 'descending';
}

export function toMetricLevel(
  value: number,
  thresholds: ReadonlyArray<number>,
  options?: MetricLevelOptions,
): number {
  let level = 0;
  for (const threshold of thresholds) {
    if (value >= threshold) {
      level++;
      continue;
    }
    break;
  }
  const clampedLevel = Math.min(level, thresholds.length);
  if (options?.direction === 'descending') {
    return thresholds.length - clampedLevel;
  }
  return clampedLevel;
}
