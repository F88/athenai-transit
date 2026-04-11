import { useTranslation } from 'react-i18next';
import type { StopServiceState } from '../../types/app/transit';
import { BaseLabel, type BaseLabelSize } from './base-label';

const stateStyles: Record<Exclude<StopServiceState, 'boardable'>, string> = {
  'drop-off-only': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  'no-service': 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * Label displaying the service state of a stop.
 *
 * - `'boardable'` — renders nothing (normal state)
 * - `'drop-off-only'` — red label
 * - `'no-service'` — gray label
 *
 * Designed to sit inline with stop name and other labels in StopSummary.
 */
export function StopServiceStateLabel({
  stopServiceState,
  size = 'sm',
}: {
  stopServiceState: StopServiceState;
  size?: BaseLabelSize;
}) {
  const { t } = useTranslation();

  if (stopServiceState === 'boardable') {
    return null;
  }

  const i18nKey =
    stopServiceState === 'drop-off-only'
      ? 'stop.serviceState.dropOffOnly'
      : 'stop.serviceState.noService';

  return <BaseLabel size={size} value={t(i18nKey)} className={stateStyles[stopServiceState]} />;
}
