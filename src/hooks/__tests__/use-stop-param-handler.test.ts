import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeRepo, makeStop, makeStopMeta } from '../../__tests__/helpers';
import * as queryParams from '../../lib/query-params';
import { useStopParamHandler } from '../use-stop-param-handler';

describe('useStopParamHandler', () => {
  beforeEach(() => {
    vi.spyOn(queryParams, 'getStopParam').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks handled without calling repo when there is no ?stop= param', async () => {
    const getStopMetaById = vi.fn();
    const repo = makeRepo({ getStopMetaById });
    const navigateAndFocusStop = vi.fn();
    const recordStopMetaSelection = vi.fn();

    renderHook(() => useStopParamHandler({ repo, navigateAndFocusStop, recordStopMetaSelection }));

    // Flush microtasks so any deferred state would have run.
    await act(async () => {
      await Promise.resolve();
    });

    expect(getStopMetaById).not.toHaveBeenCalled();
    expect(navigateAndFocusStop).not.toHaveBeenCalled();
    expect(recordStopMetaSelection).not.toHaveBeenCalled();
  });

  it('navigates and records when ?stop= resolves successfully', async () => {
    vi.spyOn(queryParams, 'getStopParam').mockReturnValue('A');
    const stopMeta = makeStopMeta(makeStop('A', 35, 139));
    const getStopMetaById = vi.fn().mockResolvedValue({ success: true, data: stopMeta });
    const repo = makeRepo({ getStopMetaById });
    const navigateAndFocusStop = vi.fn();
    const recordStopMetaSelection = vi.fn();

    renderHook(() => useStopParamHandler({ repo, navigateAndFocusStop, recordStopMetaSelection }));

    await waitFor(() => {
      expect(navigateAndFocusStop).toHaveBeenCalledTimes(1);
    });
    expect(navigateAndFocusStop).toHaveBeenCalledWith('apply-stop-param', stopMeta.stop);
    expect(recordStopMetaSelection).toHaveBeenCalledTimes(1);
    expect(recordStopMetaSelection).toHaveBeenCalledWith(stopMeta);
  });

  it('marks handled without navigating when the stop is not found', async () => {
    vi.spyOn(queryParams, 'getStopParam').mockReturnValue('missing');
    const getStopMetaById = vi.fn().mockResolvedValue({ success: false, error: 'not found' });
    const repo = makeRepo({ getStopMetaById });
    const navigateAndFocusStop = vi.fn();
    const recordStopMetaSelection = vi.fn();

    renderHook(() => useStopParamHandler({ repo, navigateAndFocusStop, recordStopMetaSelection }));

    // Wait for repo promise + post-resolve handler to settle.
    await waitFor(() => {
      expect(getStopMetaById).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(navigateAndFocusStop).not.toHaveBeenCalled();
    expect(recordStopMetaSelection).not.toHaveBeenCalled();
  });

  it('does not re-fire after the initial handle, even when dep callbacks change', async () => {
    vi.spyOn(queryParams, 'getStopParam').mockReturnValue('A');
    const stopMeta = makeStopMeta(makeStop('A', 35, 139));
    const getStopMetaById = vi.fn().mockResolvedValue({ success: true, data: stopMeta });
    const repo = makeRepo({ getStopMetaById });
    const initialNavigate = vi.fn();
    const initialRecord = vi.fn();

    const { rerender } = renderHook(
      ({ navigate, record }) =>
        useStopParamHandler({
          repo,
          navigateAndFocusStop: navigate,
          recordStopMetaSelection: record,
        }),
      {
        initialProps: { navigate: initialNavigate, record: initialRecord },
      },
    );

    await waitFor(() => {
      expect(initialNavigate).toHaveBeenCalledTimes(1);
    });
    expect(getStopMetaById).toHaveBeenCalledTimes(1);

    // Swap dep callbacks (simulates `App` re-render with new closures).
    const nextNavigate = vi.fn();
    const nextRecord = vi.fn();
    rerender({ navigate: nextNavigate, record: nextRecord });
    await act(async () => {
      await Promise.resolve();
    });

    // Even though the effect re-runs (deps changed), the `handled` ref
    // short-circuits before the fetch.
    expect(getStopMetaById).toHaveBeenCalledTimes(1);
    expect(nextNavigate).not.toHaveBeenCalled();
    expect(nextRecord).not.toHaveBeenCalled();
  });
});
