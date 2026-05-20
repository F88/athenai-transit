import { describe, expect, it } from 'vitest';
import { formatErrorDetails, formatErrorMessage } from '../format-error-message';

describe('formatErrorMessage', () => {
  it('returns the message of a standard Error', () => {
    expect(formatErrorMessage(new Error('something broke'))).toBe('something broke');
  });

  it('returns the message of an Error subclass', () => {
    expect(formatErrorMessage(new TypeError('not a function'))).toBe('not a function');
  });

  it('returns the stack trace of an Error when available for diagnostics', () => {
    const error = new TypeError('not a function');
    error.stack = 'TypeError: not a function\n    at App (src/app.tsx:123:45)';

    expect(formatErrorDetails(error)).toBe(error.stack);
  });

  it('falls back to the message when an Error stack is unavailable', () => {
    const error = new TypeError('not a function');
    error.stack = '';

    expect(formatErrorDetails(error)).toBe('not a function');
  });

  it('falls back to the error name when the message is empty', () => {
    expect(formatErrorMessage(new TypeError(''))).toBe('TypeError');
  });

  it('returns a string value as-is', () => {
    expect(formatErrorMessage('plain string error')).toBe('plain string error');
    expect(formatErrorDetails('plain string error')).toBe('plain string error');
  });

  it('handles null', () => {
    expect(formatErrorMessage(null)).toBe('null');
  });

  it('handles undefined', () => {
    expect(formatErrorMessage(undefined)).toBe('undefined');
  });

  it('handles a number', () => {
    expect(formatErrorMessage(42)).toBe('42');
  });

  it('handles a plain object', () => {
    expect(formatErrorMessage({ code: 1 })).toBe('[object Object]');
  });

  it('falls back when an object cannot be converted to a string', () => {
    expect(formatErrorMessage(Object.create(null))).toBe('Unknown error');
  });
});
