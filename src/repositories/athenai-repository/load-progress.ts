import type { BundleLoadEvent } from '../../datasources/load-events';

type RequiredSourceStatus = 'idle' | 'loading' | 'loaded' | 'failed';

/**
 * Summary of required `data` bundle progress used for repository boot completion.
 */
export interface BootLoadProgressSummary {
  /** Total number of required data sources tracked for boot. */
  totalSources: number;
  /** Number of required data sources that have left the idle state. */
  startedSources: number;
  /** Number of required data sources that completed successfully. */
  completedSources: number;
  /** Number of required data sources that finished with failure. */
  failedSources: number;
  /** Processed required sources as a ratio of total required sources. */
  progressRatio: number;
  /** Most recent required `data` load event observed for boot progress. */
  lastRequiredEvent: BundleLoadEvent | null;
}

/**
 * Snapshot of all load activity observed so far, including non-boot requests.
 */
export interface LoadActivitySummary {
  requestCounts: {
    /** Total number of load requests that started. */
    started: number;
    /** Total number of load requests that succeeded. */
    succeeded: number;
    /** Total number of load requests that were skipped. */
    skipped: number;
    /** Total number of load requests that failed. */
    failed: number;
  };
  /** Sum of encoded response body sizes observed across successful loads. */
  totalEncodedBytes: number;
  /** Sum of decoded body sizes or estimated decoded sizes across successful loads. */
  totalDecodedBytes: number;
  /** Most recent load event observed across all activity. */
  lastEvent: BundleLoadEvent | null;
}

/**
 * Combined repository load progress view exposed to app and repository observers.
 */
export interface RepositoryLoadProgressSummary {
  boot: BootLoadProgressSummary;
  activity: LoadActivitySummary;
}

interface FormatBootLoadProgressSummaryOptions {
  mode?: 'progress' | 'complete';
}

interface FormatLoadActivitySummaryOptions {
  mode?: 'progress' | 'snapshot';
}

/**
 * Internal accumulator state used to reduce raw datasource events into summaries.
 */
interface RepositoryLoadProgressState {
  /** Total number of required data sources tracked by this reducer. */
  totalSources: number;
  /** Per-prefix boot status for required data source loading. */
  requiredSourceStatusByPrefix: Record<string, RequiredSourceStatus>;
  requestCounts: {
    /** Total number of load requests that started. */
    started: number;
    /** Total number of load requests that succeeded. */
    succeeded: number;
    /** Total number of load requests that were skipped. */
    skipped: number;
    /** Total number of load requests that failed. */
    failed: number;
  };
  /** Sum of encoded response body sizes observed across successful loads. */
  totalEncodedBytes: number;
  /** Sum of decoded body sizes or estimated decoded sizes across successful loads. */
  totalDecodedBytes: number;
  /** Most recent raw load event reduced into this state. */
  lastEvent: BundleLoadEvent | null;
}

export function createInitialRepositoryLoadProgressState(
  prefixes: string[],
): RepositoryLoadProgressState {
  const requiredSourceStatusByPrefix: Record<string, RequiredSourceStatus> = {};
  for (const prefix of prefixes) {
    requiredSourceStatusByPrefix[prefix] = 'idle';
  }

  return {
    totalSources: prefixes.length,
    requiredSourceStatusByPrefix,
    requestCounts: {
      started: 0,
      succeeded: 0,
      skipped: 0,
      failed: 0,
    },
    totalEncodedBytes: 0,
    totalDecodedBytes: 0,
    lastEvent: null,
  };
}

