import { describe, expect, it } from 'vitest';
import { resolveMapBottomSheetLayoutPreset } from '../map-bottom-sheet-layout-preset';

describe('resolveMapBottomSheetLayoutPreset', () => {
  it('keeps the default smartphone preset for short viewports', () => {
    expect(resolveMapBottomSheetLayoutPreset(640)).toEqual({
      collapsedMapHeightClassName: 'h-[60dvh]',
      expandedMapHeightClassName: 'h-[60dvh]',
      collapsedSheetHeightClassName: 'h-[40dvh]',
      expandedSheetHeightClassName: 'h-[70dvh]',
    });
  });

  it('keeps the default smartphone preset for mid-height viewports', () => {
    expect(resolveMapBottomSheetLayoutPreset(760)).toEqual({
      collapsedMapHeightClassName: 'h-[60dvh]',
      expandedMapHeightClassName: 'h-[60dvh]',
      collapsedSheetHeightClassName: 'h-[40dvh]',
      expandedSheetHeightClassName: 'h-[70dvh]',
    });
  });

  it('returns the medium preset for medium-tall viewports', () => {
    expect(resolveMapBottomSheetLayoutPreset(900)).toEqual({
      collapsedMapHeightClassName: 'h-[50dvh]',
      expandedMapHeightClassName: 'h-[50dvh]',
      collapsedSheetHeightClassName: 'h-[50dvh]',
      expandedSheetHeightClassName: 'h-[70dvh]',
    });
  });

  it('returns the desktop preset for very tall viewports', () => {
    expect(resolveMapBottomSheetLayoutPreset(1100)).toEqual({
      collapsedMapHeightClassName: 'h-[50dvh]',
      expandedMapHeightClassName: 'h-[50dvh]',
      collapsedSheetHeightClassName: 'h-[50dvh]',
      expandedSheetHeightClassName: 'h-[70dvh]',
    });
  });

  it('returns the desktop preset after the tall threshold', () => {
    expect(resolveMapBottomSheetLayoutPreset(1300)).toEqual({
      collapsedMapHeightClassName: 'h-[40dvh]',
      expandedMapHeightClassName: 'h-[40dvh]',
      collapsedSheetHeightClassName: 'h-[60dvh]',
      expandedSheetHeightClassName: 'h-[70dvh]',
    });
  });

  it('falls back to regular preset when viewport height is unavailable', () => {
    expect(resolveMapBottomSheetLayoutPreset(0)).toEqual({
      collapsedMapHeightClassName: 'h-[60dvh]',
      expandedMapHeightClassName: 'h-[60dvh]',
      collapsedSheetHeightClassName: 'h-[40dvh]',
      expandedSheetHeightClassName: 'h-[70dvh]',
    });
  });
});
