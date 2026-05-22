import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutMode } from '../use-layout-mode';

const { mockUseViewportWidth } = vi.hoisted(() => ({
  mockUseViewportWidth: vi.fn(),
}));

vi.mock('../use-viewport-width', () => ({
  useViewportWidth: mockUseViewportWidth,
}));

describe('useLayoutMode', () => {
  beforeEach(() => {
    mockUseViewportWidth.mockReset();
  });

  it('returns simple below the wide viewport threshold', () => {
    mockUseViewportWidth.mockReturnValue(1023);

    const { result } = renderHook(() => useLayoutMode());

    expect(result.current).toBe('simple');
  });

  it('returns multi-pane at the wide viewport threshold', () => {
    mockUseViewportWidth.mockReturnValue(1024);

    const { result } = renderHook(() => useLayoutMode());

    expect(result.current).toBe('multi-pane');
  });
});
