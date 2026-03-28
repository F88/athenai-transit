/**
 * @module UserDataRepository
 *
 * Defines the abstract data-access contract for user-specific data
 * (anchors, settings, etc.). UI components depend solely on this
 * interface, keeping the storage layer swappable (localStorage, Web API, etc.).
 *
 * Follows the same repository pattern as {@link TransitRepository}.
 */

import type { AnchorEntry } from '../domain/portal/anchor';
import type { Result } from '../types/app/repository';

/**
 * Repository interface for managing user-specific data.
 *
 * All methods are async to support both synchronous storage (localStorage)
 * and asynchronous backends (Web API). Implementations MUST return
 * {@link Result} to communicate success/failure uniformly.
 *
 * ### Anchor methods
 *
 * Anchors are bookmarked stops that persist across sessions. Each anchor
 * is identified by its GTFS stop_id. The optional `portal` field groups
 * anchors into named collections.
 */
export interface UserDataRepository {
  // --- Anchors ---

  /**
   * Returns all stored anchor entries.
   *
   * Invalid entries in the underlying storage are silently filtered out.
   * The returned array preserves storage order (most recently added first).
   *
   * @returns All valid anchor entries.
   */
  getAnchors(): Promise<Result<AnchorEntry[]>>;

  /**
   * Adds a new anchor entry.
   *
   * If an entry with the same stopId already exists, the operation fails
   * with an error result. The `createdAt` field is set by the implementation.
   *
   * @param entry - Anchor fields excluding createdAt.
   * @returns The created entry on success, or error if duplicate.
   */
  addAnchor(entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>>;

  /**
   * Removes an anchor entry by stopId.
   *
   * @param stopId - The stop ID to remove.
   * @returns Void on success, or error if not found.
   */
  removeAnchor(stopId: string): Promise<Result<void>>;

  /**
   * Updates an existing anchor entry's mutable fields.
   *
   * Matches by stopId. The `createdAt` field is always preserved.
   * If `portal` is undefined in the update, the existing value is preserved.
   *
   * Returns success even when the entry is unchanged (idempotent).
   * Only returns error when the stopId is not found.
   *
   * @param entry - Fields to update. stopId is used to find the entry.
   * @returns The entry (updated or existing) on success, or error if not found.
   */
  updateAnchor(entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>>;
}
