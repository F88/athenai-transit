import type { AppRouteTypeValue } from './transit';
import type { TranslatableText } from './transit-composed';

/**
 * A group of related GTFS data sources managed as a single toggle unit.
 *
 * For example, a single group may bundle bus and train prefixes that should
 * be toggled together in the UI.
 */
export interface SourceGroup {
  /** Unique identifier for this source group. */
  id: string;

  /** GTFS JSON prefixes belonging to this group. */
  prefixes: string[];

  /** GTFS route_type values represented by this source group. */
  routeTypes: AppRouteTypeValue[];

  /** Whether this source group is enabled by default. */
  enabled: boolean;

  /** Localized display names keyed by language (for example `ja`, `en`). */
  name: TranslatableText;

  /**
   * ISO 3166-1 alpha-2 country codes for the source group.
   *
   * The array form allows cross-border services to belong to multiple
   * countries while single-country groups still use a one-element array.
   */
  countries: string[];
}
