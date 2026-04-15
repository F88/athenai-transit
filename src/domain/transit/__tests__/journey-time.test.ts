import { describe, expect, it } from 'vitest';

import { computeJourneyTime } from '../journey-time';

describe('computeJourneyTime', () => {
  describe('failure reasons', () => {
    it('returns no-total when totalMinutes is undefined', () => {
      const r = computeJourneyTime({ remainingMinutes: 15, totalMinutes: undefined });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toBe('no-total');
    });

    it('returns invalid-total when totalMinutes is NaN', () => {
      const r = computeJourneyTime({ remainingMinutes: 15, totalMinutes: Number.NaN });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toBe('invalid-total');
    });

    it('returns invalid-total when totalMinutes is Infinity', () => {
      const r = computeJourneyTime({
        remainingMinutes: 15,
        totalMinutes: Number.POSITIVE_INFINITY,
      });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toBe('invalid-total');
    });

    it('returns invalid-total when totalMinutes is zero', () => {
      const r = computeJourneyTime({ remainingMinutes: 0, totalMinutes: 0 });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toBe('invalid-total');
    });

    it('returns invalid-total when totalMinutes is negative', () => {
      const r = computeJourneyTime({ remainingMinutes: 5, totalMinutes: -10 });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toBe('invalid-total');
    });
  });

  describe('sub-minute totals (clamp to 1-minute display floor)', () => {
    // Real pipeline data is not expected to produce sub-minute
    // totals, but positive-but-below-round-to-1 values must still
    // render as "1" rather than degenerating to "0 / 0".
    it('clamps totalMinutes=0.2 to display 1', () => {
      const r = computeJourneyTime({ remainingMinutes: 0.2, totalMinutes: 0.2 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.safeTotalMinutes).toBe(0.2);
      expect(r.value.displayTotalMinutes).toBe(1);
      expect(r.value.displayRemainingMinutes).toBe(1);
    });

    it('clamps totalMinutes=0.1 with remaining=0 to display "0 / 1"', () => {
      const r = computeJourneyTime({ remainingMinutes: 0, totalMinutes: 0.1 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.displayTotalMinutes).toBe(1);
      expect(r.value.displayRemainingMinutes).toBe(0);
      expect(r.value.progressValue).toBe(0);
    });

    it('clamps the boundary 0.49 to display 1', () => {
      const r = computeJourneyTime({ remainingMinutes: 0, totalMinutes: 0.49 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.displayTotalMinutes).toBe(1);
    });

    it('handles the exact boundary 0.5 (natural round to 1)', () => {
      const r = computeJourneyTime({ remainingMinutes: 0.5, totalMinutes: 0.5 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.displayTotalMinutes).toBe(1);
      expect(r.value.displayRemainingMinutes).toBe(1);
    });
  });

  describe('soft remaining handling', () => {
    it('succeeds with undefined remaining, marking fill as zero', () => {
      const r = computeJourneyTime({ remainingMinutes: undefined, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.safeRemainingMinutes).toBeUndefined();
      expect(r.value.progressValue).toBe(0);
      expect(r.value.displayRemainingMinutes).toBeNull();
      expect(r.value.displayTotalMinutes).toBe(30);
    });

    it('treats negative remaining as missing', () => {
      const r = computeJourneyTime({ remainingMinutes: -5, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.safeRemainingMinutes).toBeUndefined();
      expect(r.value.progressValue).toBe(0);
    });

    it('treats sub-epsilon negative remaining as missing', () => {
      // Boundary: a value just below zero (e.g. floating-point noise)
      // must still be rejected by the `>= 0` check, not silently
      // accepted as "essentially zero".
      const r = computeJourneyTime({ remainingMinutes: -Number.EPSILON, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.safeRemainingMinutes).toBeUndefined();
      expect(r.value.progressValue).toBe(0);
      expect(r.value.displayRemainingMinutes).toBeNull();
    });

    it('accepts exactly zero remaining as a valid (fully-arrived) value', () => {
      // Counterpart to the sub-epsilon test: zero is valid and means
      // "trip is over". safeRemaining must be 0, progress 0%, and
      // the display label must read "0".
      const r = computeJourneyTime({ remainingMinutes: 0, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.safeRemainingMinutes).toBe(0);
      expect(r.value.progressValue).toBe(0);
      expect(r.value.displayRemainingMinutes).toBe(0);
    });

    it('treats NaN remaining as missing', () => {
      const r = computeJourneyTime({ remainingMinutes: Number.NaN, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.safeRemainingMinutes).toBeUndefined();
    });

    it('treats Infinity remaining as missing', () => {
      const r = computeJourneyTime({
        remainingMinutes: Number.POSITIVE_INFINITY,
        totalMinutes: 30,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.safeRemainingMinutes).toBeUndefined();
      expect(r.value.progressValue).toBe(0);
    });
  });

  describe('null inputs (defensive)', () => {
    it('treats null totalMinutes as no-total', () => {
      const r = computeJourneyTime({
        remainingMinutes: 15,
        // @ts-expect-error `null` is not in the declared type but can
        // sneak in at runtime via property access on optional fields.
        totalMinutes: null,
      });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.reason).toBe('no-total');
    });

    it('treats null remainingMinutes as missing', () => {
      const r = computeJourneyTime({
        // @ts-expect-error runtime null guard
        remainingMinutes: null,
        totalMinutes: 30,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.safeRemainingMinutes).toBeUndefined();
    });
  });

  describe('relationship clamp (remaining > total)', () => {
    it('clamps remaining to total when it exceeds', () => {
      const r = computeJourneyTime({ remainingMinutes: 40, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.safeRemainingMinutes).toBe(30);
      expect(r.value.progressValue).toBe(100);
    });

    it('preserves remaining when below total', () => {
      const r = computeJourneyTime({ remainingMinutes: 20, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.safeRemainingMinutes).toBe(20);
    });
  });

  describe('progressValue', () => {
    it('returns 0 at terminal (remaining=0)', () => {
      const r = computeJourneyTime({ remainingMinutes: 0, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(0);
    });

    it('returns 100 at origin (remaining=total)', () => {
      const r = computeJourneyTime({ remainingMinutes: 30, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(100);
    });

    it('returns 50 at midpoint', () => {
      const r = computeJourneyTime({ remainingMinutes: 15, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(50);
    });

    it('handles fractional total/remaining', () => {
      const r = computeJourneyTime({ remainingMinutes: 49.25, totalMinutes: 98.5 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(50);
    });
  });

  describe('display rounding (integer labels)', () => {
    it('rounds integer inputs unchanged', () => {
      const r = computeJourneyTime({ remainingMinutes: 15, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.displayTotalMinutes).toBe(30);
      expect(r.value.displayRemainingMinutes).toBe(15);
    });

    it('rounds fractional total to nearest integer', () => {
      const r = computeJourneyTime({ remainingMinutes: 0, totalMinutes: 98.5 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.displayTotalMinutes).toBe(99);
      expect(r.value.displayRemainingMinutes).toBe(0);
    });

    it('derives remaining from rounded total ratio (midpoint)', () => {
      const r = computeJourneyTime({ remainingMinutes: 49.25, totalMinutes: 98.5 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      // ratio = 0.5, rounded total = 99, derived remaining = 50
      expect(r.value.displayTotalMinutes).toBe(99);
      expect(r.value.displayRemainingMinutes).toBe(50);
    });
  });

  describe('label consistency at 100% (display pair must never drift)', () => {
    it('integer total', () => {
      const r = computeJourneyTime({ remainingMinutes: 30, totalMinutes: 30 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(100);
      expect(r.value.displayRemainingMinutes).toBe(r.value.displayTotalMinutes);
      expect(r.value.displayTotalMinutes).toBe(30);
    });

    it('fractional total rounding up (98.5 -> 99)', () => {
      const r = computeJourneyTime({ remainingMinutes: 98.5, totalMinutes: 98.5 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(100);
      expect(r.value.displayRemainingMinutes).toBe(r.value.displayTotalMinutes);
      expect(r.value.displayTotalMinutes).toBe(99);
    });

    it('fractional total rounding down (113.4 -> 113)', () => {
      const r = computeJourneyTime({ remainingMinutes: 113.4, totalMinutes: 113.4 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(100);
      expect(r.value.displayRemainingMinutes).toBe(r.value.displayTotalMinutes);
      expect(r.value.displayTotalMinutes).toBe(113);
    });

    it('very small total (2.5 -> 3)', () => {
      const r = computeJourneyTime({ remainingMinutes: 2.5, totalMinutes: 2.5 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(100);
      expect(r.value.displayRemainingMinutes).toBe(r.value.displayTotalMinutes);
      expect(r.value.displayTotalMinutes).toBe(3);
    });

    it('clamped from overflow input (remaining > total)', () => {
      const r = computeJourneyTime({ remainingMinutes: 200, totalMinutes: 98.5 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(100);
      expect(r.value.safeRemainingMinutes).toBe(98.5);
      expect(r.value.displayRemainingMinutes).toBe(r.value.displayTotalMinutes);
      expect(r.value.displayTotalMinutes).toBe(99);
    });

    it('property check across a range of fractional totals', () => {
      const totals = [
        1, 1.1, 1.5, 1.9, 10.25, 30, 45.5, 60.4, 60.5, 98.5, 99.49, 99.5, 113.4, 120, 140.7,
      ];
      for (const total of totals) {
        const r = computeJourneyTime({ remainingMinutes: total, totalMinutes: total });
        expect(r.ok, `ok for total=${total}`).toBe(true);
        if (!r.ok) {
          continue;
        }
        expect(r.value.progressValue, `progressValue for total=${total}`).toBe(100);
        expect(r.value.displayRemainingMinutes, `display pair for total=${total}`).toBe(
          r.value.displayTotalMinutes,
        );
      }
    });
  });

  describe('label consistency at 0% (display remaining must be 0)', () => {
    it('always displays 0 at terminal for any fractional total', () => {
      const totals = [1, 1.5, 10.25, 98.5, 113.4, 120, 140.7];
      for (const total of totals) {
        const r = computeJourneyTime({ remainingMinutes: 0, totalMinutes: total });
        expect(r.ok, `ok for total=${total}`).toBe(true);
        if (!r.ok) {
          continue;
        }
        expect(r.value.progressValue, `progressValue for total=${total}`).toBe(0);
        expect(r.value.displayRemainingMinutes, `display remaining for total=${total}`).toBe(0);
      }
    });
  });

  describe('invariants', () => {
    it('displayRemainingMinutes never exceeds displayTotalMinutes', () => {
      const samples: { r: number; t: number }[] = [
        { r: 0, t: 30 },
        { r: 0.5, t: 0.5 }, // smallest valid total (rounds to 1)
        { r: 0.3, t: 0.5 },
        { r: 29.9, t: 30 },
        { r: 30, t: 30 },
        { r: 98.4, t: 98.5 },
        { r: 98.5, t: 98.5 },
        { r: 500, t: 98.5 }, // overflow-clamped to 98.5
        { r: 1.4, t: 1.5 },
        { r: 113.3, t: 113.4 },
      ];
      for (const { r, t } of samples) {
        const result = computeJourneyTime({ remainingMinutes: r, totalMinutes: t });
        expect(result.ok, `ok for r=${r} t=${t}`).toBe(true);
        if (!result.ok) {
          continue;
        }
        const disp = result.value.displayRemainingMinutes;
        if (disp === null) {
          continue;
        }
        expect(disp, `displayRemaining<=displayTotal for r=${r} t=${t}`).toBeLessThanOrEqual(
          result.value.displayTotalMinutes,
        );
      }
    });

    it('displayTotalMinutes is always >= 1 in a successful result', () => {
      // Any total that the function accepts must render as at least
      // `1` minute — otherwise the label degenerates to `0 / 0`.
      const samples: number[] = [
        0.5, // exact boundary
        0.51,
        0.9,
        1,
        1.4,
        1.5,
        2.5,
        30,
        98.5,
        120,
        140,
        730,
      ];
      for (const total of samples) {
        const r = computeJourneyTime({ remainingMinutes: 0, totalMinutes: total });
        expect(r.ok, `ok for total=${total}`).toBe(true);
        if (!r.ok) {
          continue;
        }
        expect(
          r.value.displayTotalMinutes,
          `displayTotalMinutes>=1 for total=${total}`,
        ).toBeGreaterThanOrEqual(1);
      }
    });

    it('clamps all sub-minute totals in (0, 0.5) to display 1', () => {
      // Anything strictly positive but below 0.5 must still round to
      // at least 1 for display, so the label never degenerates.
      const samples: number[] = [0.01, 0.1, 0.2, 0.3, 0.4, 0.49, 0.4999];
      for (const total of samples) {
        const r = computeJourneyTime({ remainingMinutes: total, totalMinutes: total });
        expect(r.ok, `ok for total=${total}`).toBe(true);
        if (!r.ok) {
          continue;
        }
        expect(r.value.displayTotalMinutes, `displayTotalMinutes>=1 for total=${total}`).toBe(1);
        expect(r.value.displayRemainingMinutes, `display pair at 100% for total=${total}`).toBe(
          r.value.displayTotalMinutes,
        );
      }
    });

    it('progressValue stays in [0, 100] for any valid input', () => {
      const samples: { r: number; t: number }[] = [
        { r: 0, t: 30 },
        { r: 0.0001, t: 30 },
        { r: 15, t: 30 },
        { r: 29.9999, t: 30 },
        { r: 30, t: 30 },
        { r: 500, t: 30 }, // overflow-clamped
        { r: 0, t: 0.5 },
        { r: 0.25, t: 0.5 },
        { r: 0.5, t: 0.5 },
      ];
      for (const { r, t } of samples) {
        const result = computeJourneyTime({ remainingMinutes: r, totalMinutes: t });
        expect(result.ok, `ok for r=${r} t=${t}`).toBe(true);
        if (!result.ok) {
          continue;
        }
        expect(result.value.progressValue, `lo for r=${r} t=${t}`).toBeGreaterThanOrEqual(0);
        expect(result.value.progressValue, `hi for r=${r} t=${t}`).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('real-world samples from pipeline insights', () => {
    it('kobus p1: total=48, mid-trip remaining=24', () => {
      const r = computeJourneyTime({ remainingMinutes: 24, totalMinutes: 48 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(50);
      expect(r.value.displayTotalMinutes).toBe(48);
      expect(r.value.displayRemainingMinutes).toBe(24);
    });

    it('minkuru 梅70: fractional total=98.5, at origin', () => {
      const r = computeJourneyTime({ remainingMinutes: 98.5, totalMinutes: 98.5 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(100);
      expect(r.value.displayTotalMinutes).toBe(99);
      expect(r.value.displayRemainingMinutes).toBe(99);
    });

    it('minkuru 梅70: fractional total=98.5, at terminal', () => {
      const r = computeJourneyTime({ remainingMinutes: 0, totalMinutes: 98.5 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(0);
      expect(r.value.displayTotalMinutes).toBe(99);
      expect(r.value.displayRemainingMinutes).toBe(0);
    });

    it('kcbus max 140min: at midpoint', () => {
      const r = computeJourneyTime({ remainingMinutes: 70, totalMinutes: 140 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(50);
      expect(r.value.displayTotalMinutes).toBe(140);
      expect(r.value.displayRemainingMinutes).toBe(70);
    });

    it('iyt2 overnight bus 730min: at origin', () => {
      const r = computeJourneyTime({ remainingMinutes: 730, totalMinutes: 730 });
      expect(r.ok).toBe(true);
      if (!r.ok) {
        return;
      }
      expect(r.value.progressValue).toBe(100);
      expect(r.value.displayTotalMinutes).toBe(730);
      expect(r.value.displayRemainingMinutes).toBe(730);
    });
  });
});
