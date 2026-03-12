import { describe, expect, it } from 'vitest';
import { isDoubleTap, shouldSuppressMapClick, slideToZoom } from '../map-click';

describe('shouldSuppressMapClick', () => {
  it('returns false when no zoom has occurred (lastZoomTime=0)', () => {
    expect(shouldSuppressMapClick(0, 1000)).toBe(false);
  });

  it('returns true when click is within default suppression window (600ms)', () => {
    const zoomTime = 1000;
    const clickTime = 1500; // 500ms after zoom
    expect(shouldSuppressMapClick(zoomTime, clickTime)).toBe(true);
  });

  it('returns false when click is after default suppression window (600ms)', () => {
    const zoomTime = 1000;
    const clickTime = 1600; // exactly 600ms after zoom
    expect(shouldSuppressMapClick(zoomTime, clickTime)).toBe(false);
  });

  it('returns false when click is well after zoomend', () => {
    const zoomTime = 1000;
    const clickTime = 2000; // 1000ms after zoom
    expect(shouldSuppressMapClick(zoomTime, clickTime)).toBe(false);
  });

  it('respects custom suppressionMs', () => {
    const zoomTime = 1000;
    expect(shouldSuppressMapClick(zoomTime, 1400, 500)).toBe(true);
    expect(shouldSuppressMapClick(zoomTime, 1500, 500)).toBe(false);
  });
});

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
    // 100px up = +1 zoom level
    expect(slideToZoom(10, 100, 1, 18)).toBe(11);
  });

  it('zooms out when sliding down (negative deltaY)', () => {
    // 200px down = -2 zoom levels
    expect(slideToZoom(10, -200, 1, 18)).toBe(8);
  });

  it('clamps to maxZoom', () => {
    expect(slideToZoom(17, 500, 1, 18)).toBe(18);
  });

  it('clamps to minZoom', () => {
    expect(slideToZoom(3, -500, 1, 18)).toBe(1);
  });

  it('returns fractional zoom for partial slides', () => {
    // 50px = +0.5 zoom level
    expect(slideToZoom(10, 50, 1, 18)).toBe(10.5);
  });

  it('inverts direction when invert=true (up = zoom out)', () => {
    // 100px up without invert = zoom in (+1)
    expect(slideToZoom(10, 100, 1, 18, false)).toBe(11);
    // 100px up with invert = zoom out (-1)
    expect(slideToZoom(10, 100, 1, 18, true)).toBe(9);
  });

  it('inverts direction for negative deltaY when invert=true', () => {
    // 200px down without invert = zoom out (-2)
    expect(slideToZoom(10, -200, 1, 18, false)).toBe(8);
    // 200px down with invert = zoom in (+2)
    expect(slideToZoom(10, -200, 1, 18, true)).toBe(12);
  });

  it('clamps inverted zoom to bounds', () => {
    expect(slideToZoom(17, -500, 1, 18, true)).toBe(18);
    expect(slideToZoom(3, 500, 1, 18, true)).toBe(1);
  });
});
