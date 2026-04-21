import { describe, expect, it } from 'vitest';
import {
  MAX_STOP_QUERY_RESULT,
  normalizeOptionalResultLimit,
  normalizeResultLimit,
  normalizeStopQueryLimit,
} from '../transit-repository';

describe('transit-repository limit helpers', () => {
  describe('normalizeStopQueryLimit', () => {
    it('caps large stop-query limits at MAX_STOP_QUERY_RESULT', () => {
      expect(normalizeStopQueryLimit(MAX_STOP_QUERY_RESULT + 123)).toBe(MAX_STOP_QUERY_RESULT);
    });

    it('truncates fractional limits toward zero', () => {
      expect(normalizeStopQueryLimit(3.9)).toBe(3);
    });

    it('treats negative limits as zero', () => {
      expect(normalizeStopQueryLimit(-5)).toBe(0);
    });

    it('treats non-finite limits as zero', () => {
      expect(normalizeStopQueryLimit(Number.NaN)).toBe(0);
      expect(normalizeStopQueryLimit(Number.NEGATIVE_INFINITY)).toBe(0);
    });
  });

  describe('normalizeResultLimit', () => {
    it('does not cap large generic limits', () => {
      expect(normalizeResultLimit(MAX_STOP_QUERY_RESULT + 123)).toBe(MAX_STOP_QUERY_RESULT + 123);
    });

    it('normalizes invalid generic limits', () => {
      expect(normalizeResultLimit(4.8)).toBe(4);
      expect(normalizeResultLimit(-1)).toBe(0);
      expect(normalizeResultLimit(Number.NaN)).toBe(0);
    });
  });

  describe('normalizeOptionalResultLimit', () => {
    it('preserves omitted limits', () => {
      expect(normalizeOptionalResultLimit(undefined)).toBeUndefined();
    });

    it('normalizes provided limits', () => {
      expect(normalizeOptionalResultLimit(4.8)).toBe(4);
      expect(normalizeOptionalResultLimit(-1)).toBe(0);
    });
  });
});
