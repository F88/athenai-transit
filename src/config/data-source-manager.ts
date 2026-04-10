import settings from './data-source-settings';
import { getSourcesParam } from '../lib/query-params';
import { createLogger } from '../lib/logger';
import {
  getDefaultEnabledIds,
  getEnabledIdsFromSourcesParam,
  getEnabledPrefixesFromGroups,
  parseStoredEnabledIds,
} from '../domain/datasource/data-source-selection';
import type { SourceGroup } from '../types/app/source-group';

const logger = createLogger('DataSourceManager');

function dedupePrefixes(prefixes: string[]): string[] {
  return [...new Set(prefixes)];
}

function resolveEnabledIdsFromQueryParams(groups: SourceGroup[]): Set<string> | null {
  const sourcesParam = getSourcesParam();
  if (!sourcesParam) {
    return null;
  }

  if (sourcesParam === 'all') {
    logger.info('Data sources from query params: all');
  } else {
    logger.info(`Data sources from query params: ${sourcesParam}`);
  }

  return getEnabledIdsFromSourcesParam(groups, sourcesParam);
}

function resolveEnabledIdsFromStorage(): Set<string> | null {
  return parseStoredEnabledIds(localStorage.getItem(STORAGE_KEY));
}

function resolveInitialEnabledIds(groups: SourceGroup[]): Set<string> {
  const enabledIdsFromQueryParams = resolveEnabledIdsFromQueryParams(groups);
  if (enabledIdsFromQueryParams) {
    return enabledIdsFromQueryParams;
  }

  try {
    const enabledIdsFromStorage = resolveEnabledIdsFromStorage();
    if (enabledIdsFromStorage) {
      return enabledIdsFromStorage;
    }
  } catch {
    // fall through to default
  }

  return getDefaultEnabledIds(groups);
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
    this.enabledIds = resolveInitialEnabledIds(this.groups);
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
    return dedupePrefixes(getEnabledPrefixesFromGroups(this.groups, this.enabledIds));
  }
}
