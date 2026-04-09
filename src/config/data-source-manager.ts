import settings from './data-source-settings';
import { getSourcesParam } from '../lib/query-params';
import { createLogger } from '../lib/logger';
import type { AppRouteTypeValue } from '../types/app/transit';
import type { TranslatableText } from '../types/app/transit-composed';

const logger = createLogger('DataSourceManager');

/**
 * A group of related GTFS data sources managed as a single toggle unit.
 *
 * For example, the "toei" group may contain both bus and train prefixes.
 */
export interface SourceGroup {
  /** Unique identifier for this source group. */
  id: string;
  /** GTFS JSON prefixes belonging to this group. */
  prefixes: string[];
  /** GTFS route_type values represented by this source group. */
  routeTypes: AppRouteTypeValue[];
  /** Whether this source is enabled by default. */
  enabled: boolean;
  /** Localized display names keyed by language (e.g. ja, en). */
  name: TranslatableText;
}

const STORAGE_KEY = 'enabled-sources';

/**
 * Manages which GTFS data sources are enabled/disabled.
 *
 * Persists user preferences to `localStorage` and provides
 * the list of active GTFS prefixes for {@link GtfsRepository} initialization.
 */
export class DataSourceManager {
  private groups: SourceGroup[];
  private enabledIds: Set<string>;

  /**
   * Creates a new manager.
   *
   * Source selection priority:
   * 1. URL `?sources=prefix1,prefix2` or `?sources=all` — transient override (localStorage not updated)
   * 2. localStorage — persisted user preferences
   * 3. Default — only groups with `enabled: true`
   */
  constructor() {
    this.groups = settings;
    // 1. ?sources=minkuru,yurimo or ?sources=all
    const sourcesParam = getSourcesParam();
    if (sourcesParam) {
      if (sourcesParam === 'all') {
        this.enabledIds = new Set(this.groups.map((g) => g.id));
        logger.info('Data sources from query params: all');
      } else {
        const requestedPrefixes = new Set(sourcesParam.split(',').map((s) => s.trim()));
        this.enabledIds = new Set(
          this.groups
            .filter((g) => g.prefixes.some((p) => requestedPrefixes.has(p)))
            .map((g) => g.id),
        );
        logger.info(`Data sources from query params: ${sourcesParam}`);
      }
      return;
    }

    // 3. localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.enabledIds = new Set(JSON.parse(stored) as string[]);
        return;
      }
    } catch {
      // fall through to default
    }

    // 4. Default: only groups with enabled: true
    this.enabledIds = new Set(this.groups.filter((g) => g.enabled).map((g) => g.id));
  }

  /**
   * Returns all available source groups.
   *
   * @returns Array of all configured {@link SourceGroup} entries.
   */
  getGroups(): SourceGroup[] {
    return this.groups;
  }

  /**
   * Check whether a source group is currently enabled.
   *
   * @param groupId - The source group ID to check.
   * @returns `true` if the group is enabled.
   */
  isEnabled(groupId: string): boolean {
    return this.enabledIds.has(groupId);
  }

  /**
   * Enable or disable a source group and persist the change.
   *
   * @param groupId - The source group ID to update.
   * @param enabled - Whether to enable (`true`) or disable (`false`).
   */
  setEnabled(groupId: string, enabled: boolean): void {
    if (enabled) {
      this.enabledIds.add(groupId);
    } else {
      this.enabledIds.delete(groupId);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.enabledIds]));
  }

  /**
   * Returns the GTFS JSON prefixes for all currently enabled groups.
   *
   * @returns Flat array of prefixes (e.g. `["tobus", "toaran"]`).
   */
  getEnabledPrefixes(): string[] {
    return this.groups.filter((g) => this.enabledIds.has(g.id)).flatMap((g) => g.prefixes);
  }
}
