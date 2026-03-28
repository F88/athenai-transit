import { useCallback, useRef, useState } from 'react';
import {
  addAnchor,
  isAnchor,
  removeAnchor,
  updateAnchor,
  type AnchorEntry,
} from '../domain/portal/anchor';
import type { Result } from '../types/app/repository';
import { createLogger } from '../utils/logger';

const STORAGE_KEY = 'portals';
const logger = createLogger('useAnchors');

/**
 * Persists anchors to localStorage.
 *
 * @param anchors - Anchor entries to save.
 * @returns true if saved successfully, false if storage is unavailable.
 */
function saveAnchors(anchors: AnchorEntry[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(anchors));
    return true;
  } catch (e) {
    logger.error('Failed to save anchors to localStorage', e);
    return false;
  }
}

/**
 * Loads anchors from localStorage.
 *
 * Validates that each entry has a string stopId. Invalid entries
 * are silently filtered out.
 *
 * @returns Stored anchor entries, or empty array on failure.
 */
function loadAnchors(): AnchorEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown[];
    const valid = parsed.filter((e): e is AnchorEntry => {
      if (typeof e !== 'object' || e === null) {
        return false;
      }
      const obj = e as Record<string, unknown>;
      return (
        typeof obj.stopId === 'string' &&
        typeof obj.stopLat === 'number' &&
        typeof obj.stopLon === 'number'
      );
    });
    if (valid.length < parsed.length) {
      logger.warn(`Dropped ${parsed.length - valid.length} invalid entries from localStorage`);
    }
    return valid;
  } catch (e) {
    logger.warn('Failed to load anchors from localStorage', e);
    return [];
  }
}

/**
 * Return type for the useAnchors hook.
 */
export interface UseAnchorsReturn {
  /** Anchor entries, most recently added first. */
  anchors: AnchorEntry[];
  /** Add a stop to anchors. Returns the created entry on success, or error if duplicate. */
  addStop: (entry: Omit<AnchorEntry, 'createdAt'>) => Promise<Result<AnchorEntry>>;
  /** Remove a stop from anchors. Returns void on success, or error if not found. */
  removeStop: (stopId: string) => Promise<Result<void>>;
  /** Update an existing anchor's mutable fields. Returns the updated entry on success, or error if not found or unchanged. */
  updateStop: (update: Omit<AnchorEntry, 'createdAt'>) => Promise<Result<AnchorEntry>>;
  /** Check if a stop is currently in the anchor list. */
  isStopAnchor: (stopId: string) => boolean;
}

/**
 * Manages a list of anchor (bookmarked) stops with localStorage persistence.
 *
 * Mutation methods are async and return {@link Result} to allow future
 * migration to a Web API backend without changing the caller interface.
 *
 * @returns Anchor state and mutation functions.
 */
export function useAnchors(): UseAnchorsReturn {
  const [anchors, setAnchors] = useState<AnchorEntry[]>(loadAnchors);
  // Ref to communicate the result out of the setState updater.
  const resultRef = useRef<Result<AnchorEntry> | Result<void>>({ success: false, error: '' });

  const addStop = useCallback(
    async (entry: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> => {
      resultRef.current = { success: false, error: `Duplicate stop: ${entry.stopId}` };
      setAnchors((prev) => {
        const next = addAnchor(prev, entry, Date.now());
        if (next === prev) {
          logger.warn(`addStop: duplicate stopId=${entry.stopId}`);
          return prev;
        }
        if (!saveAnchors(next)) {
          resultRef.current = { success: false, error: 'Failed to persist to storage' };
          return prev;
        }
        resultRef.current = { success: true, data: next[0] };
        return next;
      });
      return resultRef.current as Result<AnchorEntry>;
    },
    [],
  );

  const removeStop = useCallback(async (stopId: string): Promise<Result<void>> => {
    resultRef.current = { success: false, error: `Stop not found: ${stopId}` };
    setAnchors((prev) => {
      const next = removeAnchor(prev, stopId);
      if (next === prev) {
        logger.warn(`removeStop: stopId=${stopId} not found`);
        return prev;
      }
      if (!saveAnchors(next)) {
        resultRef.current = { success: false, error: 'Failed to persist to storage' };
        return prev;
      }
      resultRef.current = { success: true, data: undefined };
      return next;
    });
    return resultRef.current as Result<void>;
  }, []);

  const updateStop = useCallback(
    async (update: Omit<AnchorEntry, 'createdAt'>): Promise<Result<AnchorEntry>> => {
      resultRef.current = {
        success: false,
        error: `Stop not found or unchanged: ${update.stopId}`,
      };
      setAnchors((prev) => {
        const next = updateAnchor(prev, update);
        if (next === prev) {
          logger.warn(`updateStop: stopId=${update.stopId} not found or unchanged`);
          return prev;
        }
        if (!saveAnchors(next)) {
          resultRef.current = { success: false, error: 'Failed to persist to storage' };
          return prev;
        }
        const updated = next.find((a) => a.stopId === update.stopId)!;
        resultRef.current = { success: true, data: updated };
        return next;
      });
      return resultRef.current as Result<AnchorEntry>;
    },
    [],
  );

  const isStopAnchor = useCallback((stopId: string) => isAnchor(anchors, stopId), [anchors]);

  return { anchors, addStop, removeStop, updateStop, isStopAnchor };
}
