/**
 * Aggregate counts over a set of stops.
 *
 * Counts are grouped by axis to keep faithful (read straight from the
 * source) and interpreted (judged for the passenger) layers from being
 * mixed under one heading (Issue #162):
 * - `position` is faithful (pattern role).
 * - `passenger` is interpreted (value for the passenger).
 */
export interface StopsCounts {
  /** Total number of stops. */
  total: number;
  /** Stops with at least one stop time. */
  nonEmpty: number;

  /** Faithful: pattern role of the stops' entries. */
  position: {
    /** Stops with at least one origin entry (= `isFirstStop`). */
    originCount: number;
  };

  /** Interpreted: value for the passenger. */
  passenger: {
    /** Stops with at least one boardable entry (= `isBoardableForPassenger`). */
    boardableCount: number;
  };
}
