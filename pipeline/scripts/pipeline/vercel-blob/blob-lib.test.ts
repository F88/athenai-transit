import { describe, expect, it } from 'vitest';

import {
  MAX_CONCURRENCY,
  blobStoreIdFromToken,
  deleteArgsSchema,
  deriveBlobKey,
  formatErrorRedacted,
  isPathInside,
  listArgsSchema,
  redactBlobTokens,
  resolveDeleteTarget,
  resolveListPrefix,
  uploadArgsSchema,
} from './blob-lib';

describe('deriveBlobKey', () => {
  it('strips the base dir and yields a key with no prefix', () => {
    expect(
      deriveBlobKey(
        'pipeline/workspace/_build/data-v2',
        'pipeline/workspace/_build/data-v2/85b/data.json',
      ),
    ).toBe('85b/data.json');
  });

  it('handles nested paths', () => {
    expect(
      deriveBlobKey(
        'pipeline/workspace/_build/data-v2',
        'pipeline/workspace/_build/data-v2/a/b/c.json',
      ),
    ).toBe('a/b/c.json');
  });

  it('handles a trailing slash on the base dir', () => {
    expect(
      deriveBlobKey(
        'pipeline/workspace/_build/data-v2/',
        'pipeline/workspace/_build/data-v2/85b/data.json',
      ),
    ).toBe('85b/data.json');
  });
});

describe('isPathInside', () => {
  it('accepts a nested path', () => {
    expect(isPathInside('/repo', '/repo/pipeline/workspace/_build/data-v2')).toBe(true);
  });

  it('accepts the base itself', () => {
    expect(isPathInside('/repo', '/repo')).toBe(true);
  });

  it('rejects an outside path', () => {
    expect(isPathInside('/repo', '/other')).toBe(false);
  });

  it('rejects a parent path', () => {
    expect(isPathInside('/repo/app', '/repo')).toBe(false);
  });

  it('rejects traversal that escapes the base', () => {
    expect(isPathInside('/repo', '/repo/../etc')).toBe(false);
  });
});

describe('uploadArgsSchema', () => {
  it('applies defaults (with --dir and --all)', () => {
    const r = uploadArgsSchema.parse({ dir: 'pipeline/workspace/_build/data-v2', all: true });
    expect(r.dir).toBe('pipeline/workspace/_build/data-v2');
    expect(r.concurrency).toBe(MAX_CONCURRENCY);
    expect(r.dryRun).toBe(false);
    expect(r.all).toBe(true);
    expect(r.source).toBeUndefined();
  });

  it('accepts a single --source', () => {
    expect(uploadArgsSchema.parse({ dir: 'd', source: ['85b'] }).source).toEqual(['85b']);
  });

  it('accepts multiple --source', () => {
    expect(uploadArgsSchema.parse({ dir: 'd', source: ['mir', 'mtfry'] }).source).toEqual([
      'mir',
      'mtfry',
    ]);
  });

  it('rejects a missing --dir', () => {
    expect(() => uploadArgsSchema.parse({ all: true })).toThrow();
  });

  it('rejects no target', () => {
    expect(() => uploadArgsSchema.parse({ dir: 'd' })).toThrow();
  });

  it('rejects both --source and --all', () => {
    expect(() => uploadArgsSchema.parse({ dir: 'd', source: ['85b'], all: true })).toThrow();
  });

  it('rejects a --source containing a slash', () => {
    expect(() => uploadArgsSchema.parse({ dir: 'd', source: ['a/b'] })).toThrow();
  });

  it('coerces a concurrency string to a number', () => {
    expect(uploadArgsSchema.parse({ dir: 'd', all: true, concurrency: '5' }).concurrency).toBe(5);
  });

  it('rejects concurrency above the max', () => {
    expect(() => uploadArgsSchema.parse({ dir: 'd', all: true, concurrency: '20' })).toThrow();
  });

  it('rejects a non-integer concurrency', () => {
    expect(() => uploadArgsSchema.parse({ dir: 'd', all: true, concurrency: '2.5' })).toThrow();
  });
});

describe('deleteArgsSchema', () => {
  it('accepts --source as the sole target', () => {
    expect(deleteArgsSchema.parse({ source: 'kotr' }).source).toBe('kotr');
  });

  it('accepts --prefix as the sole target', () => {
    expect(deleteArgsSchema.parse({ prefix: 'kotr/' }).prefix).toBe('kotr/');
  });

  it('rejects no target', () => {
    expect(() => deleteArgsSchema.parse({})).toThrow();
  });

  it('rejects both --source and --prefix', () => {
    expect(() => deleteArgsSchema.parse({ source: 'a', prefix: 'b' })).toThrow();
  });

  it('rejects an empty --prefix (would match the whole store)', () => {
    expect(() => deleteArgsSchema.parse({ prefix: '' })).toThrow();
  });

  it('rejects a --source containing a slash', () => {
    expect(() => deleteArgsSchema.parse({ source: 'a/b' })).toThrow();
  });
});

