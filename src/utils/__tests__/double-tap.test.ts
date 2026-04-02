import { describe, expect, it } from 'vitest';
import { isDoubleTap, slideToZoom } from '../double-tap';

describe('isDoubleTap', () => {
  it('returns true when elapsed and drift are within thresholds', () => {
    expect(isDoubleTap(200, 10)).toBe(true);
  });

  it('returns false when elapsed exceeds threshold', () => {
    expect(isDoubleTap(300, 10)).toBe(false);
    expect(isDoubleTap(500, 10)).toBe(false);
  });

  it('returns false when drift exceeds threshold', () => {
    expect(isDoubleTap(200, 30)).toBe(false);
    expect(isDoubleTap(200, 50)).toBe(false);
  });

  it('returns false when both exceed thresholds', () => {
    expect(isDoubleTap(400, 50)).toBe(false);
  });
});

describe('slideToZoom', () => {
  it('zooms in when sliding up (positive deltaY)', () => {
    expect(slideToZoom(10, 100, 1, 18)).toBe(11);
  });

  it('zooms out when sliding down (negative deltaY)', () => {
    expect(slideToZoom(10, -200, 1, 18)).toBe(8);
  });

  it('clamps to maxZoom', () => {
    expect(slideToZoom(17, 500, 1, 18)).toBe(18);
  });

  it('clamps to minZoom', () => {
    expect(slideToZoom(3, -500, 1, 18)).toBe(1);
  });

  it('returns fractional zoom for partial slides', () => {
    expect(slideToZoom(10, 50, 1, 18)).toBe(10.5);
  });

  it('inverts direction when invert=true (up = zoom out)', () => {
    expect(slideToZoom(10, 100, 1, 18, false)).toBe(11);
    expect(slideToZoom(10, 100, 1, 18, true)).toBe(9);
  });

  it('inverts direction for negative deltaY when invert=true', () => {
    expect(slideToZoom(10, -200, 1, 18, false)).toBe(8);
    expect(slideToZoom(10, -200, 1, 18, true)).toBe(12);
  });

  it('clamps inverted zoom to bounds', () => {
    expect(slideToZoom(17, -500, 1, 18, true)).toBe(18);
    expect(slideToZoom(3, 500, 1, 18, true)).toBe(1);
  });
});
