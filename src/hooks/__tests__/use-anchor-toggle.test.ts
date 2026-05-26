import { act, renderHook, waitFor } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeRepo, makeStopMeta } from '../../__tests__/helpers';
import type { AnchorEntry } from '../../domain/portal/anchor';
import type { UseAnchorsReturn } from '../use-anchors';
import { useAnchorToggle } from '../use-anchor-toggle';
import type { TransitRepository } from '../../repositories/transit-repository';

type ToastOptions = {
  description?: string;
};

const { mockToastSuccess, mockToastWarning } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn<(message: string, options?: ToastOptions) => void>(),
  mockToastWarning: vi.fn<(message: string, options?: ToastOptions) => void>(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    warning: mockToastWarning,
  },
}));

function makeAnchorEntry(stopId: string, name = `Snapshot ${stopId}`): AnchorEntry {
  return {
    snapshot: {
      stopId,
      name,
      lat: 35,
      lon: 139,
      routeTypes: [3],
      agencyNames: [],
    },
    createdAt: 1000,
  };
}

describe('useAnchorToggle', () => {
  beforeEach(() => {
    mockToastSuccess.mockReset();
    mockToastWarning.mockReset();
  });

  it('removes an existing anchor and shows a warning toast with the current display name', async () => {
    const removeAnchor = vi
      .fn<UseAnchorsReturn['removeAnchor']>()
      .mockResolvedValue({ success: true, data: undefined });
    const meta = makeStopMeta('A');
    meta.stop.stop_name = 'Current A';

    const { result } = renderHook(() =>
      useAnchorToggle({
        anchors: [makeAnchorEntry('A', 'Stored A')],
        hasAnchor: vi.fn((stopId: string) => stopId === 'A'),
        addAnchor: vi.fn(),
        removeAnchor,
        repo: makeRepo(),
        lookupAnchorStopMeta: vi.fn(() => meta),
        langChain: ['ja'],
        t: ((key: string) => key) as TFunction,
      }),
    );

    act(() => {
      result.current.handleToggleAnchorByStopId('A');
    });

    await waitFor(() => {
      expect(removeAnchor).toHaveBeenCalledWith('A');
      expect(mockToastWarning).toHaveBeenCalled();
      const [, options] = mockToastWarning.mock.calls[0] ?? [];
      expect(options).toBeDefined();
      expect(options?.description).toContain('Current A');
    });
  });

  it('adds a new anchor and shows a success toast', async () => {
    const addAnchor = vi
      .fn<UseAnchorsReturn['addAnchor']>()
      .mockResolvedValue({ success: true, data: makeAnchorEntry('A') });
    const meta = makeStopMeta('A');
    meta.stop.stop_name = 'Current A';
    const getStopMetaById = vi
      .fn<TransitRepository['getStopMetaById']>()
      .mockResolvedValue({ success: true, data: meta });
    const getRouteTypesForStop = vi
      .fn<TransitRepository['getRouteTypesForStop']>()
      .mockResolvedValue({ success: true, data: [3] });
    const repo = makeRepo({
      getStopMetaById,
      getRouteTypesForStop,
    });

    const { result } = renderHook(() =>
      useAnchorToggle({
        anchors: [],
        hasAnchor: vi.fn(() => false),
        addAnchor,
        removeAnchor: vi.fn(),
        repo,
        lookupAnchorStopMeta: vi.fn(() => null),
        langChain: ['ja'],
        t: ((key: string) => key) as TFunction,
      }),
    );

    act(() => {
      result.current.handleToggleAnchorByStopId('A');
    });

    await waitFor(() => {
      expect(addAnchor).toHaveBeenCalled();
      const [entry] = addAnchor.mock.calls[0] ?? [];
      expect(entry).toBeDefined();
      expect(entry?.snapshot.stopId).toBe('A');
      expect(entry?.snapshot.name).toBe('Current A');

      expect(mockToastSuccess).toHaveBeenCalled();
      const [, options] = mockToastSuccess.mock.calls[0] ?? [];
      expect(options).toBeDefined();
      expect(options?.description).toContain('Current A');
    });
  });
});
