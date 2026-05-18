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
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const formatUnit = (value: number, unit: 'KB' | 'MB' | 'GB'): string => {
    return `${value.toFixed(fractionDigits)} ${unit}`;
  };

  if (bytes < 1024 * 1024) {
    return formatUnit(bytes / 1024, 'KB');
  }
  if (bytes < 1024 * 1024 * 1024) {
    return formatUnit(bytes / (1024 * 1024), 'MB');
  }
  return formatUnit(bytes / (1024 * 1024 * 1024), 'GB');
}