describe('resolveDeleteTarget', () => {
  it('maps --source to a "<name>/" prefix', () => {
    expect(resolveDeleteTarget({ source: 'kotr', yes: false })).toEqual({
      prefix: 'kotr/',
      label: 'prefix "kotr/"',
    });
  });

  it('passes --prefix through unchanged', () => {
    expect(resolveDeleteTarget({ prefix: 'foo/bar', yes: false })).toEqual({
      prefix: 'foo/bar',
      label: 'prefix "foo/bar"',
    });
  });
});

describe('listArgsSchema', () => {
  it('accepts no filter (list everything)', () => {
    const r = listArgsSchema.parse({});
    expect(r.source).toBeUndefined();
    expect(r.prefix).toBeUndefined();
  });

  it('accepts --source', () => {
    expect(listArgsSchema.parse({ source: 'kotr' }).source).toBe('kotr');
  });

  it('accepts --prefix', () => {
    expect(listArgsSchema.parse({ prefix: 'kotr/' }).prefix).toBe('kotr/');
  });

  it('rejects both --source and --prefix', () => {
    expect(() => listArgsSchema.parse({ source: 'a', prefix: 'b' })).toThrow();
  });

  it('rejects a --source containing a slash', () => {
    expect(() => listArgsSchema.parse({ source: 'a/b' })).toThrow();
  });
});

describe('resolveListPrefix', () => {
  it('no filter maps to an undefined prefix (entire store)', () => {
    expect(resolveListPrefix({})).toEqual({ prefix: undefined, label: 'in the entire store' });
  });

  it('maps --source to a "<name>/" prefix', () => {
    expect(resolveListPrefix({ source: 'kotr' })).toEqual({
      prefix: 'kotr/',
      label: 'under "kotr/"',
    });
  });

  it('passes --prefix through unchanged', () => {
    expect(resolveListPrefix({ prefix: 'foo/bar' })).toEqual({
      prefix: 'foo/bar',
      label: 'under "foo/bar"',
    });
  });
});

describe('blobStoreIdFromToken', () => {
  // Fabricated placeholder tokens only -- NOT real credentials or store ids.
  it('extracts the inferred store id from a rw token', () => {
    expect(blobStoreIdFromToken('vercel_blob_rw_EXAMPLESTOREID_this-is-not-a-real-secret')).toBe(
      'EXAMPLESTOREID',
    );
  });

  it('never returns the secret part', () => {
    const id = blobStoreIdFromToken('vercel_blob_rw_EXAMPLESTOREID_placeholder-do-not-use');
    expect(id).toBe('EXAMPLESTOREID');
    expect(id).not.toContain('placeholder');
  });

  it('returns (unknown) for an unexpected format', () => {
    expect(blobStoreIdFromToken('this-is-not-a-blob-token')).toBe('(unknown)');
  });
});

describe('redactBlobTokens', () => {
  // Fabricated placeholder tokens only -- NOT real credentials.
  it('redacts a token embedded in text', () => {
    expect(
      redactBlobTokens('failed with vercel_blob_rw_EXAMPLESTOREID_not-a-real-secret in url'),
    ).toBe('failed with vercel_blob_rw_[REDACTED] in url');
  });

  it('redacts every token occurrence', () => {
    const text = 'a vercel_blob_rw_AAA_secret1 b vercel_blob_rw_BBB_secret2 c';
    expect(redactBlobTokens(text)).toBe(
      'a vercel_blob_rw_[REDACTED] b vercel_blob_rw_[REDACTED] c',
    );
  });

  it('leaves text without a token unchanged', () => {
    expect(redactBlobTokens('a plain error message')).toBe('a plain error message');
  });
});

describe('formatErrorRedacted', () => {
  it('redacts a token in an Error message', () => {
    const msg = formatErrorRedacted(
      new Error('403 for vercel_blob_rw_EXAMPLESTOREID_not-a-real-secret'),
    );
    expect(msg).toContain('vercel_blob_rw_[REDACTED]');
    expect(msg).not.toContain('not-a-real-secret');
  });

  it('stringifies a non-Error value', () => {
    expect(formatErrorRedacted('boom')).toBe('boom');
  });
});