export function reduceRepositoryLoadProgressState(
  state: RepositoryLoadProgressState,
  event: BundleLoadEvent,
): RepositoryLoadProgressState {
  const next: RepositoryLoadProgressState = {
    ...state,
    requiredSourceStatusByPrefix: { ...state.requiredSourceStatusByPrefix },
    requestCounts: { ...state.requestCounts },
    lastEvent: event,
  };

  switch (event.type) {
    case 'started': {
      next.requestCounts.started += 1;
      if (event.kind === 'data' && event.prefix !== null) {
        const current = next.requiredSourceStatusByPrefix[event.prefix];
        if (current === 'idle') {
          next.requiredSourceStatusByPrefix[event.prefix] = 'loading';
        }
      }
      return next;
    }
    case 'succeeded': {
      next.requestCounts.succeeded += 1;
      next.totalEncodedBytes += event.metrics.encodedBytes ?? 0;
      next.totalDecodedBytes +=
        event.metrics.decodedBytes ?? event.metrics.fallbackDecodedBytes ?? 0;
      if (event.kind === 'data' && event.prefix !== null) {
        const current = next.requiredSourceStatusByPrefix[event.prefix];
        if (current !== 'loaded') {
          next.requiredSourceStatusByPrefix[event.prefix] = 'loaded';
        }
      }
      return next;
    }
    case 'skipped': {
      next.requestCounts.skipped += 1;
      return next;
    }
    case 'failed': {
      next.requestCounts.failed += 1;
      if (event.kind === 'data' && event.prefix !== null) {
        const current = next.requiredSourceStatusByPrefix[event.prefix];
        if (current !== 'loaded' && current !== 'failed') {
          next.requiredSourceStatusByPrefix[event.prefix] = 'failed';
        }
      }
      return next;
    }
  }
}

export function summarizeRepositoryLoadProgress(
  state: RepositoryLoadProgressState,
): RepositoryLoadProgressSummary {
  let startedSources = 0;
  let completedSources = 0;
  let failedSources = 0;

  for (const status of Object.values(state.requiredSourceStatusByPrefix)) {
    if (status !== 'idle') {
      startedSources += 1;
    }
    if (status === 'loaded') {
      completedSources += 1;
    }
    if (status === 'failed') {
      failedSources += 1;
    }
  }

  const processedSources = completedSources + failedSources;
  return {
    boot: {
      totalSources: state.totalSources,
      startedSources,
      completedSources,
      failedSources,
      progressRatio: state.totalSources === 0 ? 1 : processedSources / state.totalSources,
      lastRequiredEvent: isRequiredDataEvent(state.lastEvent) ? state.lastEvent : null,
    },
    activity: {
      requestCounts: state.requestCounts,
      totalEncodedBytes: state.totalEncodedBytes,
      totalDecodedBytes: state.totalDecodedBytes,
      lastEvent: state.lastEvent,
    },
  };
}

export function formatBootLoadProgressSummary(
  summary: BootLoadProgressSummary,
  options?: FormatBootLoadProgressSummaryOptions,
): string {
  const processedSources = summary.completedSources + summary.failedSources;
  const progressPercent = Math.round(summary.progressRatio * 100);
  const lastEvent =
    summary.lastRequiredEvent === null
      ? 'idle'
      : `${summary.lastRequiredEvent.type}:${summary.lastRequiredEvent.path}`;
  const label = options?.mode === 'complete' ? 'required data load complete' : 'boot progress';

  return `${label}: required=${processedSources}/${summary.totalSources} (${progressPercent}%) loaded=${summary.completedSources} failed=${summary.failedSources} last=${lastEvent}`;
}

export function formatLoadActivitySummary(
  summary: LoadActivitySummary,
  options?: FormatLoadActivitySummaryOptions,
): string {
  const lastEvent =
    summary.lastEvent === null ? 'idle' : `${summary.lastEvent.type}:${summary.lastEvent.path}`;
  const label = options?.mode === 'snapshot' ? 'load activity snapshot' : 'load activity';

  return `${label}: requests=${summary.requestCounts.started}/${summary.requestCounts.succeeded}/${summary.requestCounts.skipped}/${summary.requestCounts.failed} encoded=${formatBytes(summary.totalEncodedBytes)} decoded=${formatBytes(summary.totalDecodedBytes)} last=${lastEvent}`;
}

export function formatLoadActivitySizeSummary(summary: LoadActivitySummary): string {
  return `data size: encoded=${formatBytes(summary.totalEncodedBytes)} decoded=${formatBytes(summary.totalDecodedBytes)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isRequiredDataEvent(event: BundleLoadEvent | null): event is BundleLoadEvent {
  return event !== null && event.kind === 'data' && !event.optional;
}
