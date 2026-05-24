import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMultiPaneOrientation } from '../use-multi-pane-orientation';

const { mockUseViewport } = vi.hoisted(() => ({
  mockUseViewport: vi.fn(),
}));

vi.mock('../use-viewport', () => ({
  useViewport: mockUseViewport,
}));

describe('useMultiPaneOrientation', () => {
  beforeEach(() => {
    mockUseViewport.mockReset();
  });

  it('returns horizontal when width is greater than height', () => {
    mockUseViewport.mockReturnValue({ width: 1366, height: 1024 });

    const { result } = renderHook(() => useMultiPaneOrientation());

    expect(result.current).toBe('horizontal');
  });

  it('returns vertical when height is greater than width', () => {
    mockUseViewport.mockReturnValue({ width: 900, height: 1400 });

    const { result } = renderHook(() => useMultiPaneOrientation());

    expect(result.current).toBe('vertical');
  });
});
