import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useWebStorageAvailability } from '../use-web-storage-availability';

type StorageProp = 'localStorage' | 'sessionStorage';

function captureDescriptor(prop: StorageProp): PropertyDescriptor {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, prop);
  if (!descriptor) {
    throw new Error(`Missing descriptor for globalThis.${prop} in test environment`);
  }
  return descriptor;
}

function restoreDescriptor(prop: StorageProp, descriptor: PropertyDescriptor) {
  Object.defineProperty(globalThis, prop, descriptor);
}

function overrideWithThrowingGetter(prop: StorageProp) {
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

describe('useWebStorageAvailability', () => {
  describe("kind: 'local'", () => {
    const original = captureDescriptor('localStorage');
    afterEach(() => {
      restoreDescriptor('localStorage', original);
    });

    it('returns true when localStorage is reachable', () => {
      const { result } = renderHook(() => useWebStorageAvailability('local'));

      expect(result.current).toBe(true);
    });

    it('returns false when localStorage getter throws', () => {
      overrideWithThrowingGetter('localStorage');

      const { result } = renderHook(() => useWebStorageAvailability('local'));

      expect(result.current).toBe(false);
    });

    it('captures the value on first mount and keeps it stable across re-renders', () => {
      const { result, rerender } = renderHook(() => useWebStorageAvailability('local'));
      const initial = result.current;

      // Even if the global descriptor changes after mount, the hook returns
      // the originally captured value -- intentional, because storage
      // availability is treated as a session-wide fact.
      overrideWithThrowingGetter('localStorage');
      rerender();

      expect(result.current).toBe(initial);
    });
  });

  describe("kind: 'session'", () => {
    const original = captureDescriptor('sessionStorage');
    afterEach(() => {
      restoreDescriptor('sessionStorage', original);
    });

    it('returns true when sessionStorage is reachable', () => {
      const { result } = renderHook(() => useWebStorageAvailability('session'));

      expect(result.current).toBe(true);
    });

    it('returns false when sessionStorage getter throws', () => {
      overrideWithThrowingGetter('sessionStorage');

      const { result } = renderHook(() => useWebStorageAvailability('session'));

      expect(result.current).toBe(false);
    });
  });
});
