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
  | 'json-parse-error';

export interface BundleLoadMetrics {
  transferBytes?: number;
  decodedBytes?: number;
  estimatedDecodedBytes?: number;
  networkMs?: number;
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
