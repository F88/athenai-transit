import settings from '../../config/data-source-settings';
import { createLogger } from '../../lib/logger';

const STORAGE_KEY = 'enabled-sources';
const logger = createLogger('DataSourceSelectionStorage');

/**
 * Load the persisted user data-source selection from `localStorage`.
 *
 * Returns `null` when the user has no preference recorded (or when the
 * recorded value is unrecoverable). Returns a `Set` (possibly empty)
 * when the user has explicitly set a preference.
 *
 * Cases:
 *
 * - Missing key → `null` (defaults will be used by callers)
 * - Empty array `'[]'` → empty `Set` (user-explicit empty, β semantic)
 * - Valid array with some stale IDs (not in config) → cleaned `Set` +
 *   storage write-back so the stored value matches the returned Set
 * - Array whose elements all fail to resolve (config rename → all
 *   stale, or non-string elements like `[123]` / `[null]`, or a mix)
 *   → `removeItem` + `null`. An empty `Set` is only returned for the
 *   genuine user-explicit `'[]'`; any other "input had stuff but
 *   nothing valid came out" path is treated as unrecoverable.
 * - Non-array / corrupt JSON → `removeItem` + `null` (self-repair)
 * - `localStorage.getItem` throws (e.g. sandboxed iframe) → `null`, silent
 *
 * The cleanup write-back and self-repair happen as side effects inside
 * this function; callers receive only the resolved value. Callers that
 * need a default Set when this returns `null` (hook init / DSM
 * constructor fallback) handle that themselves — keeping this utility
 * free of `getDefaultEnabledIds` preserves the responsibility split.
 *
 * @returns The persisted selection, or `null` when none is recorded.
 */
export function loadEnabledGroupIdsFromStorage(): Set<string> | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn(`Corrupt JSON in '${STORAGE_KEY}'; clearing.`);
    safeRemove();
    return null;
  }

  if (!Array.isArray(parsed)) {
    logger.warn(`Non-array value in '${STORAGE_KEY}'; clearing.`);
    safeRemove();
    return null;
  }

  const stringIds = parsed.filter((x): x is string => typeof x === 'string');
  const knownIds = new Set(settings.map((g) => g.id));
  const cleaned = new Set<string>();
  for (const id of stringIds) {
    if (knownIds.has(id)) {
      cleaned.add(id);
    }
  }

  // Unrecoverable-array edge: the input had elements but filtering
  // yielded an empty Set. This covers (a) all-stale IDs after a config
  // rename, (b) all-non-string elements like `[123]` or `[null]`, and
  // (c) any mix of stale and non-string. In every variant the stored
  // value is meaningless, so treat it as "no preference" and clear
  // storage. A genuine empty `'[]'` is preserved (user-explicit empty,
  // β) because `parsed.length === 0` short-circuits before this branch.
  if (parsed.length > 0 && cleaned.size === 0) {
    logger.info(
      `Stored value in '${STORAGE_KEY}' contains no resolvable source group IDs (${parsed.length.toString()} elements); clearing.`,
    );
    safeRemove();
    return null;
  }

  // Cleanup write-back: persist the cleaned set so storage reflects what
  // we returned. The pruned count covers three reasons (non-string
  // elements filtered, stale IDs not in config, and duplicate string
  // IDs collapsed by the Set), so the log enumerates all three to stay
  // accurate regardless of which one(s) actually applied this run.
  if (cleaned.size !== stringIds.length || stringIds.length !== parsed.length) {
    logger.info(
      `Pruned ${(parsed.length - cleaned.size).toString()} entries (invalid, stale, or duplicate) from '${STORAGE_KEY}'.`,
    );
    safeWrite(cleaned);
  }

  return cleaned;
}

/**
 * Persist the user data-source selection to `localStorage`.
 *
 * - Non-empty Set → JSON-encoded array
 * - Empty Set → JSON-encoded `'[]'` (user-explicit empty, β)
 *
 * Callers wanting to return to "no preference" (defaults on next load)
 * use {@link clearStoredEnabledGroupIds} — saving an empty Set keeps
 * the explicit-empty state, while clear returns to `null` on next load.
 *
 * @param ids - Group IDs to persist.
 */
export function saveEnabledGroupIdsToStorage(ids: ReadonlySet<string>): void {
  safeWrite(ids);
}

/**
 * Remove the persisted user data-source selection from `localStorage`.
 *
 * Used by `resetToDefaults` — clears the preference so the next load
 * falls back to defaults.
 */
export function clearStoredEnabledGroupIds(): void {
  safeRemove();
}

function safeWrite(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage full or unavailable — silently ignore. The hook keeps the
    // in-memory state up to date even when persistence fails.
  }
}

function safeRemove(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore (same rationale as safeWrite)
  }
}
