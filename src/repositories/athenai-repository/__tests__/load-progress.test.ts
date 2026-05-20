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
        metrics: { encodedBytes: 100, decodedBytes: 200, networkMs: 3, parseMs: 1 },
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

  it('preserves the last required event after non-required activity', () => {
    let state = createInitialRepositoryLoadProgressState(['alpha']);
    state = reduceRepositoryLoadProgressState(state, {
      type: 'succeeded',
      path: 'alpha/data.json',
      prefix: 'alpha',
      kind: 'data',
      optional: false,
      metrics: {},
    });
    state = reduceRepositoryLoadProgressState(state, {
      type: 'started',
      path: 'alpha/shapes.json',
      prefix: 'alpha',
      kind: 'shapes',
      optional: true,
    });

    const summary = summarizeRepositoryLoadProgress(state);
    expect(summary.boot.lastRequiredEvent).toMatchObject({
      type: 'succeeded',
      path: 'alpha/data.json',
    });
    expect(formatBootLoadProgressSummary(summary.boot)).toContain('last=succeeded:alpha/data.json');
  });

  it('returns a defensive copy of request counts', () => {
    let state = createInitialRepositoryLoadProgressState(['alpha']);
    state = reduceRepositoryLoadProgressState(state, {
      type: 'started',
      path: 'alpha/data.json',
      prefix: 'alpha',
      kind: 'data',
      optional: false,
    });

    const summaryA = summarizeRepositoryLoadProgress(state);
    summaryA.activity.requestCounts.started = 99;
    const summaryB = summarizeRepositoryLoadProgress(state);

    expect(summaryB.activity.requestCounts.started).toBe(1);
  });

  it('moves a failed required source back to loading when restarted', () => {
    let state = createInitialRepositoryLoadProgressState(['alpha']);
    state = reduceRepositoryLoadProgressState(state, {
      type: 'failed',
      path: 'alpha/data.json',
      prefix: 'alpha',
      kind: 'data',
      optional: false,
      reason: 'network-error',
      message: 'boom',
    });
    state = reduceRepositoryLoadProgressState(state, {
      type: 'started',
      path: 'alpha/data.json',
      prefix: 'alpha',
      kind: 'data',
      optional: false,
    });

    const summary = summarizeRepositoryLoadProgress(state);
    expect(summary.boot.failedSources).toBe(0);
    expect(summary.boot.startedSources).toBe(1);
    expect(summary.boot.progressRatio).toBe(0);
    expect(summary.boot.lastRequiredEvent).toMatchObject({
      type: 'started',
      path: 'alpha/data.json',
    });
  });
});
