import {
  STOP_HISTORY_STORAGE_VERSION,
  type StopHistoryEntry,
  type StopHistorySnapshot,
  type StoredStopHistory,
} from '../../domain/transit/stop-history';
import { WebStorageItem } from '../../lib/web-storage-item';
import { createLogger } from '../../lib/logger';
import type { Result } from '../../types/app/repository';
import type { AppRouteTypeValue } from '../../types/app/transit';
import type { StopSelectionRepository } from './stop-selection-repository';

const STORAGE_KEY = 'stop-history';

const logger = createLogger('LocalStorageStopSelectionRepository');

function normalizeRouteTypes(value: unknown): AppRouteTypeValue[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((routeType): routeType is AppRouteTypeValue => typeof routeType === 'number');
}

function normalizeSelectedAt(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function normalizeSnapshotName(value: unknown, stopId: string): string {
  return typeof value === 'string' && value.length > 0 ? value : stopId;
}

function normalizeCoordinate(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function normalizeSnapshot(
  value: unknown,
  stopId: string,
  fallbackRouteTypes?: AppRouteTypeValue[],
): StopHistorySnapshot | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const routeTypes =
    normalizeRouteTypes(obj.routeTypes) ??
    (fallbackRouteTypes !== undefined ? [...fallbackRouteTypes] : null);
  if (routeTypes === null) {
    return null;
  }

  return {
    name: normalizeSnapshotName(obj.name, stopId),
    lat: normalizeCoordinate(obj.lat),
    lon: normalizeCoordinate(obj.lon),
    routeTypes,
  };
}

function normalizeStoredEntry(entry: unknown): StopHistoryEntry | null {
  if (typeof entry !== 'object' || entry === null) {
    return null;
  }

  const obj = entry as Record<string, unknown>;
  if (typeof obj.stopId !== 'string') {
    return null;
  }

  const routeTypes = normalizeRouteTypes(obj.routeTypes) ?? undefined;
  const snapshot = normalizeSnapshot(obj.snapshot, obj.stopId, routeTypes);
  if (snapshot !== null) {
    return {
      stopId: obj.stopId,
      snapshot,
      selectedAt: normalizeSelectedAt(obj.selectedAt),
    };
  }

  if (routeTypes === undefined) {
    return null;
  }

  return {
    stopId: obj.stopId,
    snapshot: {
      name: normalizeSnapshotName(obj.fallbackName, obj.stopId),
      lat: normalizeCoordinate(obj.lat ?? obj.stopLat),
      lon: normalizeCoordinate(obj.lon ?? obj.stopLon),
      routeTypes,
    },
    selectedAt: normalizeSelectedAt(obj.selectedAt),
  };
}

function migrateLegacyEntry(entry: Record<string, unknown>): StopHistoryEntry | null {
  const normalized = normalizeStoredEntry(entry);
  if (normalized !== null) {
    return normalized;
  }

  const stopWithMeta = entry.stopWithMeta;
  if (
    typeof stopWithMeta !== 'object' ||
    stopWithMeta === null ||
    typeof (stopWithMeta as Record<string, unknown>).stop !== 'object' ||
    (stopWithMeta as Record<string, unknown>).stop === null ||
    typeof ((stopWithMeta as Record<string, unknown>).stop as Record<string, unknown>).stop_id !==
      'string'
  ) {
    return null;
  }

  const stop = (stopWithMeta as Record<string, unknown>).stop as Record<string, unknown>;

  if ('routeTypes' in entry && Array.isArray(entry.routeTypes)) {
    const routeTypes = normalizeRouteTypes(entry.routeTypes);
    if (routeTypes === null) {
      return null;
    }

    return {
      stopId: stop.stop_id as string,
      snapshot: {
        name: normalizeSnapshotName(stop.stop_name, stop.stop_id as string),
        lat: normalizeCoordinate(stop.stop_lat),
        lon: normalizeCoordinate(stop.stop_lon),
        routeTypes,
      },
      selectedAt: normalizeSelectedAt(entry.selectedAt),
    };
  }

  const legacyType =
    'routeType' in entry && typeof entry.routeType === 'number'
      ? (entry.routeType as AppRouteTypeValue)
      : (3 as const);

  return {
    stopId: stop.stop_id as string,
    snapshot: {
      name: normalizeSnapshotName(stop.stop_name, stop.stop_id as string),
      lat: normalizeCoordinate(stop.stop_lat),
      lon: normalizeCoordinate(stop.stop_lon),
      routeTypes: [legacyType],
    },
    selectedAt: normalizeSelectedAt(entry.selectedAt),
  };
}

/**
 * localStorage-backed implementation of {@link StopSelectionRepository}.
 *
 * Handles schema migration from legacy stop-history payloads and
 * rewrites repaired data immediately so later app loads read only the
 * current schema.
 */
export class LocalStorageStopSelectionRepository implements StopSelectionRepository {
  private readonly storageItem: WebStorageItem;

  constructor(storage: Storage | undefined = globalThis.localStorage) {
    this.storageItem = new WebStorageItem(STORAGE_KEY, storage);
  }

  async getHistory(): Promise<Result<StopHistoryEntry[]>> {
    try {
      const rawResult = this.storageItem.read();
      if (!rawResult.success) {
        logger.warn(rawResult.error);
        return { success: false, error: 'Failed to load stop history from storage' };
      }

      const raw = rawResult.data;
      if (!raw) {
        return { success: true, data: [] };
      }

      const parsed = JSON.parse(raw) as unknown;
      const rawEntries = Array.isArray(parsed)
        ? parsed
        : typeof parsed === 'object' &&
            parsed !== null &&
            Array.isArray((parsed as Record<string, unknown>).entries)
          ? ((parsed as Record<string, unknown>).entries as unknown[])
          : null;

      if (rawEntries === null) {
        logger.warn('Stored stop history has an unsupported schema, clearing');
        const clearResult = await this.clearHistory();
        if (!clearResult.success) {
          return clearResult;
        }
        return { success: true, data: [] };
      }

      const entries = rawEntries
        .map((entry) =>
          typeof entry === 'object' && entry !== null
            ? migrateLegacyEntry(entry as Record<string, unknown>)
            : null,
        )
        .filter((entry): entry is StopHistoryEntry => entry !== null);

      if (entries.length !== rawEntries.length || !isCurrentStoredShape(parsed)) {
        const saveResult = await this.saveHistory(entries);
        if (!saveResult.success) {
          return saveResult;
        }
      }

      return { success: true, data: entries };
    } catch (error) {
      logger.warn('Failed to load stop history from localStorage', error);
      return { success: false, error: 'Failed to load stop history from storage' };
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- localStorage is synchronous; await keeps the repository contract swappable
  async saveHistory(entries: StopHistoryEntry[]): Promise<Result<void>> {
    try {
      const stored: StoredStopHistory = {
        version: STOP_HISTORY_STORAGE_VERSION,
        entries,
      };
      const writeResult = this.storageItem.write(JSON.stringify(stored));
      if (!writeResult.success) {
        logger.error(writeResult.error);
        return { success: false, error: 'Failed to persist stop history to storage' };
      }
      return writeResult;
    } catch (error) {
      logger.error('Failed to save stop history to localStorage', error);
      return { success: false, error: 'Failed to persist stop history to storage' };
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- localStorage is synchronous; await keeps the repository contract swappable
  async clearHistory(): Promise<Result<void>> {
    try {
      const removeResult = this.storageItem.remove();
      if (!removeResult.success) {
        logger.error(removeResult.error);
        return { success: false, error: 'Failed to clear stop history from storage' };
      }
      return removeResult;
    } catch (error) {
      logger.error('Failed to clear stop history from localStorage', error);
      return { success: false, error: 'Failed to clear stop history from storage' };
    }
  }
}

function isCurrentStoredShape(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).version === STOP_HISTORY_STORAGE_VERSION &&
    Array.isArray((value as Record<string, unknown>).entries)
  );
}
