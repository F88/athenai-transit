import { afterEach, describe, expect, it } from 'vitest';
import { isWebStorageAvailable, resolveWebStorage } from '../web-storage-resolver';

type StorageDescriptor = PropertyDescriptor;

function captureDescriptor(prop: 'localStorage' | 'sessionStorage'): StorageDescriptor {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, prop);
  if (!descriptor) {
    throw new Error(`Missing descriptor for globalThis.${prop} in test environment`);
  }
  return descriptor;
}

function restoreDescriptor(prop: 'localStorage' | 'sessionStorage', descriptor: StorageDescriptor) {
  Object.defineProperty(globalThis, prop, descriptor);
}

function overrideWithThrowingGetter(prop: 'localStorage' | 'sessionStorage') {
  Object.defineProperty(globalThis, prop, {
    configurable: true,
    get() {
      throw new DOMException(
        `Failed to read the '${prop}' property from 'Window': Access is denied for this document.`,
        'SecurityError',
      );
    },
  });
}

describe('resolveWebStorage', () => {
  describe("kind: 'local'", () => {
    const original = captureDescriptor('localStorage');
    afterEach(() => {
      restoreDescriptor('localStorage', original);
    });

    it('returns the global localStorage when accessible', () => {
      const storage = resolveWebStorage('local');
      expect(storage).toBe(globalThis.localStorage);
    });

    it('returns undefined when the localStorage getter throws', () => {
      overrideWithThrowingGetter('localStorage');

      expect(resolveWebStorage('local')).toBeUndefined();
    });

    it('normalises a null localStorage value to undefined', () => {
      // Non-conformant environments (custom polyfills / shims) may set the
      // global to null rather than provide a Storage instance or throw.
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          return null;
        },
      });

      expect(resolveWebStorage('local')).toBeUndefined();
    });
  });

  describe("kind: 'session'", () => {
    const original = captureDescriptor('sessionStorage');
    afterEach(() => {
      restoreDescriptor('sessionStorage', original);
    });

    it('returns the global sessionStorage when accessible', () => {
      const storage = resolveWebStorage('session');
      expect(storage).toBe(globalThis.sessionStorage);
    });

    it('returns undefined when the sessionStorage getter throws', () => {
      overrideWithThrowingGetter('sessionStorage');

      expect(resolveWebStorage('session')).toBeUndefined();
    });

    it('normalises a null sessionStorage value to undefined', () => {
      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        get() {
          return null;
        },
      });

      expect(resolveWebStorage('session')).toBeUndefined();
    });
  });
});

describe('isWebStorageAvailable', () => {
  const originalLocal = captureDescriptor('localStorage');
  const originalSession = captureDescriptor('sessionStorage');
  afterEach(() => {
    restoreDescriptor('localStorage', originalLocal);
    restoreDescriptor('sessionStorage', originalSession);
  });

  it('returns true when localStorage is reachable', () => {
    expect(isWebStorageAvailable('local')).toBe(true);
  });

  it('returns false when localStorage getter throws', () => {
    overrideWithThrowingGetter('localStorage');

    expect(isWebStorageAvailable('local')).toBe(false);
  });

  it('returns true when sessionStorage is reachable', () => {
    expect(isWebStorageAvailable('session')).toBe(true);
  });

  it('returns false when sessionStorage getter throws', () => {
    overrideWithThrowingGetter('sessionStorage');

    expect(isWebStorageAvailable('session')).toBe(false);
  });
});
