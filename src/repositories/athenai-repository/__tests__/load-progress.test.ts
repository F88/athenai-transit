import { describe, expect, it } from 'vitest';

import type { BundleLoadEvent } from '../../../datasources/load-events';
import {
  createInitialRepositoryLoadProgressState,
  formatBootLoadProgressSummary,
  formatLoadActivitySizeSummary,
  formatLoadActivitySummary,
  reduceRepositoryLoadProgressState,
  summarizeRepositoryLoadProgress,
} from '../load-progress';

describe('load progress reducer', () => {
  it('tracks required source progress from data bundle events', () => {
    const events: BundleLoadEvent[] = [
      { type: 'started', path: 'alpha/data.json', prefix: 'alpha', kind: 'data', optional: false },
      {
        type: 'succeeded',
        path: 'alpha/data.json',
        prefix: 'alpha',
        kind: 'data',
        optional: false,
        metrics: { transferBytes: 100, decodedBytes: 200, networkMs: 3, parseMs: 1 },
      },
      { type: 'started', path: 'beta/data.json', prefix: 'beta', kind: 'data', optional: false },
      {
        type: 'failed',
        path: 'beta/data.json',
        prefix: 'beta',
        kind: 'data',
        optional: false,
        reason: 'json-parse-error',
        message: 'bad json',
      },
    ];

    let state = createInitialRepositoryLoadProgressState(['alpha', 'beta']);
    for (const event of events) {
      state = reduceRepositoryLoadProgressState(state, event);
    }

    const summary = summarizeRepositoryLoadProgress(state);
    expect(summary.boot.startedSources).toBe(2);
    expect(summary.boot.completedSources).toBe(1);
    expect(summary.boot.failedSources).toBe(1);
    expect(summary.boot.progressRatio).toBe(1);
    expect(summary.activity.requestCounts).toEqual({
      started: 2,
      succeeded: 1,
      skipped: 0,
      failed: 1,
    });
    expect(summary.activity.totalEncodedBytes).toBe(100);
    expect(summary.activity.totalDecodedBytes).toBe(200);
  });

  it('formats separate boot and activity summary lines', () => {
    let state = createInitialRepositoryLoadProgressState(['alpha']);
    state = reduceRepositoryLoadProgressState(state, {
      type: 'started',
      path: 'alpha/data.json',
      prefix: 'alpha',
      kind: 'data',
      optional: false,
    });
    const summary = summarizeRepositoryLoadProgress(state);

    expect(formatBootLoadProgressSummary(summary.boot)).toContain('boot progress: required=0/1');
    expect(formatBootLoadProgressSummary(summary.boot, { mode: 'complete' })).toContain(
      'required data load complete: required=0/1',
    );
    expect(formatBootLoadProgressSummary(summary.boot)).toContain('last=started:alpha/data.json');
    expect(formatLoadActivitySummary(summary.activity)).toContain(
      'load activity: requests=1/0/0/0',
    );
    expect(formatLoadActivitySummary(summary.activity, { mode: 'snapshot' })).toContain(
      'load activity snapshot: requests=1/0/0/0',
    );
    expect(formatLoadActivitySizeSummary(summary.activity)).toBe(
      'data size: encoded=0B decoded=0B',
    );
  });
});
