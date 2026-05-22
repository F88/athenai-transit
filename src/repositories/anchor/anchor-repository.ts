import type { AnchorEntry } from '../../domain/portal/anchor';
import type { Result } from '../../types/app/repository';

/**
 * Repository interface for persisted anchor data.
 *
 * Implementations own storage access, validation, migration, and
 * persistence details. Callers work with validated {@link AnchorEntry}
 * values only.
 */
export interface AnchorRepository {
  /**
   * Returns all stored anchor entries.
   *
   * Invalid entries in the underlying storage are silently filtered out.
   * The returned array preserves storage order (most recently added first).
   */
  getAnchors(): Promise<Result<AnchorEntry[]>>;

  /**
   * Adds a new anchor entry.
   */
  addAnchor(entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>>;

  /**
   * Removes an anchor entry by stopId.
   */
  removeAnchor(stopId: string): Promise<Result<void>>;

  /**
   * Updates an existing anchor entry's mutable fields.
   *
   * Matches by stopId. The `createdAt` field is always preserved.
   * If `portal` is undefined in the update, the existing value is preserved.
   */
  updateAnchor(entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>>;

  /**
   * Updates multiple anchor entries in a single operation.
   */
  batchUpdateAnchors(entries: Omit<AnchorEntry, 'createdAt'>[]): Promise<Result<AnchorEntry[]>>;
}
