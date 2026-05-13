import settings from './data-source-settings';
import { getSourcesParam } from '../lib/query-params';
import { createLogger } from '../lib/logger';
import {
  findUnknownPrefixesInSourcesParam,
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
    // Surface unknown prefixes that were silently dropped. Without this,
    // a typo or removed source in the URL leaves the user with no signal
    // about why their requested sources are missing.
    const unknownPrefixes = findUnknownPrefixesInSourcesParam(groups, sourcesParam);
    if (unknownPrefixes.length > 0) {
      logger.warn(`Ignored unknown prefixes in ?sources= param: [${unknownPrefixes.join(', ')}]`);
    }
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
 * Manages which source groups are enabled/disabled.
 *
 * The manager owns the SourceGroup-level state — it tracks which groups
 * are currently active and persists user preferences to `localStorage`.
 * It deliberately does NOT decide the final fetch-target prefix list
 * when a `?sources=<prefixes>` URL is in play; that resolution lives in
 * {@link import('../domain/datasource/resolve-fetch-data-sources').resolveFetchDataSources}
 * so the original prefix-level URL contract is not subsumed by the
 * (newer) group abstraction.
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
   * 3. Default — only groups with `systemEnabledByDefault: true`
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
   * Returns the GTFS prefixes implied by the currently enabled group
   * set (deduped).
   *
   * This is the *group-driven* view of the active prefixes. Callers that
   * need the final fetch target (and therefore have to honour the
   * prefix-level `?sources=<prefixes>` URL contract from PRD.md:118)
   * should pass this through
   * {@link import('../domain/datasource/resolve-fetch-data-sources').resolveFetchDataSources}
   * instead of using it directly.
   *
   * @returns Flat array of prefixes from all enabled groups.
   */
  getEnabledPrefixes(): string[] {
    return dedupePrefixes(getEnabledPrefixesFromGroups(this.groups, this.enabledIds));
  }
}
