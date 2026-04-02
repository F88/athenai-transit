/**
 * @module LocalStorageUserDataRepository
 *
 * localStorage-backed implementation of {@link UserDataRepository}.
 * All async methods resolve synchronously since localStorage is a
 * synchronous API, but the async interface allows future migration
 * to a Web API backend without changing consumers.
 */

import { addAnchor, removeAnchor, updateAnchor, type AnchorEntry } from '../domain/portal/anchor';
import type { Result } from '../types/app/repository';
import type { UserDataRepository } from './user-data-repository';
import { createLogger } from '../lib/logger';

const ANCHORS_KEY = 'portals';

const logger = createLogger('LocalStorageUserDataRepository');

/**
 * Validates a raw parsed value as an {@link AnchorEntry}.
 */
function isValidAnchorEntry(e: unknown): e is AnchorEntry {
  if (typeof e !== 'object' || e === null) {
    return false;
  }
  const obj = e as Record<string, unknown>;
  return (
    typeof obj.stopId === 'string' &&
    typeof obj.stopName === 'string' &&
    typeof obj.stopLat === 'number' &&
    typeof obj.stopLon === 'number' &&
    Array.isArray(obj.routeTypes) &&
    typeof obj.createdAt === 'number'
  );
}

/**
 * localStorage-backed implementation of {@link UserDataRepository}.
 *
 * Maintains an in-memory copy of anchors for fast reads. Writes are
 * persisted to localStorage immediately. Domain functions from
 * `src/domain/portal/anchor.ts` are used for all mutations.
 */
export class LocalStorageUserDataRepository implements UserDataRepository {
  private anchors: AnchorEntry[];

  constructor() {
    this.anchors = this.loadAnchorsFromStorage();
  }

  // --- Anchors ---

  // eslint-disable-next-line @typescript-eslint/require-await -- localStorage is synchronous; await will be used when migrated to Web API
  async getAnchors(): Promise<Result<AnchorEntry[]>> {
    return { success: true, data: [...this.anchors] };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async addAnchor(entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> {
    const next = addAnchor(this.anchors, entry, Date.now());
    if (next === this.anchors) {
      logger.warn(`addAnchor: duplicate stopId=${entry.stopId}`);
      return { success: false, error: `Duplicate stop: ${entry.stopId}` };
    }
    if (!this.saveAnchorsToStorage(next)) {
      return { success: false, error: 'Failed to persist to storage' };
    }
    this.anchors = next;
    return { success: true, data: next[0] };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async removeAnchor(stopId: string): Promise<Result<void>> {
    const next = removeAnchor(this.anchors, stopId);
    if (next === this.anchors) {
      logger.warn(`removeAnchor: stopId=${stopId} not found`);
      return { success: false, error: `Stop not found: ${stopId}` };
    }
    if (!this.saveAnchorsToStorage(next)) {
      return { success: false, error: 'Failed to persist to storage' };
    }
    this.anchors = next;
    return { success: true, data: undefined };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async updateAnchor(entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> {
    const existing = this.anchors.find((a) => a.stopId === entry.stopId);
    if (!existing) {
      logger.warn(`updateAnchor: stopId=${entry.stopId} not found`);
      return { success: false, error: `Stop not found: ${entry.stopId}` };
    }
    const next = updateAnchor(this.anchors, entry);
    if (next === this.anchors) {
      // Unchanged — the anchor exists and is already in the desired state
      return { success: true, data: existing };
    }
    if (!this.saveAnchorsToStorage(next)) {
      return { success: false, error: 'Failed to persist to storage' };
    }
    this.anchors = next;
    const updated = next.find((a) => a.stopId === entry.stopId)!;
    return { success: true, data: updated };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async batchUpdateAnchors(
    entries: Omit<AnchorEntry, 'createdAt'>[],
  ): Promise<Result<AnchorEntry[]>> {
    let current = this.anchors;
    for (const entry of entries) {
      const next = updateAnchor(current, entry);
      if (next !== current) {
        current = next;
      }
    }
    if (current === this.anchors) {
      // Nothing changed — all entries were unchanged or not found
      return { success: true, data: [...this.anchors] };
    }
    if (!this.saveAnchorsToStorage(current)) {
      return { success: false, error: 'Failed to persist to storage' };
    }
    this.anchors = current;
    return { success: true, data: [...this.anchors] };
  }

  // --- Private ---

  private loadAnchorsFromStorage(): AnchorEntry[] {
    try {
      const raw = localStorage.getItem(ANCHORS_KEY);
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        logger.warn('Stored anchors is not an array, ignoring');
        return [];
      }
      const valid = parsed.filter(isValidAnchorEntry);
      if (valid.length < parsed.length) {
        logger.warn(
          `Dropped ${parsed.length - valid.length} invalid anchor entries from localStorage`,
        );
        // Re-save immediately so invalid entries are not re-read on next startup
        this.saveAnchorsToStorage(valid);
      }
      return valid;
    } catch (e) {
      logger.warn('Failed to load anchors from localStorage', e);
      return [];
    }
  }

  private saveAnchorsToStorage(anchors: AnchorEntry[]): boolean {
    try {
      localStorage.setItem(ANCHORS_KEY, JSON.stringify(anchors));
      return true;
    } catch (e) {
      logger.error('Failed to save anchors to localStorage', e);
      return false;
    }
  }
}
