import { useTranslation } from 'react-i18next';

import { createLogger } from '../lib/logger';
import { cn } from '../lib/utils';
import type { InfoLevel } from '../types/app/settings';
import type { StopsCounts } from '../types/app/stop';
import { LabelCountBadge } from './badge/label-count-badge';
import type { BaseLabelSize } from './label/base-label';
import type { ExtendedDisplaySize } from './shared/display-size';

const summaryLogger = createLogger('StopsSummary');

const textClassBySize: Record<ExtendedDisplaySize, string> = {
  xs: 'gap-1 text-xs',
  sm: 'gap-1 text-sm',
  md: 'gap-1 text-base',
  lg: 'gap-2.5 py-2 text-lg',
  xl: 'gap-3 py-3 text-xl',
};

const badgeSizeBySize: Record<ExtendedDisplaySize, BaseLabelSize> = {
  xs: 'xs',
  sm: 'sm',
  md: 'sm',
  lg: 'md',
  xl: 'lg',
};

export interface StopsSummaryProps {
  label: string;
  totalCount: StopsCounts;
  filteredCount: number;
  nearbyRadius: number;
  omitEmptyStops: boolean;
  hasLoaded: boolean;
  infoLevel: InfoLevel;
  size?: ExtendedDisplaySize;
}

function formatRadius(meters: number): string {
  if (meters >= 1000) {
    return `${meters / 1000}km`;
  }
  return `${meters}m`;
}

function buildStopsSummaryText(
  hasLoaded: boolean,
  totalCounts: StopsCounts,
  filteredCount: number,
  omitEmptyStops: boolean,
  _infoLevel: InfoLevel,
  radius: string,
  lang: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!hasLoaded) {
    return t('common.loading');
  }

  if (filteredCount > 0) {
    return t('nearbyStops.summary', {
      count: filteredCount.toLocaleString(lang),
      radius,
    });
  }
  if (omitEmptyStops && totalCounts.total > 0) {
    return t('nearbyStops.noOperating', { radius });
  }
  return t('nearbyStops.noStops', { radius });
}

function formatStopsCountsDebugLog(counts: StopsCounts): string {
  return `total=${counts.total} nonEmpty=${counts.nonEmpty} boardable=${counts.boardableCount} origin=${counts.originCount}`;
}

export function StopsSummary({
  label,
  totalCount,
  filteredCount,
  nearbyRadius,
  omitEmptyStops,
  hasLoaded,
  infoLevel,
  size = 'md',
}: StopsSummaryProps) {
  const { t, i18n } = useTranslation();

  if (summaryLogger.isEnabled('debug')) {
    summaryLogger.debug(
      hasLoaded
        ? `[${label}] ${formatStopsCountsDebugLog(totalCount)} -> filtered=${filteredCount}`
        : 'not loaded yet',
    );
  }

  const text = buildStopsSummaryText(
    hasLoaded,
    totalCount,
    filteredCount,
    omitEmptyStops,
    infoLevel,
    formatRadius(nearbyRadius),
    i18n.language,
    t,
  );

  return (
    <div
      className={cn(
        // 'bg-violet-400',
        'm-0 flex items-center font-bold text-[#212121] dark:text-gray-100',
        textClassBySize[size],
      )}
    >
      {infoLevel === 'verbose' && (
        <LabelCountBadge
          label={`${totalCount.total}`}
          count={filteredCount}
          size={badgeSizeBySize[size]}
          labelClassName="bg-info text-info-foreground"
          countClassName="bg-background text-info"
          frameClassName="border-info"
        />
      )}
      {text}
    </div>
  );
}
