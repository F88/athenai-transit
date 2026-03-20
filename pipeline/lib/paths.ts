/**
 * Shared path constants for pipeline workspace directories.
 *
 * All pipeline scripts should import paths from here instead of
 * computing them with relative `resolve()` calls. This ensures
 * consistent directory references and makes workspace restructuring
 * a single-file change.
 */

import { join, resolve } from 'node:path';

/** Pipeline root directory (`pipeline/`). */
export const PIPELINE_ROOT = resolve(import.meta.dirname, '..');

/** Workspace root — all pipeline I/O data lives here. */
export const WORKSPACE_DIR = join(PIPELINE_ROOT, 'workspace');

/** Downloaded source data (GTFS, ODPT JSON, MLIT GeoJSON). */
export const DATA_DIR = join(WORKSPACE_DIR, 'data');

/** Build output (SQLite DBs, generated JSON). */
export const BUILD_DIR = join(WORKSPACE_DIR, '_build');

/** Timestamped archives of downloaded files. */
export const ARCHIVES_DIR = join(WORKSPACE_DIR, '_archives');

/** Pipeline state (download metadata, check results). */
export const STATE_DIR = join(WORKSPACE_DIR, 'state');
