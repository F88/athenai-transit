import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeRepo, makeStop, makeStopMeta } from '../../__tests__/helpers';
import type { AnchorEntry } from '../../domain/portal/anchor';
import { useAnchorRefresh } from '../use-anchor-refresh';

function makeAnchor(stopId: string, name: string, lat = 35, lon = 139): AnchorEntry {
  return {
    snapshot: {
      stopId,
      name,
      lat,
      lon,
      routeTypes: [3],
      agencyNames: [],
    },
    createdAt: 1000,
  };
}

describe('useAnchorRefresh', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call batchUpdateAnchors when anchors is empty', () => {
    const batchUpdateAnchors = vi.fn().mockResolvedValue({ success: true, data: [] });
    const repo = makeRepo({ getStopMetaByIds: vi.fn(() => []) });

    renderHook(() =>
      useAnchorRefresh({ anchors: [], repo, batchUpdateAnchors, langChain: ['ja'] }),
    );

    expect(batchUpdateAnchors).not.toHaveBeenCalled();
  });

  it('fires the refresh exactly once when anchors transitions from empty to non-empty', () => {
    const batchUpdateAnchors = vi.fn().mockResolvedValue({ success: true, data: [] });
    const stop = makeStop('A', 36, 140); // live coords differ from anchor snapshot (35, 139)
    const meta = makeStopMeta(stop);
    const getStopMetaByIds = vi.fn((ids: Set<string>) =>
      ids.has(meta.stop.stop_id) ? [meta] : [],
    );
    const repo = makeRepo({ getStopMetaByIds });

    const { rerender } = renderHook(
      ({ anchors }) => useAnchorRefresh({ anchors, repo, batchUpdateAnchors, langChain: ['ja'] }),
      {
        initialProps: { anchors: [] as AnchorEntry[] },
      },
    );

    // First render with empty anchors: no fetch, no update.
    expect(getStopMetaByIds).not.toHaveBeenCalled();

    // Async-loaded anchors arrive.
    rerender({ anchors: [makeAnchor('A', 'Old Name')] });

    expect(getStopMetaByIds).toHaveBeenCalledTimes(1);
    expect(batchUpdateAnchors).toHaveBeenCalledTimes(1);

    // Further anchor mutations during the session must not re-fire.
    rerender({ anchors: [makeAnchor('A', 'Old Name'), makeAnchor('B', 'New Anchor')] });
    rerender({ anchors: [makeAnchor('A', 'Old Name')] });

    expect(getStopMetaByIds).toHaveBeenCalledTimes(1);
    expect(batchUpdateAnchors).toHaveBeenCalledTimes(1);
  });

  it('skips batchUpdateAnchors when buildAnchorRefreshUpdates yields no diffs', () => {
    const batchUpdateAnchors = vi.fn().mockResolvedValue({ success: true, data: [] });
    // Stop coords + name match the anchor snapshot so the diff is empty.
    const stop = makeStop('A', 35, 139);
    const meta = makeStopMeta(stop);
    const repo = makeRepo({
      getStopMetaByIds: vi.fn((ids: Set<string>) => (ids.has(meta.stop.stop_id) ? [meta] : [])),
    });

    const anchor: AnchorEntry = {
      snapshot: {
        stopId: 'A',
        name: 'Stop A', // matches makeStop helper's stop_name format
        lat: 35,
        lon: 139,
        routeTypes: [3],
        agencyNames: [],
      },
      createdAt: 1000,
    };

    renderHook(() =>
      useAnchorRefresh({ anchors: [anchor], repo, batchUpdateAnchors, langChain: ['ja'] }),
    );

    expect(batchUpdateAnchors).not.toHaveBeenCalled();
  });

  it('does not re-fire when langChain changes after the first refresh has run', () => {
    const batchUpdateAnchors = vi.fn().mockResolvedValue({ success: true, data: [] });
    const stop = makeStop('A', 36, 140);
    const meta = makeStopMeta(stop);
    const getStopMetaByIds = vi.fn((ids: Set<string>) =>
      ids.has(meta.stop.stop_id) ? [meta] : [],
    );
    const repo = makeRepo({ getStopMetaByIds });

    const { rerender } = renderHook(
      ({ langChain }) =>
        useAnchorRefresh({
          anchors: [makeAnchor('A', 'Old Name')],
          repo,
          batchUpdateAnchors,
          langChain,
        }),
      {
        initialProps: { langChain: ['ja'] as readonly string[] },
      },
    );

    expect(getStopMetaByIds).toHaveBeenCalledTimes(1);
    expect(batchUpdateAnchors).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ langChain: ['en', 'ja'] });
    });

    // done.current already true, so the dep change does NOT re-fire.
    expect(getStopMetaByIds).toHaveBeenCalledTimes(1);
    expect(batchUpdateAnchors).toHaveBeenCalledTimes(1);
  });
});
