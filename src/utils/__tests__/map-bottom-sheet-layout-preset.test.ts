import { describe, expect, it } from 'vitest';
import {
  isWideViewport,
  resolveMapBottomSheetLayoutPreset,
  resolveMultiPaneOrientation,
  WIDE_VIEWPORT_MIN_WIDTH,
} from '../map-bottom-sheet-layout-preset';

describe('resolveMapBottomSheetLayoutPreset', () => {
  it('keeps the default smartphone preset for short viewports', () => {
    expect(resolveMapBottomSheetLayoutPreset(640)).toEqual({
      collapsedSheetHeightClassName: 'h-[40dvh]',
      expandedSheetHeightClassName: 'h-[70dvh]',
    });
  });

  it('keeps the default smartphone preset for mid-height viewports', () => {
    expect(resolveMapBottomSheetLayoutPreset(760)).toEqual({
      collapsedSheetHeightClassName: 'h-[40dvh]',
      expandedSheetHeightClassName: 'h-[70dvh]',
    });
  });

  it('returns the medium preset for medium-tall viewports', () => {
    expect(resolveMapBottomSheetLayoutPreset(900)).toEqual({
      collapsedSheetHeightClassName: 'h-[50dvh]',
      expandedSheetHeightClassName: 'h-[60dvh]',
    });
  });

  it('returns the desktop preset for very tall viewports', () => {
    expect(resolveMapBottomSheetLayoutPreset(1100)).toEqual({
      collapsedSheetHeightClassName: 'h-[50dvh]',
      expandedSheetHeightClassName: 'h-[60dvh]',
    });
  });

  it('returns the desktop preset after the tall threshold', () => {
    expect(resolveMapBottomSheetLayoutPreset(1300)).toEqual({
      collapsedSheetHeightClassName: 'h-[60dvh]',
      expandedSheetHeightClassName: 'h-[70dvh]',
    });
  });

  it('falls back to regular preset when viewport height is unavailable', () => {
    expect(resolveMapBottomSheetLayoutPreset(0)).toEqual({
      collapsedSheetHeightClassName: 'h-[40dvh]',
      expandedSheetHeightClassName: 'h-[70dvh]',
    });
  });
});

describe('isWideViewport', () => {
  it('returns false for narrow (smartphone) viewports', () => {
    expect(isWideViewport(390)).toBe(false);
  });

  it('returns false just below the wide threshold', () => {
    expect(isWideViewport(WIDE_VIEWPORT_MIN_WIDTH - 1)).toBe(false);
  });

  it('returns true exactly at the wide threshold', () => {
    expect(isWideViewport(WIDE_VIEWPORT_MIN_WIDTH)).toBe(true);
  });

  it('returns true for wide (PC / landscape tablet) viewports', () => {
    expect(isWideViewport(1440)).toBe(true);
  });

  it('returns false when viewport width is unavailable', () => {
    expect(isWideViewport(0)).toBe(false);
  });
});

describe('resolveMultiPaneOrientation', () => {
  it('returns horizontal for landscape viewports', () => {
    expect(resolveMultiPaneOrientation(1366, 1024)).toBe('horizontal');
  });

  it('returns horizontal for a square viewport', () => {
    expect(resolveMultiPaneOrientation(1024, 1024)).toBe('horizontal');
  });

  it('returns vertical for portrait viewports', () => {
    expect(resolveMultiPaneOrientation(900, 1400)).toBe('vertical');
  });

  it('treats the iPad Pro 12.9" portrait (1024x1366) as vertical', () => {
    expect(resolveMultiPaneOrientation(1024, 1366)).toBe('vertical');
  });

  it('treats the Nest Hub (1024x600) as horizontal', () => {
    expect(resolveMultiPaneOrientation(1024, 600)).toBe('horizontal');
  });
});
