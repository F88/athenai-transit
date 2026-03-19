/**
 * Tests for bundle-writer.ts.
 *
 * @vitest-environment node
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DataBundle } from '../../../../../src/types/data/transit-v2-json';
import { writeDataBundle } from '../bundle-writer';

const TMP_DIR = join(import.meta.dirname, '.tmp-bundle-writer-test');

/** Minimal DataBundle for testing. */
function makeBundle(): DataBundle {
  return {
    bundle_version: 2,
    kind: 'data',
    stops: { v: 2, data: [] },
    routes: { v: 2, data: [] },
    agency: { v: 1, data: [] },
    calendar: { v: 1, data: { services: [], exceptions: [] } },
    feedInfo: { v: 1, data: { pn: '', pu: '', l: '', s: '', e: '', v: '' } },
    timetable: { v: 2, data: {} },
    tripPatterns: { v: 2, data: {} },
    translations: {
      v: 1,
      data: {
        headsigns: {},
        stop_headsigns: {},
        stop_names: {},
        route_names: {},
        agency_names: {},
        agency_short_names: {},
      },
    },
    lookup: { v: 2, data: {} },
  };
}

beforeEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('writeDataBundle', () => {
  it('creates directory and writes data.json', () => {
    const dir = join(TMP_DIR, 'test-prefix');
    const bundle = makeBundle();

    writeDataBundle(dir, bundle);

    const filePath = join(dir, 'data.json');
    expect(existsSync(filePath)).toBe(true);

    const written = JSON.parse(readFileSync(filePath, 'utf-8')) as DataBundle;
    expect(written.bundle_version).toBe(2);
    expect(written.kind).toBe('data');
  });

  it('does not leave a temp file after successful write', () => {
    const dir = join(TMP_DIR, 'test-prefix');
    writeDataBundle(dir, makeBundle());

    expect(existsSync(join(dir, 'data.json.tmp'))).toBe(false);
  });

  it('overwrites existing data.json', () => {
    const dir = join(TMP_DIR, 'test-prefix');

    const bundle1 = makeBundle();
    bundle1.stops = { v: 2, data: [{ v: 2, i: 'a:1', n: 'Stop1', a: 35, o: 139, l: 0 }] };
    writeDataBundle(dir, bundle1);

    const bundle2 = makeBundle();
    bundle2.stops = { v: 2, data: [{ v: 2, i: 'a:2', n: 'Stop2', a: 36, o: 140, l: 0 }] };
    writeDataBundle(dir, bundle2);

    const written = JSON.parse(readFileSync(join(dir, 'data.json'), 'utf-8')) as DataBundle;
    expect(written.stops.data).toHaveLength(1);
    expect(written.stops.data[0].i).toBe('a:2');
  });

  it('creates nested directories recursively', () => {
    const dir = join(TMP_DIR, 'a', 'b', 'c');
    writeDataBundle(dir, makeBundle());

    expect(existsSync(join(dir, 'data.json'))).toBe(true);
  });
});
