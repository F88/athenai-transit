import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMultiPaneOrientation } from '../use-multi-pane-orientation';

const { mockUseViewportWidth, mockUseViewportHeight } = vi.hoisted(() => ({
  mockUseViewportWidth: vi.fn(),
  mockUseViewportHeight: vi.fn(),
}));

vi.mock('../use-viewport-width', () => ({
  useViewportWidth: mockUseViewportWidth,
}));

vi.mock('../use-viewport-height', () => ({
  useViewportHeight: mockUseViewportHeight,
}));

describe('useMultiPaneOrientation', () => {
  beforeEach(() => {
    mockUseViewportWidth.mockReset();
    mockUseViewportHeight.mockReset();
  });

  it('returns horizontal when width is greater than height', () => {
    mockUseViewportWidth.mockReturnValue(1366);
    mockUseViewportHeight.mockReturnValue(1024);

    const { result } = renderHook(() => useMultiPaneOrientation());

    expect(result.current).toBe('horizontal');
  });

  it('returns vertical when height is greater than width', () => {
    mockUseViewportWidth.mockReturnValue(900);
    mockUseViewportHeight.mockReturnValue(1400);

    const { result } = renderHook(() => useMultiPaneOrientation());

    expect(result.current).toBe('vertical');
  });
});
