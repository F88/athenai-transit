/**
 * App-wide display filter state shared across surfaces.
 *
 * Direct consumers (receive the `globalFilter` prop):
 *
 *   - `BottomSheet` (via `AppLayout` -> `MapBottomSheetLayout` /
 *     `StopPanel` -> `StopBrowser`)
 *   - `TimetableModal`
 *
 * Indirect consumers (read the filter's *output*, not this object):
 *
 *   - `MapView` and other surfaces that render `stopTimes` produced
 *     by `deriveFilteredNearbyStops` already see the filtered result.
 *     They do not receive `GlobalFilter`.
 *
 * Owned by `useGlobalFilter(dateTime)` (`src/hooks/use-global-filter.ts`)
 * and threaded through props as a single `globalFilter` object so the
 * namespace is explicit at every receiver. Drilling depth is shallow
 * (1-2 levels), so explicit props are clearer than a Context
 * provider.
 */
export interface GlobalFilter {
  /** When true, narrow to entries whose patternPosition.isOrigin is true. */
  showOriginOnly: boolean;
  /** When true, narrow to entries with `pickup_type === 0` at non-pure-terminal positions. */
  showBoardableOnly: boolean;
  /** Effective empty-stop visibility policy after forced-on conditions are applied. */
  omitEmptyStops: boolean;
  /** Whether empty-stop omission is currently forced by another app-wide toggle. */
  isOmitEmptyStopsForced: boolean;
  /** Toggle `showOriginOnly`. */
  onToggleShowOriginOnly: () => void;
  /** Toggle `showBoardableOnly`. */
  onToggleShowBoardableOnly: () => void;
  /** Toggle `omitEmptyStops`. */
  onToggleOmitEmptyStops: () => void;
}
