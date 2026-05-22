import type { AppRouteTypeValue } from './transit';

/**
 * Durable fallback snapshot for referencing a stop outside the live repository.
 *
 * Used to replay persisted navigation, retain human-identifying stop context,
 * and derive minimal UI presentation when current repository metadata is
 * unavailable.
 */
export interface StopReferenceSnapshot {
  /** Stable stop identifier captured at selection time. */
  readonly stopId: string;

  /** Last known route types for the stop. */
  readonly routeTypes: readonly AppRouteTypeValue[];

  /** Agency labels captured for durable fallback display. */
  readonly agencyNames: readonly string[];

  /** Display string captured at selection time after i18n resolution. */
  readonly name: string;

  /** Last known platform identifier when available. */
  readonly platformCode?: string;

  /** Last known stop latitude; null for older migrated entries without coordinates. */
  readonly lat: number | null;

  /** Last known stop longitude; null for older migrated entries without coordinates. */
  readonly lon: number | null;
}
