import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLayoutMode } from '../use-layout-mode';

const { mockUseViewport } = vi.hoisted(() => ({
  mockUseViewport: vi.fn(),
}));

vi.mock('../use-viewport', () => ({
  useViewport: mockUseViewport,
}));

describe('useLayoutMode', () => {
  beforeEach(() => {
    mockUseViewport.mockReset();
  });

  it('returns simple below the multi-pane threshold', () => {
    mockUseViewport.mockReturnValue({ width: 799, height: 600 });

    const { result } = renderHook(() => useLayoutMode());

    expect(result.current).toBe('simple');
  });

  it('returns multi-pane at the multi-pane threshold', () => {
    mockUseViewport.mockReturnValue({ width: 800, height: 600 });

    const { result } = renderHook(() => useLayoutMode());

    expect(result.current).toBe('multi-pane');
  });
});
