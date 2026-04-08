import type { ReactNode } from 'react';
import { Accessibility } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveAgencyLang } from '../config/transit-defaults';
import { useInfoLevel } from '../hooks/use-info-level';
import type { InfoLevel } from '../types/app/settings';
import type { Agency, Route, RouteType, Stop } from '../types/app/transit';
import { getStopDisplayNames } from '../domain/transit/get-stop-display-names';
import { routeTypesEmoji } from '../utils/route-type-emoji';
import { AgencyBadge, type AgencyBadgeSize } from './badge/agency-badge';
import { IdBadge } from './badge/id-badge';
import { RouteBadge, type RouteBadgeSize } from './badge/route-badge';
import { VerboseStop } from './verbose/verbose-stop';
import { VerboseStopDisplayNames } from './verbose/verbose-stop-display-names';
import { VerboseAgencies } from './verbose/verbose-agencies';
import { VerboseRoutes } from './verbose/verbose-routes';

export type StopSummaryVariant = 'default' | 'compact';

/**
 * Shared core props for stop summary presentation.
 *
 * These fields describe the common stop context reused by StopSummary and
 * wrapper components such as StopInfo.
 */
export interface StopSummaryCoreProps {
  /** Agencies to render as badges for this stop context. */
  agencies: Agency[];
  /** Route types served by the stop, rendered as the lead emoji. */
  routeTypes: RouteType[];
  /** Routes to render as badges in detailed mode. */
  routes?: Route[];
  /** Stop to display. */
  stop: Stop;
  /** Active information density level. */
  infoLevel: InfoLevel;
  /** Display language fallback chain for translated names. */
  dataLang: readonly string[];
  /** Whether the stop context is drop-off only. */
  isDropOffOnly: boolean;
  /** Badge size override for agency badges. */
  agencyBadgeSize?: AgencyBadgeSize;
  /** Badge size override for route badges. */
  routeBadgeSize?: RouteBadgeSize;
}

/**
 * Props for the shared stop summary block.
 *
 * This component owns the common stop presentation used across screens,
 * such as stop name, sub names, route type, platform code, accessibility,
 * drop-off status, agencies, routes, and verbose metadata.
 */
interface StopSummaryProps extends StopSummaryCoreProps {
  /**
   * Optional inline badge/content inserted in the main row after platform code.
   * Used by wrappers such as StopInfo to place distance without reimplementing
   * the shared row structure.
   */
  distanceBadge?: ReactNode;
}

export function StopSummary({
  agencies,
  routeTypes,
  routes,
  stop,
  infoLevel,
  dataLang,
  isDropOffOnly,
  agencyBadgeSize,
  routeBadgeSize,
  distanceBadge,
}: StopSummaryProps) {
  const { t } = useTranslation();
  const info = useInfoLevel(infoLevel);
  const showVerbose = infoLevel === 'verbose';
  const stopNames = getStopDisplayNames(
    stop,
    dataLang,
    resolveAgencyLang(agencies, stop.agency_id),
  );

  const idRowClass = 'mb-1 flex gap-1';
  const subNameClass = 'm-0 mb-0.5 text-xs font-normal text-[#888] dark:text-gray-400';
  const mainRowClass =
    'm-0 flex flex-wrap items-center gap-1 text-xl font-semibold text-[#1565c0] dark:text-blue-400';
  const routeTypeClass = 'mr-1';
  const nameClass = undefined;
  const platformCodeClass =
    'shrink-0 rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-600 dark:bg-amber-900 dark:text-amber-300';
  const accessibilityClass =
    'shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
  const inaccessibleClass =
    'shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-gray-700 opacity-30 dark:bg-gray-700 dark:text-gray-300';
  const dropOffClass =
    'shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300';
  const resolvedAgencyBadgeSize = agencyBadgeSize ?? 'sm';
  const resolvedRouteBadgeSize = routeBadgeSize ?? 'xs';
  const wheelchairAccessibleLabel = t('stop.wheelchairAccessible');
  const wheelchairNotAccessibleLabel = t('stop.wheelchairNotAccessible');

  return (
    <div className="min-w-0 flex-1">
      {showVerbose && (
        <div className={idRowClass}>
          <IdBadge>{stop.stop_id}</IdBadge>
          {stop.parent_station && <IdBadge>p:{stop.parent_station}</IdBadge>}
        </div>
      )}
      {info.isNormalEnabled && stopNames.subNames.length > 0 && (
        <p className={subNameClass}>{stopNames.subNames.join(' / ')}</p>
      )}
      <div className={mainRowClass}>
        <span className={routeTypeClass}>{routeTypesEmoji(routeTypes)}</span>
        <span className={nameClass}>{stopNames.name}</span>
        {stop.platform_code && <span className={platformCodeClass}>{stop.platform_code}</span>}
        {distanceBadge}
        {stop.wheelchair_boarding === 1 && (
          <span
            className={accessibilityClass}
            role="img"
            aria-label={wheelchairAccessibleLabel}
            title={wheelchairAccessibleLabel}
          >
            <Accessibility size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
          </span>
        )}
        {stop.wheelchair_boarding === 2 && (
          <span
            className={inaccessibleClass}
            role="img"
            aria-label={wheelchairNotAccessibleLabel}
            title={wheelchairNotAccessibleLabel}
          >
            <Accessibility size={14} strokeWidth={2} aria-hidden="true" focusable="false" />
          </span>
        )}
        {isDropOffOnly && <span className={dropOffClass}>{t('stop.dropOffOnly')}</span>}
        {agencies.length > 0 &&
          agencies.map((agency) => (
            <AgencyBadge
              key={agency.agency_id}
              agency={agency}
              infoLevel={infoLevel}
              size={resolvedAgencyBadgeSize}
              disableVerbose
            />
          ))}
      </div>
      {info.isDetailedEnabled && routes && routes.length > 0 && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {routes.map((route) => (
            <RouteBadge
              key={route.route_id}
              route={route}
              dataLang={dataLang}
              agencyLangs={resolveAgencyLang(agencies, route.agency_id)}
              infoLevel={infoLevel}
              size={resolvedRouteBadgeSize}
              disableVerbose
            />
          ))}
        </div>
      )}

      {showVerbose && (
        <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
          <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
            [META]
          </summary>
          <div className="mt-1 ml-2 space-y-1">
            <VerboseAgencies agencies={agencies} infoLevel={infoLevel} />
            <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
              <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
                [Stop]
              </summary>
              <div className="mt-1 overflow-x-auto rounded border border-dashed border-gray-300 p-1 whitespace-nowrap dark:border-gray-600">
                <VerboseStop stop={stop} isDropOffOnly={isDropOffOnly} />
              </div>
              <VerboseStopDisplayNames names={stopNames} />
            </details>
            <VerboseRoutes
              routes={routes ?? []}
              infoLevel={infoLevel}
              dataLang={dataLang}
              agencies={agencies}
            />
          </div>
        </details>
      )}
    </div>
  );
}
