import type { DataConfig } from '../config/perf-profiles';
import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { StopTimeViewMeta } from '../types/app/transit-composed';
import type { NearbyStopsCounts } from './bottom-sheet';
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

interface BottomSheetHeaderProps {
  hasNearbyLoaded: boolean;
  counts: NearbyStopsCounts;
  dataConfig: DataConfig;
  dataLang: readonly string[];
  showOperatingStopsOnly: boolean;
  viewId: string;
  selectedView: StopTimeViewMeta | undefined;
  infoLevel: InfoLevel;
  presentRouteTypes: readonly number[];
  hiddenRouteTypes: Set<number>;
  presentAgencies: Agency[];
  hiddenAgencyIds: Set<string>;
  onToggleShowOperatingStopsOnly: () => void;
  onViewChange: (viewId: string) => void;
  onToggleRouteType: (rt: number) => void;
  onToggleAgency: (agency: Agency) => void;
}

export function BottomSheetHeader({
  hasNearbyLoaded,
  counts,
  dataConfig,
  dataLang,
  showOperatingStopsOnly,
  viewId,
  selectedView,
  infoLevel,
  presentRouteTypes,
  hiddenRouteTypes,
  presentAgencies,
  hiddenAgencyIds,
  onToggleShowOperatingStopsOnly,
  onViewChange,
  onToggleRouteType,
  onToggleAgency,
}: BottomSheetHeaderProps) {
  const { t } = useTranslation();
  const info = useInfoLevel(infoLevel);

  return (
    <div className="shrink-0 px-4 pb-2">
      <NearbyStopsSummary
        hasLoaded={hasNearbyLoaded}
        counts={counts}
        nearbyRadius={dataConfig.stops.nearbyRadius}
        showOperatingStopsOnly={showOperatingStopsOnly}
      />
      <div className="no-scrollbar mt-1.5 flex gap-1 overflow-x-auto">
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
      <div className="no-scrollbar mt-1 flex gap-1 overflow-x-auto">
        <PillButton
          size={'sm'}
          active={showOperatingStopsOnly}
          activeBg={'#1565c0'}
          activeBorder={'#1565c0'}
          inactiveBorder={'#1565c0'}
          onClick={onToggleShowOperatingStopsOnly}
          title={t('nearbyStops.showOperatingStopsOnlyTitle')}
          count={counts.active}
        >
          {t('nearbyStops.showOperatingStopsOnly')}
        </PillButton>

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
          const names = getAgencyDisplayNames(agency, dataLang, DEFAULT_AGENCY_LANG, 'short');
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
      {selectedView && info.isVerboseEnabled && (
        <div className="mt-1">
          <p className="text-[11px] text-[#888] dark:text-gray-400">{t(selectedView.titleKey)}</p>
          {info.isDetailedEnabled && (
            <p className="text-[10px] text-[#aaa] dark:text-gray-500">
              {t(selectedView.descriptionKey)}
            </p>
          )}
        </div>
      )}
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
  counts: NearbyStopsCounts,
  showOperatingStopsOnly: boolean,
  radius: string,
  lang: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!hasLoaded) {
    return t('common.loading');
  }
  if (counts.filtered > 0) {
    return t('nearbyStops.summary', { count: counts.filtered.toLocaleString(lang), radius });
  }
  if (showOperatingStopsOnly && counts.total > 0) {
    return t('nearbyStops.noOperating', { radius });
  }
  return t('nearbyStops.noStops', { radius });
}

const summaryLogger = createLogger('NearbyStopsSummary');

interface NearbyStopsSummaryProps {
  counts: NearbyStopsCounts;
  nearbyRadius: number;
  showOperatingStopsOnly: boolean;
  hasLoaded: boolean;
}

function NearbyStopsSummary({
  counts,
  nearbyRadius,
  showOperatingStopsOnly,
  hasLoaded,
}: NearbyStopsSummaryProps) {
  const { t, i18n } = useTranslation();
  summaryLogger.verbose(
    hasLoaded
      ? `found ${counts.total} nearby stops (${counts.active} active, ${counts.filtered} after filter)`
      : 'not loaded yet',
  );
  const text = getNearbyStopsSummaryText(
    hasLoaded,
    counts,
    showOperatingStopsOnly,
    formatRadius(nearbyRadius),
    i18n.language,
    t,
  );

  return (
    <p className="m-0 flex items-center gap-1 text-base font-bold text-[#212121] dark:text-gray-100">
      {text}
    </p>
  );
}
