import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeRepo, makeStop, makeStopMeta } from '../../__tests__/helpers';
import { useStopSearchMeta } from '../use-stop-search-meta';

describe('useStopSearchMeta', () => {
  it('returns an empty map without calling the repository when stops is empty', () => {
    const getStopMetaByIds = vi.fn().mockReturnValue([]);
    const repo = makeRepo({ getStopMetaByIds });

    const { result } = renderHook(() => useStopSearchMeta(repo, []));

    expect(result.current.size).toBe(0);
    expect(getStopMetaByIds).not.toHaveBeenCalled();
  });

  it('calls getStopMetaByIds with the filtered stop ids and returns a lookup map', () => {
    const stopA = makeStop('stop-a');
    const stopB = makeStop('stop-b');
    const metaA = makeStopMeta(stopA);
    const metaB = makeStopMeta(stopB);
    const getStopMetaByIds = vi.fn().mockReturnValue([metaA, metaB]);
    const repo = makeRepo({ getStopMetaByIds });

    const { result } = renderHook(() => useStopSearchMeta(repo, [stopA, stopB]));

    const callArg = getStopMetaByIds.mock.calls[0]?.[0] as Set<string>;
    expect(callArg).toBeInstanceOf(Set);
    expect([...callArg].sort()).toEqual(['stop-a', 'stop-b']);
    expect(result.current.size).toBe(2);
    expect(result.current.get('stop-a')).toBe(metaA);
    expect(result.current.get('stop-b')).toBe(metaB);
  });

  it('omits stops the repository did not return (silent skip)', () => {
    const stopA = makeStop('stop-a');
    const stopMissing = makeStop('stop-missing');
    const getStopMetaByIds = vi.fn().mockReturnValue([makeStopMeta(stopA)]);
    const repo = makeRepo({ getStopMetaByIds });

    const { result } = renderHook(() => useStopSearchMeta(repo, [stopA, stopMissing]));

    expect(result.current.has('stop-a')).toBe(true);
    expect(result.current.has('stop-missing')).toBe(false);
  });

  it('skips re-computation when stops reference is stable across renders', () => {
    const stopA = makeStop('stop-a');
    const getStopMetaByIds = vi.fn().mockReturnValue([makeStopMeta(stopA)]);
    const repo = makeRepo({ getStopMetaByIds });
    const stops = [stopA];

    const { rerender } = renderHook(({ s }: { s: typeof stops }) => useStopSearchMeta(repo, s), {
      initialProps: { s: stops },
    });
    rerender({ s: stops });

    expect(getStopMetaByIds).toHaveBeenCalledTimes(1);
  });

  it('recomputes when the stops reference changes', () => {
    const stopA = makeStop('stop-a');
    const stopB = makeStop('stop-b');
    const getStopMetaByIds = vi.fn().mockReturnValue([]);
    const repo = makeRepo({ getStopMetaByIds });

    const { rerender } = renderHook(
      ({ s }: { s: (typeof stopA)[] }) => useStopSearchMeta(repo, s),
      {
        initialProps: { s: [stopA] as (typeof stopA)[] },
      },
    );
    rerender({ s: [stopA, stopB] });

    expect(getStopMetaByIds).toHaveBeenCalledTimes(2);
  });
});
