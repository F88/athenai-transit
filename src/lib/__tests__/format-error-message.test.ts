import { describe, expect, it } from 'vitest';
import { formatErrorMessage } from '../format-error-message';

describe('formatErrorMessage', () => {
  it('returns the message of a standard Error', () => {
    expect(formatErrorMessage(new Error('something broke'))).toBe('something broke');
  });

  it('returns the message of an Error subclass', () => {
    expect(formatErrorMessage(new TypeError('not a function'))).toBe('not a function');
  });

  it('falls back to the error name when the message is empty', () => {
    expect(formatErrorMessage(new TypeError(''))).toBe('TypeError');
  });

  it('returns a string value as-is', () => {
    expect(formatErrorMessage('plain string error')).toBe('plain string error');
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
