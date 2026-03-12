import settings from '../config/data-source-settings.json';

/**
 * A group of related GTFS data sources managed as a single toggle unit.
 *
 * For example, the "toei" group may contain both bus and train prefixes.
 */
export interface SourceGroup {
  /** Unique identifier for this source group. */
  id: string;
  /** Japanese display name. */
  name_ja: string;
  /** Category label (e.g. "bus", "train"). */
  category: string;
  /** GTFS JSON prefixes belonging to this group. */
  prefixes: string[];
}

const STORAGE_KEY = 'gtfs-enabled-sources';

/**
 * Manages which GTFS data sources are enabled/disabled.
 *
 * Persists user preferences to `localStorage` and provides
 * the list of active GTFS prefixes for {@link GtfsRepository} initialization.
 */
export class DataSourceManager {
  private groups: SourceGroup[];
  private enabledIds: Set<string>;

  /** Creates a new manager, restoring enabled state from localStorage. */
  constructor() {
    this.groups = settings as SourceGroup[];
    const allIds = new Set(this.groups.map((g) => g.id));
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.enabledIds = new Set(JSON.parse(stored) as string[]);
      } else {
        this.enabledIds = allIds;
      }
    } catch {
      this.enabledIds = allIds;
    }
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
