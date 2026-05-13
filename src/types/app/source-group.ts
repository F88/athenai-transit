import type { AppRouteTypeValue } from './transit';
import type { TranslatableText } from './transit-composed';

/**
 * A group of related GTFS data sources managed as a single toggle unit.
 *
 * A group expresses a *user-facing viewpoint* over one or more underlying
 * GTFS prefixes. Two design properties follow from that:
 *
 * 1. **`prefixes` is plural.** A group may bundle multiple prefixes that
 *    a user thinks of as one offering. For example, a future "都営交通
 *    まるごときっぷ" group could be defined as
 *    `{ id: 'toei', prefixes: ['minkuru', 'toaran'], routeTypes: [0, 1, 2, 3] }`
 *    to represent the unified all-modes day-pass.
 *
 * 2. **Groups may overlap on `prefixes`.** A single prefix can be referenced
 *    by more than one group entry. The aggregate "toei" example above does
 *    NOT replace the individual `toei-bus` (`['minkuru']`) and `toei-train`
 *    (`['toaran']`) groups — all three coexist, each presenting a different
 *    viewpoint on the same underlying sources.
 *
 * The webapp must therefore treat each group as an independent display unit
 * and never assume that a prefix appears in at most one group.
 */
export interface SourceGroup {
  /** Unique identifier for this source group. */
  id: string;

  /**
   * GTFS JSON prefixes belonging to this group.
   *
   * **Plural by design** (see interface-level docs). A group may bundle
   * multiple prefixes, and the same prefix may appear in more than one
   * group's `prefixes` list.
   */
  prefixes: string[];

  /** GTFS route_type values represented by this source group. */
  routeTypes: AppRouteTypeValue[];

  /**
   * System-level availability of this source group.
   *
   * Currently equivalent in semantic to the previous `enabled` field —
   * Phase 0 only renames it and does not yet enforce stricter gating.
   * The intent is to evolve this into an absolute gate (defaults
   * resolution, localStorage restoration, UI visibility) in a future
   * phase, with the URL `?sources=all` escape hatch being the sole
   * bypass. Until then it continues to drive default loading and the
   * data-source settings dialog visibility filter.
   */
  systemEnabledByDefault: boolean;

  /**
   * Default value of the user preference for whether this group is
   * enabled.
   *
   * Surfaced **read-only** in the Data Source Settings dialog (each
   * group row reflects this value via a `disabled` `<Switch>`); it is
   * not yet used for source selection, mutation, or `localStorage`
   * persistence. A future phase will wire this into the user-settings
   * layer (`useUserDataSourceSettings`-style hook) so that user choices
   * persisted in `localStorage` can override this default.
   *
   * Phase 0 migration rule: each group's value mirrors
   * {@link systemEnabledByDefault} 1:1, so behavior is unchanged until a later
   * phase begins reading this field for source-selection purposes.
   */
  userEnabledByDefault: boolean;

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
