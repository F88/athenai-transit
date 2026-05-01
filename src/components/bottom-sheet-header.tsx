import type { DataConfig } from '../config/perf-profiles';
import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { StopTimeViewMeta } from '../types/app/transit-composed';
import type { StopsCounts } from '../types/app/stop';
import { DEFAULT_AGENCY_LANG } from '../config/transit-defaults';
import { resolveAgencyColors } from '../domain/transit/color-resolver/agency-colors';
import { STOP_TIMES_VIEWS } from '../domain/transit/stop-time-views';
import { getAgencyDisplayNames } from '../domain/transit/get-agency-display-name';
import { createLogger } from '../lib/logger';
import { routeTypeColor } from '../utils/route-type-color';
import { routeTypeEmoji } from '../utils/route-type-emoji';
import { useInfoLevel } from '../hooks/use-info-level';
import { useTranslation } from 'react-i18next';
import { PillButton } from './button/pill-button';
import { BoardabilityFilter } from './filter/boardability-filter';
import { OriginFilter } from './filter/origin-filter';
import { LabelCountBadge } from './badge/label-count-badge';

interface BottomSheetHeaderProps {
  hasNearbyLoaded: boolean;
  /**
   * Pre-`globalFilter` counts (= settings filter applied, `globalFilter`
   * not yet, no BottomSheet-local Stage 1/2 trim). Used to drive filter
   * pill displays that should not fluctuate when the user toggles
   * `globalFilter` pills. The post-`globalFilter` `counts` above remains
   * the source of truth for "what is currently visible".
   */
  nearbyStopsCounts: StopsCounts;
  /** App-filtered counts before BottomSheet-local filters. */
  filteredNearbyStopsCounts: StopsCounts;
  counts: StopsCounts;
  dataConfig: DataConfig;
  dataLangs: readonly string[];
  omitEmptyStops: boolean;
  isOmitEmptyStopsForced: boolean;
  showOriginOnly: boolean;
  showBoardableOnly: boolean;
  viewId: string;
  selectedView: StopTimeViewMeta | undefined;
  infoLevel: InfoLevel;
  presentRouteTypes: readonly number[];
  hiddenRouteTypes: Set<number>;
  presentAgencies: Agency[];
  hiddenAgencyIds: Set<string>;
  onToggleOmitEmptyStops: () => void;
  onToggleShowOriginOnly: () => void;
  onToggleShowBoardableOnly: () => void;
  onViewChange: (viewId: string) => void;
  onToggleRouteType: (rt: number) => void;
  onToggleAgency: (agency: Agency) => void;
}

