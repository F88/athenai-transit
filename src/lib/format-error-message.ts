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

/**
 * Format an unknown thrown value into a diagnostic string for display.
 *
 * For `Error` instances this preserves the short message and appends the stack
 * trace when available, so production error screens show both the original
 * error summary and the call site. Non-Error values fall back to
 * {@link formatErrorMessage}.
 */
export function formatErrorDetails(error: unknown): string {
  if (!(error instanceof Error)) {
    return formatErrorMessage(error);
  }

  const message = formatErrorMessage(error);
  const stack = error.stack?.trim();
  if (stack !== undefined && stack.length > 0) {
    const stackLines = stack.split('\n');
    const firstLine = stackLines[0]?.trim();
    const defaultHeader = error.message.length > 0 ? `${error.name}: ${error.message}` : error.name;
    const hasDuplicateHeader = firstLine === message || firstLine === defaultHeader;
    const remainingStack = hasDuplicateHeader ? stackLines.slice(1).join('\n').trim() : stack;

    return remainingStack.length > 0 ? `${message}\n\n${remainingStack}` : message;
  }

  return message;
}
