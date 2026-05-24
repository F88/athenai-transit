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

  it('returns simple below the wide viewport threshold', () => {
    mockUseViewport.mockReturnValue({ width: 1023, height: 800 });

    const { result } = renderHook(() => useLayoutMode());

    expect(result.current).toBe('simple');
  });

  it('returns multi-pane at the wide viewport threshold', () => {
    mockUseViewport.mockReturnValue({ width: 1024, height: 800 });

    const { result } = renderHook(() => useLayoutMode());

    expect(result.current).toBe('multi-pane');
  });
});
