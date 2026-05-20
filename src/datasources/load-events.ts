export type BundleLoadKind =
  | 'data'
  | 'shapes'
  | 'insights'
  | 'global-insights'
  | 'data-source-catalog'
  | 'unknown';

export type BundleLoadFailureReason =
  | 'timeout'
  | 'network-error'
  | 'http-error'
  | 'non-json'
  | 'body-read-error'
  | 'json-parse-error'
  | 'bundle-envelope-error';

/**
 * Optional transport and parsing metrics captured for a successful bundle load.
 */
export interface BundleLoadMetrics {
  /** Encoded response body size reported by Resource Timing, when available. */
  encodedBytes?: number;
  /** Decoded response body size reported by Resource Timing, when available. */
  decodedBytes?: number;
  /** Fallback decoded-size approximation used when decoded bytes are unavailable. */
  fallbackDecodedBytes?: number;
  /** Time spent on network transfer and body read, in milliseconds. */
  networkMs?: number;
  /** Time spent parsing JSON, in milliseconds. */
  parseMs?: number;
}

interface BundleLoadEventBase {
  path: string;
  prefix: string | null;
  kind: BundleLoadKind;
  optional: boolean;
}

export interface BundleLoadStartedEvent extends BundleLoadEventBase {
  type: 'started';
}

export interface BundleLoadSucceededEvent extends BundleLoadEventBase {
  type: 'succeeded';
  metrics: BundleLoadMetrics;
}

export interface BundleLoadSkippedEvent extends BundleLoadEventBase {
  type: 'skipped';
  reason: BundleLoadFailureReason;
  message: string;
}

export interface BundleLoadFailedEvent extends BundleLoadEventBase {
  type: 'failed';
  reason: BundleLoadFailureReason;
  message: string;
}

export type BundleLoadEvent =
  | BundleLoadStartedEvent
  | BundleLoadSucceededEvent
  | BundleLoadSkippedEvent
  | BundleLoadFailedEvent;

export type BundleLoadReporter = (event: BundleLoadEvent) => void;
