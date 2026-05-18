interface FormatBytesForDisplayOptions {
  /** Fraction digits to keep after rounding. @default 1 */
  fractionDigits?: number;
}

/**
 * Format a byte count as a short human-readable string (e.g. `"3.4 MB"`).
 *
 * Uses 1024-based units. Fraction digits are rounded using the platform
 * `toFixed()` behavior.
 */
export function formatBytesForDisplay(
  bytes: number,
  options: FormatBytesForDisplayOptions = {},
): string {
  const fractionDigits = Math.max(0, options.fractionDigits ?? 1);
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const roundToFractionDigits = (value: number): number => {
    return Number(value.toFixed(fractionDigits));
  };

  let unitIndex = 1;
  let value = bytes / 1024;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  let roundedValue = roundToFractionDigits(value);
  if (roundedValue >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
    roundedValue = roundToFractionDigits(value);
  }

  return `${roundedValue.toFixed(fractionDigits)} ${units[unitIndex]}`;
}
