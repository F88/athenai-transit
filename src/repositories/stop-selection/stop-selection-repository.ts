import type { StopHistoryEntry } from '../../domain/transit/stop-history';
import type { Result } from '../../types/app/repository';

/**
 * Repository interface for persisted stop-selection history.
 *
 * Implementations own storage access, validation, migration, and
 * persistence details. Callers work with validated
 * {@link StopHistoryEntry} values only.
 */
export interface StopSelectionRepository {
  /**
   * Loads the persisted stop-selection history.
   *
   * Implementations may self-heal unsupported or partially invalid
   * stored data before returning.
   */
  getHistory(): Promise<Result<StopHistoryEntry[]>>;

  /**
   * Persists the full stop-selection history snapshot.
   */
  saveHistory(entries: StopHistoryEntry[]): Promise<Result<void>>;

  /**
   * Clears all persisted stop-selection history.
   */
  clearHistory(): Promise<Result<void>>;
}
