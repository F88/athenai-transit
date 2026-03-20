/**
 * Formatting utilities for human-readable output.
 */

/**
 * Format a byte count into a human-readable string.
 *
 * @param bytes - Number of bytes.
 * @returns Formatted string (e.g. "1.2 KB", "3.4 MB").
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
