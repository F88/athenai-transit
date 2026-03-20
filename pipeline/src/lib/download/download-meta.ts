/**
 * Download metadata recording and retrieval.
 *
 * Records the result of each download job (GTFS ZIP or ODPT JSON)
 * to a per-source JSON file under `pipeline/workspace/state/download-meta/`.
 * Both success and failure are recorded for operational visibility.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ensureDir } from '../pipeline-utils';

import { STATE_DIR } from '../paths';

const META_DIR = join(STATE_DIR, 'download-meta');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata for a single extracted file. */
export interface ExtractedFileInfo {
  name: string;
  size: number;
}

/** Feed info extracted from GTFS feed_info.txt. */
export interface FeedInfoMeta {
  publisherName: string;
  publisherUrl: string;
  lang: string;
  startDate: string;
  endDate: string;
  version: string;
}

/** Common fields for all download results. */
interface DownloadMetaBase {
  /** Source definition name (e.g. "kanto-bus", "yurikamome-station"). */
  sourceName: string;
  /** Download type. */
  type: 'gtfs' | 'odpt-json';
  /** ISO 8601 timestamp when the download was initiated. */
  downloadedAt: string;
  /** The URL that was fetched (without auth tokens). */
  url: string;
  /** Total duration of the download job in milliseconds. */
  durationMs: number;
}

/** Successful download result. */
export interface DownloadMetaSuccess extends DownloadMetaBase {
  status: 'ok';
  /** Downloaded file size in bytes. */
  size: number;
  /** HTTP Content-Type header value. */
  contentType: string;
  /** Path to the archived copy (relative to pipeline/). */
  archivePath: string;
  /** Extracted files (GTFS only). */
  extractedFiles?: ExtractedFileInfo[];
  /** Feed info parsed from feed_info.txt (GTFS only). */
  feedInfo?: FeedInfoMeta;
}

/** Failed download result. */
export interface DownloadMetaError extends DownloadMetaBase {
  status: 'error';
  /** Error message. */
  error: string;
}

/** Download metadata — either success or error. */
export type DownloadMeta = DownloadMetaSuccess | DownloadMetaError;

// ---------------------------------------------------------------------------
// Write / Read
// ---------------------------------------------------------------------------

/**
 * Save download metadata for a source.
 *
 * Overwrites any existing metadata for the same source.
 * Creates the metadata directory if it does not exist.
 *
 * @param meta - Download result to record.
 */
export function saveDownloadMeta(meta: DownloadMeta): void {
  ensureDir(META_DIR);
  const filePath = join(META_DIR, `${meta.sourceName}.json`);
  writeFileSync(filePath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
}

/**
 * Load download metadata for a source.
 *
 * @param sourceName - Source definition name (e.g. "kanto-bus").
 * @returns The metadata, or null if no metadata file exists.
 */
export function loadDownloadMeta(sourceName: string): DownloadMeta | null {
  const filePath = join(META_DIR, `${sourceName}.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const text = readFileSync(filePath, 'utf-8');
    return JSON.parse(text) as DownloadMeta;
  } catch (e) {
    console.warn(`[loadDownloadMeta] Failed to parse ${sourceName}.json:`, e);
    return null;
  }
}

/**
 * Load all download metadata files.
 *
 * Reads files directly instead of delegating to {@link loadDownloadMeta}
 * to avoid redundant path construction and existence checks.
 * Corrupted files are skipped with a warning.
 *
 * @returns Map of source name to metadata.
 */
export function loadAllDownloadMeta(): Map<string, DownloadMeta> {
  const result = new Map<string, DownloadMeta>();
  if (!existsSync(META_DIR)) {
    return result;
  }
  for (const file of readdirSync(META_DIR)) {
    if (!file.endsWith('.json')) {
      continue;
    }
    const sourceName = file.replace(/\.json$/, '');
    const filePath = join(META_DIR, file);
    try {
      const text = readFileSync(filePath, 'utf-8');
      const meta = JSON.parse(text) as DownloadMeta;
      result.set(sourceName, meta);
    } catch (e) {
      console.warn(`[loadAllDownloadMeta] Failed to load or parse ${file}:`, e);
    }
  }
  return result;
}