export function BottomSheetHeader({
  hasNearbyLoaded,
  nearbyStopsCounts,
  filteredNearbyStopsCounts: _filteredNearbyStopsCounts,
  counts,
  dataConfig,
  dataLangs,
  omitEmptyStops,
  isOmitEmptyStopsForced,
  showOriginOnly,
  showBoardableOnly,
  viewId,
  selectedView: _selectedView,
  infoLevel,
  presentRouteTypes,
  hiddenRouteTypes,
  presentAgencies,
  hiddenAgencyIds,
  onToggleOmitEmptyStops,
  onToggleShowOriginOnly,
  onToggleShowBoardableOnly,
  onViewChange,
  onToggleRouteType,
  onToggleAgency,
}: BottomSheetHeaderProps) {
  const { t } = useTranslation();
  const info = useInfoLevel(infoLevel);

  console.debug({ nearbyStopsCounts });
  console.debug({ counts });

  return (
    <div className="shrink-0 px-4 pb-2">
      <StopsSummary
        label={'operating stops only'}
        hasLoaded={hasNearbyLoaded}
        totalCount={nearbyStopsCounts}
        filteredCount={counts.total}
        nearbyRadius={dataConfig.stops.nearbyRadius}
        omitEmptyStops={omitEmptyStops}
        infoLevel={infoLevel}
      />

      <div className="no-scrollbar mt-1.5 flex gap-1 overflow-x-auto">
        {/* Views */}
        {STOP_TIMES_VIEWS.filter((v) => v.visible).map((view) => (
          <PillButton
            key={view.id}
            size={'sm'}
            active={viewId === view.id}
            disabled={!view.enabled}
            onClick={() => onViewChange(view.id)}
            title={t(view.titleKey)}
          >
            {view.icon}
            {info.isDetailedEnabled ? ` ${t(view.labelKey)}` : ''}
          </PillButton>
        ))}
      </div>
      {/* Filters */}
      <div className="no-scrollbar mt-1 flex gap-1 overflow-x-auto">
        {/* Operating stops filter */}
        <PillButton
          size={'sm'}
          active={omitEmptyStops}
          disabled={isOmitEmptyStopsForced}
          activeBg={'var(--info)'}
          activeBorder={'var(--info)'}
          inactiveBorder={'var(--info)'}
          onClick={onToggleOmitEmptyStops}
          title={t('nearbyStops.showOperatingStopsOnlyTitle')}
          count={counts.nonEmpty}
        >
          {t('nearbyStops.showOperatingStopsOnly')}
        </PillButton>

        {/* Boardable filter (entry-level: pickup_type === 0) */}
        <BoardabilityFilter
          boardable={showBoardableOnly}
          onToggleBoardable={onToggleShowBoardableOnly}
          count={counts.boardableCount}
        />

        {/* Origin filter (entry-level: patternPosition.isOrigin) */}
        {/* {counts.total > 0 && counts.originCount > 0 && ( */}
        <OriginFilter
          origin={showOriginOnly}
          onToggleOrigin={onToggleShowOriginOnly}
          count={counts.originCount}
        />
        {/* )} */}

        {/* Route types filter */}
        {presentRouteTypes.map((rt) => (
          <PillButton
            key={rt}
            size={'sm'}
            active={!hiddenRouteTypes.has(rt)}
            activeBg={`${routeTypeColor(rt)}40`}
            // activeBorder={routeTypeColor(rt)}
            inactiveBorder={routeTypeColor(rt)}
            onClick={() => onToggleRouteType(rt)}
          >
            {routeTypeEmoji(rt)}
          </PillButton>
        ))}

        {/* Agency filter */}
        {presentAgencies.map((agency) => {
          const { agencyColor: bgColor, agencyTextColor: fgColor } = resolveAgencyColors(
            agency,
            'css-hex',
          );
          const names = getAgencyDisplayNames(agency, dataLangs, DEFAULT_AGENCY_LANG, 'short');
          const label = names.shortName.name || names.resolved.name || agency.agency_id;
          const title = names.longName.name || names.resolved.name || agency.agency_id;
          return (
            <PillButton
              key={agency.agency_id}
              size={'sm'}
              active={!hiddenAgencyIds.has(agency.agency_id)}
              activeBg={bgColor}
              activeFg={fgColor}
              activeBorder={bgColor}
              inactiveBorder={bgColor}
              onClick={() => onToggleAgency(agency)}
              title={title}
            >
              {label}
            </PillButton>
          );
        })}
      </div>
      {/* {selectedView && info.isVerboseEnabled && (
        <div className="mt-1">
          <p className="text-[11px] text-[#888] dark:text-gray-400">{t(selectedView.titleKey)}</p>
          {info.isDetailedEnabled && (
            <p className="text-[10px] text-[#aaa] dark:text-gray-500">
              {t(selectedView.descriptionKey)}
            </p>
          )}
        </div>
      )} */}
    </div>
  );
}

function formatRadius(meters: number): string {
  if (meters >= 1000) {
    return `${meters / 1000}km`;
  }
  return `${meters}m`;
}

function getNearbyStopsSummaryText(
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

const summaryLogger = createLogger('NearbyStopsSummary');

interface NearbyStopsSummaryProps {
  label: string;
  totalCount: StopsCounts;
  filteredCount: number;
  nearbyRadius: number;
  omitEmptyStops: boolean;
  hasLoaded: boolean;
  infoLevel: InfoLevel;
}

function StopsSummary({
  label,
  totalCount,
  filteredCount,
  nearbyRadius,
  omitEmptyStops,
  hasLoaded,
  infoLevel,
}: NearbyStopsSummaryProps) {
  const { t, i18n } = useTranslation();
  summaryLogger.debug(
    hasLoaded
      ? `[${label}] total=${totalCount.total} nonEmpty=${totalCount.nonEmpty} boardable=${totalCount.boardableCount} origin=${totalCount.originCount} -> filtered=${filteredCount}`
      : 'not loaded yet',
  );
  const text = getNearbyStopsSummaryText(
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
    <p className="m-0 flex items-center gap-1 text-base font-bold text-[#212121] dark:text-gray-100">
      {infoLevel === 'verbose' && totalCount.total !== filteredCount && (
        <LabelCountBadge
          label={`${totalCount.total}`}
          count={filteredCount}
          size="sm"
          labelClassName="bg-info text-info-foreground"
          countClassName="bg-background text-info"
          frameClassName="border-info"
        />
      )}
      {text}
    </p>
  );
}
