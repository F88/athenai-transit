import { useEffect, useRef } from 'react';

import { createLogger } from '../lib/logger';
import { getStopParam } from '../lib/query-params';
import type { TransitRepository } from '../repositories/transit-repository';
import type { AutoLocateOffReason } from '../types/app/auto-locate';
import type { Stop } from '../types/app/transit';
import type { StopWithMeta } from '../types/app/transit-composed';

const logger = createLogger('StopParamHandler');

/**
 * Arguments for {@link useStopParamHandler}.
 */
export interface UseStopParamHandlerParams {
  /** Active transit repository, used to resolve the `?stop=<id>` value. */
  repo: TransitRepository;
  /** Caller-supplied focus + pan-to-stop side effect. */
  navigateAndFocusStop: (reason: AutoLocateOffReason, stop: Stop) => void;
  /** Caller-supplied history record side effect for the resolved stop. */
  recordStopMetaSelection: (stopMeta: StopWithMeta) => void;
}

/**
 * Apply the `?stop=<id>` URL query parameter once per app session:
 * resolve the stop_id against the repository, pan / focus the map to
 * it, and record the resolved snapshot in history.
 *
 * The internal `handled` ref guarantees the workflow runs at most
 * once per `useStopParamHandler` lifetime, including across the
 * async repository fetch -- the post-resolve continuation re-checks
 * `handled.current` so a re-render that swaps the dep callbacks does
 * not double-fire focus / record.
 *
 * No-param path: the ref is marked handled immediately so subsequent
 * re-renders are no-ops.
 *
 * Not-found path: a warn is logged (`'StopParamHandler'` namespace,
 * separate from the App-level logger so the source is unambiguous)
 * and the ref is marked handled; the map is not panned and no
 * history entry is recorded.
 *
 * @param params - See {@link UseStopParamHandlerParams}.
 */
export function useStopParamHandler({
  repo,
  navigateAndFocusStop,
  recordStopMetaSelection,
}: UseStopParamHandlerParams): void {
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) {
      return;
    }

    const markHandled = () => {
      handled.current = true;
    };

    const stopId = getStopParam();
    if (!stopId) {
      markHandled();
      return;
    }

    void repo.getStopMetaById(stopId).then((result) => {
      if (handled.current) {
        return;
      }
      if (!result.success) {
        logger.warn(`?stop=${stopId}: not found`);
        markHandled();
        return;
      }
      navigateAndFocusStop('apply-stop-param', result.data.stop);
      recordStopMetaSelection(result.data);
      markHandled();
    });
  }, [navigateAndFocusStop, recordStopMetaSelection, repo]);
}
