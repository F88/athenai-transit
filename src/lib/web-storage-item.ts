import type { WebStorageResult } from '../types/result';

/**
 * Thin result-based wrapper around a single Web Storage key.
 *
 * This helper owns direct `Storage` access only. Schema validation,
 * migration, and domain-specific recovery remain the responsibility of
 * higher-level repositories.
 */
export class WebStorageItem {
  private readonly key: string;
  private readonly storage: Storage | undefined;

  constructor(key: string, storage: Storage | undefined = globalThis.localStorage) {
    this.key = key;
    this.storage = storage;
  }

  read(): WebStorageResult<string | null> {
    if (!this.storage) {
      return { success: false, error: 'Web Storage API is not available' };
    }

    try {
      return { success: true, data: this.storage.getItem(this.key) };
    } catch {
      return { success: false, error: `Failed to read '${this.key}' from storage` };
    }
  }

  write(value: string): WebStorageResult<void> {
    if (!this.storage) {
      return { success: false, error: 'Web Storage API is not available' };
    }

    try {
      this.storage.setItem(this.key, value);
      return { success: true, data: undefined };
    } catch {
      return { success: false, error: `Failed to write '${this.key}' to storage` };
    }
  }

  remove(): WebStorageResult<void> {
    if (!this.storage) {
      return { success: false, error: 'Web Storage API is not available' };
    }

    try {
      this.storage.removeItem(this.key);
      return { success: true, data: undefined };
    } catch {
      return { success: false, error: `Failed to remove '${this.key}' from storage` };
    }
  }
}
