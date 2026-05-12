import { buildStopByPatternIndex, getPatternTotalStops } from '@/domain/transit/trip-stop-times';
import type { SelectedTripSnapshot, TripStopTime } from '@/types/app/transit-composed';

// Initial frame renders the selected stop and +/- 5 neighbors so
// long trips paint quickly before the full list is restored.
const INITIAL_TRIP_STOP_RENDER_PADDING = 5;

export type RenderedTripStopRow =
  | { kind: 'stop'; stop: TripStopTime; stopIndex: number; totalStops: number }
  | { kind: 'placeholder'; stopIndex: number; totalStops: number };

function buildRenderedTripStopRows(stopTimes: readonly TripStopTime[]): RenderedTripStopRow[] {
  const totalStops = getPatternTotalStops(stopTimes);
  if (totalStops === 0) {
    return [];
  }

  const stopByIndex = buildStopByPatternIndex(stopTimes);

  return Array.from({ length: totalStops }, (_, stopIndex) => {
    const stop = stopByIndex.get(stopIndex);
    if (stop) {
      return { kind: 'stop', stop, stopIndex, totalStops } satisfies RenderedTripStopRow;
    }

    return { kind: 'placeholder', stopIndex, totalStops } satisfies RenderedTripStopRow;
  });
}

export function getVisibleTripStopRows({
  tripSnapshot,
  renderedSnapshot,
  selectedPatternStopIndex,
}: {
  tripSnapshot: SelectedTripSnapshot;
  renderedSnapshot: SelectedTripSnapshot | null;
  selectedPatternStopIndex: number;
}): RenderedTripStopRow[] {
  const renderedTripStopRows = buildRenderedTripStopRows(tripSnapshot.stopTimes);
  const initialRenderStart = Math.max(
    0,
    selectedPatternStopIndex - INITIAL_TRIP_STOP_RENDER_PADDING,
  );
  const initialRenderEnd = Math.min(
    renderedTripStopRows.length,
    selectedPatternStopIndex + INITIAL_TRIP_STOP_RENDER_PADDING + 1,
  );
  const renderAllStops = renderedSnapshot === tripSnapshot;

  return renderAllStops
    ? renderedTripStopRows
    : renderedTripStopRows.slice(initialRenderStart, initialRenderEnd);
}

export function getRenderedTripStopRowKey(row: RenderedTripStopRow): string {
  return row.kind === 'placeholder'
    ? `placeholder:${row.stopIndex}`
    : `${row.stop.stopMeta?.stop.stop_id || '(unknown-stop)'}:${row.stopIndex}`;
}
