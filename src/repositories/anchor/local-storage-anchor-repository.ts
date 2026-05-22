import {
  addAnchor,
  removeAnchor,
  updateAnchor,
  type AnchorEntry,
} from '../../domain/portal/anchor';
import { createLogger } from '../../lib/logger';
import type { Result } from '../../types/app/repository';
import type { StopReferenceSnapshot } from '../../types/app/stop-reference-snapshot';
import type { AppRouteTypeValue } from '../../types/app/transit';
import type { AnchorRepository } from './anchor-repository';

const ANCHORS_KEY = 'portals';

const logger = createLogger('LocalStorageAnchorRepository');

function normalizeStopId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeRouteTypes(value: unknown): AppRouteTypeValue[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const routeTypes = value.filter(
    (routeType): routeType is AppRouteTypeValue => typeof routeType === 'number',
  );
  return routeTypes.length > 0 ? routeTypes : null;
}

function normalizeCoordinate(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))];
}

function normalizeSnapshotName(value: unknown, stopId: string): string {
  return typeof value === 'string' && value.length > 0 ? value : stopId;
}

function normalizePlatformCode(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizePortal(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeSnapshot(
  value: unknown,
  fallbackStopId?: string,
  fallbackRouteTypes?: readonly AppRouteTypeValue[],
  fallbackName?: string,
  fallbackLat?: number | null,
  fallbackLon?: number | null,
  fallbackAgencyNames: readonly string[] = [],
  fallbackPlatformCode?: string,
): StopReferenceSnapshot | null {
  const obj = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const stopId = normalizeStopId(obj.stopId) ?? fallbackStopId ?? null;
  if (stopId === null) {
    return null;
  }

  const routeTypes = normalizeRouteTypes(obj.routeTypes) ?? [...(fallbackRouteTypes ?? [])];
  if (routeTypes.length === 0) {
    return null;
  }

  const lat = normalizeCoordinate(obj.lat) ?? fallbackLat ?? null;
  const lon = normalizeCoordinate(obj.lon) ?? fallbackLon ?? null;
  if (lat === null || lon === null) {
    return null;
  }

  const agencyNames = normalizeStringArray(obj.agencyNames);

  return {
    stopId,
    name: normalizeSnapshotName(obj.name, fallbackName ?? stopId),
    lat,
    lon,
    routeTypes,
    agencyNames: agencyNames.length ? agencyNames : [...fallbackAgencyNames],
    platformCode: normalizePlatformCode(obj.platformCode) ?? fallbackPlatformCode,
  };
}

function normalizeAnchorEntry(value: unknown): AnchorEntry | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const stopId = normalizeStopId(obj.stopId) ?? undefined;
  const routeTypes = normalizeRouteTypes(obj.routeTypes) ?? undefined;
  const flatName = typeof obj.stopName === 'string' ? obj.stopName : undefined;
  const flatLat = normalizeCoordinate(obj.stopLat);
  const flatLon = normalizeCoordinate(obj.stopLon);
  const snapshot = normalizeSnapshot(
    obj.snapshot,
    stopId,
    routeTypes,
    flatName,
    flatLat,
    flatLon,
    normalizeStringArray(obj.agencyNames),
    normalizePlatformCode(obj.platformCode),
  );

  if (snapshot === null || typeof obj.createdAt !== 'number') {
    return null;
  }

  return {
    snapshot,
    createdAt: obj.createdAt,
    portal: normalizePortal(obj.portal),
  };
}

/**
 * localStorage-backed implementation of {@link AnchorRepository}.
 *
 * Maintains an in-memory copy of anchors for fast reads. Writes are
 * persisted to localStorage immediately. Domain functions from
 * `src/domain/portal/anchor.ts` are used for all mutations.
 */
export class LocalStorageAnchorRepository implements AnchorRepository {
  private anchors: AnchorEntry[];

  constructor() {
    this.anchors = this.loadAnchorsFromStorage();
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- localStorage is synchronous; await will be used when migrated to Web API
  async getAnchors(): Promise<Result<AnchorEntry[]>> {
    return { success: true, data: [...this.anchors] };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async addAnchor(entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> {
    const next = addAnchor(this.anchors, entry, Date.now());
    if (next === this.anchors) {
      logger.warn(`addAnchor: duplicate stopId=${entry.snapshot.stopId}`);
      return { success: false, error: `Duplicate stop: ${entry.snapshot.stopId}` };
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
    const existing = this.anchors.find(
      (anchor) => anchor.snapshot.stopId === entry.snapshot.stopId,
    );
    if (!existing) {
      logger.warn(`updateAnchor: stopId=${entry.snapshot.stopId} not found`);
      return { success: false, error: `Stop not found: ${entry.snapshot.stopId}` };
    }
    const next = updateAnchor(this.anchors, entry);
    if (next === this.anchors) {
      return { success: true, data: existing };
    }
    if (!this.saveAnchorsToStorage(next)) {
      return { success: false, error: 'Failed to persist to storage' };
    }
    this.anchors = next;
    const updated = next.find((anchor) => anchor.snapshot.stopId === entry.snapshot.stopId)!;
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
      return { success: true, data: [...this.anchors] };
    }
    if (!this.saveAnchorsToStorage(current)) {
      return { success: false, error: 'Failed to persist to storage' };
    }
    this.anchors = current;
    return { success: true, data: [...this.anchors] };
  }

  private loadAnchorsFromStorage(): AnchorEntry[] {
    try {
      const raw = localStorage.getItem(ANCHORS_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        logger.warn('Stored anchors is not an array, ignoring');
        return [];
      }

      const valid = parsed
        .map((entry) => normalizeAnchorEntry(entry))
        .filter((entry): entry is AnchorEntry => entry !== null);

      if (valid.length !== parsed.length) {
        logger.warn(
          `Dropped ${parsed.length - valid.length} invalid anchor entries from localStorage`,
        );
      }

      if (valid.length !== parsed.length || JSON.stringify(parsed) !== JSON.stringify(valid)) {
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
