import settings from './data-source-settings';
import { getSourcesParam } from '../lib/query-params';
import { createLogger } from '../lib/logger';
import {
  findUnknownPrefixesInSourcesParam,
  getDefaultEnabledIds,
  getEnabledIdsFromSourcesParam,
  getEnabledPrefixesFromGroups,
} from '../domain/datasource/data-source-selection';
import type { SourceGroup } from '../types/app/source-group';

const logger = createLogger('DataSourceManager');

function dedupePrefixes(prefixes: string[]): string[] {
  return [...new Set(prefixes)];
}

function resolveEnabledIdsFromQueryParams(groups: SourceGroup[]): Set<string> | null {
  const sourcesParam = getSourcesParam();
  // Strict null check — DO NOT use `!sourcesParam`. `?sources=` (empty
  // value) reaches us as `''` and MUST be treated as a force-load-empty
  // override (returning a non-null empty Set below), not collapsed with
  // "param absent" (`null`). The load layer in
  // `resolveFetchDataSources` already treats `''` as force-empty, so
  // DSM must agree or the UI / load layers disagree.
  if (sourcesParam === null) {
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

/**
 * Drop any stored IDs whose group is `systemEnabledByDefault: false`.
 *
 * The system-disabled flag is an app-level retirement / hide mechanism
 * for sources the maintainer no longer wants loaded by default. A user's
 * stored selection (from before the maintainer flipped the flag) must
 * not resurrect those sources on a normal boot — otherwise retiring a
 * source becomes a no-op for returning users with stale localStorage.
 *
 * The URL `?sources=` override path is intentionally NOT routed through
 * this filter — it remains the operator/debug escape hatch for
 * force-loading any group, including system-disabled ones.
 */
function filterStoredEnabledIdsBySystemGate(
  groups: readonly SourceGroup[],
  ids: Set<string>,
): Set<string> {
  const systemEnabledGroupIds = new Set(
    groups.filter((g) => g.systemEnabledByDefault).map((g) => g.id),
  );
  const filtered = new Set<string>();
  for (const id of ids) {
    if (systemEnabledGroupIds.has(id)) {
      filtered.add(id);
    }
  }
  return filtered;
}

function resolveInitialEnabledIds(
  groups: SourceGroup[],
  storedEnabledIds: Set<string> | null,
): Set<string> {
  // Strict null checks — an empty `Set` is a *valid* user-explicit value
  // ("nothing enabled", β semantic). Using truthy checks (`if (set)` is
  // always true for Sets, but `if (enabledIdsFromQueryParams)` could
  // mislead a future reader). Keep `=== null` to make the contract
  // obvious: only `null` falls through.
  const enabledIdsFromQueryParams = resolveEnabledIdsFromQueryParams(groups);
  if (enabledIdsFromQueryParams !== null) {
    // URL override deliberately bypasses the system gate — see
    // `filterStoredEnabledIdsBySystemGate` for the rationale.
    return enabledIdsFromQueryParams;
  }

  if (storedEnabledIds !== null) {
    return filterStoredEnabledIdsBySystemGate(groups, storedEnabledIds);
  }

  return getDefaultEnabledIds(groups);
}

/**
 * Manages which source groups are enabled/disabled.
 *
 * The manager owns the SourceGroup-level state — it tracks which groups
 * are currently active. localStorage I/O lives in the
 * {@link import('../domain/datasource/data-source-selection-storage')}
 * utility; this class only consumes the **already-parsed** value at
 * construction time via the `storedEnabledIds` constructor parameter.
 *
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
   * 1. URL `?sources=prefix1,prefix2` or `?sources=all` — transient
   *    override (localStorage not consulted; bypasses the system gate
   *    so debug/operator URLs can force-load system-disabled groups).
   * 2. `storedEnabledIds` if provided — the caller's parsed
   *    `localStorage` snapshot, **filtered by `systemEnabledByDefault`**
   *    so a group retired at the config level cannot be resurrected by
   *    a stale localStorage entry.
   * 3. Default — only groups with `userEnabledByDefault: true`.
   *
   * @param storedEnabledIds - The user's persisted preference (typically
   *   from
   *   {@link import('../domain/datasource/data-source-selection-storage').loadEnabledGroupIdsFromStorage}),
   *   or `null` when no preference is recorded. An empty `Set` is
   *   treated as a user-explicit "nothing enabled" choice.
   */
  constructor(storedEnabledIds: Set<string> | null) {
    this.groups = settings;
    this.enabledIds = resolveInitialEnabledIds(this.groups, storedEnabledIds);
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
