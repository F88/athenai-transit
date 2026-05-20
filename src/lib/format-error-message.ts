/**
 * Format an unknown thrown value into a human-readable string for display.
 *
 * A React error boundary (and any `catch` block) receives whatever was
 * thrown, which is not guaranteed to be an `Error` — `throw "text"`,
 * `throw null`, and `throw { code: 1 }` are all valid. This normalizes any
 * such value into a displayable string.
 *
 * @param error - The value caught by an error boundary or `catch` block.
 * @returns For an `Error`, its `message` (falling back to `name` when the
 *   message is an empty string, so the result is never blank). For any
 *   other value, a best-effort string conversion.
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.length > 0 ? error.message : error.name;
  }
  try {
    return String(error);
  } catch {
    return 'Unknown error';
  }
}
