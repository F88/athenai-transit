/**
 * Reason an auto-locate session was turned off. Used purely for
 * diagnostic logging — every reason takes the same state path
 * (= flip `autoLocateEnabled` to false), so the value distinguishes
 * provenance rather than driving behavior.
 */
export type AutoLocateOffReason =
  /** 🎯 button tap while tracking was on. */
  | 'user-toggle'
  /** GeolocationPositionError code 1 (PERMISSION_DENIED). */
  | 'permission-denied'
  /** Initial ?stop= query parameter application. */
  | 'apply-stop-param'
  /** Map stop marker click. */
  | 'select-marker'
  /** BottomSheet stop list click. */
  | 'select-bottom-sheet'
  /** TripInspection stop list click. */
  | 'select-trip-inspection'
  /** Search dialog selection. */
  | 'select-search'
  /** History dropdown selection. */
  | 'select-history'
  /** Anchor / portal selection. */
  | 'select-portal'
  /** 🎲 random jump button. */
  | 'random-jump'
  /** User drag of the map. */
  | 'manual-drag'
  /** Pinch zoom that shifted the center past `LOCATE_NEAR_THRESHOLD_METERS`. */
  | 'pinch-zoom-shift';
