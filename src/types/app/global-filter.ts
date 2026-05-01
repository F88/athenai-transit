/**
 * App-wide display filter state shared across surfaces (BottomSheet,
 * TimetableModal, MapView, TripInspectionDialog, etc.).
 *
 * Owned by `app.tsx` and threaded through props as a single
 * `globalFilter` object so the namespace is explicit at every
 * receiver. Drilling depth is shallow (1–2 levels), so explicit
 * props are clearer than a Context provider.
 */
export interface GlobalFilter {
  /** When true, narrow to entries whose patternPosition.isOrigin is true. */
  showOriginOnly: boolean;
  /** When true, narrow to entries with `pickup_type === 0` at non-pure-terminal positions. */
  showBoardableOnly: boolean;
  /** When true, omit stops whose filtered `stopTimes` collection is empty. */
  omitEmptyStops: boolean;
  /** Toggle `showOriginOnly`. */
  onToggleShowOriginOnly: () => void;
  /** Toggle `showBoardableOnly`. */
  onToggleShowBoardableOnly: () => void;
  /** Toggle `omitEmptyStops`. */
  onToggleOmitEmptyStops: () => void;
}
