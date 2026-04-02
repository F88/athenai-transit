import { describe, expect, it } from 'vitest';
import { CLICK_SUPPRESSION_MS, shouldSuppressMapClick } from '../map-click-suppression';

describe('shouldSuppressMapClick', () => {
  it('returns false when no zoom has occurred (lastZoomTime=0)', () => {
    expect(shouldSuppressMapClick(0, 1000)).toBe(false);
  });

  it('returns true when click is within default suppression window', () => {
    const zoomTime = 1000;
    const clickTime = 1500;
    expect(shouldSuppressMapClick(zoomTime, clickTime)).toBe(true);
  });

  it('returns false when click is after the default suppression window', () => {
    const zoomTime = 1000;
    const clickTime = 1000 + CLICK_SUPPRESSION_MS;
    expect(shouldSuppressMapClick(zoomTime, clickTime)).toBe(false);
  });

  it('returns false when click is well after zoomend', () => {
    const zoomTime = 1000;
    const clickTime = 2000;
    expect(shouldSuppressMapClick(zoomTime, clickTime)).toBe(false);
  });

  it('respects custom suppressionMs', () => {
    const zoomTime = 1000;
    expect(shouldSuppressMapClick(zoomTime, 1400, 500)).toBe(true);
    expect(shouldSuppressMapClick(zoomTime, 1500, 500)).toBe(false);
  });
});
