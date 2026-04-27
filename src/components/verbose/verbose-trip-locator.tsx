import type { TripLocator } from '../../types/app/transit-composed';

/**
 * Debug dump of a TripLocator (patternId, serviceId, tripIndex).
 *
 * Surfaces the three fields that uniquely identify a reconstructed trip
 * in v2 data so they can be cross-referenced against the data files
 * (`tripPatterns[patternId]`, `timetable[stopId][].d[serviceId][tripIndex]`)
 * during debugging.
 *
 * Symmetric with the console.debug log emitted by
 * `buildTripInspectionSummaryLog` (`pattern=... service=... tripIndex=...`).
 */
export function VerboseTripLocator({
  locator,
  defaultOpen = false,
}: {
  locator: TripLocator;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="mt-1 text-[9px] font-normal text-[#999] dark:text-gray-500"
    >
      <summary
        tabIndex={-1}
        className="cursor-pointer select-none"
        onClick={(e) => e.stopPropagation()}
      >
        [TripLocator]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        <div className="border-app-neutral overflow-x-auto rounded border border-dashed p-1.5 whitespace-nowrap">
          <p className="m-0">
            pattern={locator.patternId} service={locator.serviceId} tripIndex={locator.tripIndex}
          </p>
        </div>
      </div>
    </details>
  );
}
