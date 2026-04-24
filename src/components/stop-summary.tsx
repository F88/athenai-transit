import { Accessibility } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveAgencyLang } from '../config/transit-defaults';
import { getStopDisplayNames } from '../domain/transit/get-stop-display-names';
import { useInfoLevel } from '../hooks/use-info-level';
import type { InfoLevel } from '../types/app/settings';
import type {
  Agency,
  AppRouteTypeValue,
  Route,
  Stop,
  StopServiceState,
} from '../types/app/transit';
import { routeTypesEmoji } from '../utils/route-type-emoji';
import { AgencyBadge, type AgencyBadgeSize } from './badge/agency-badge';
import { IdBadge } from './badge/id-badge';
import { RouteBadge, type RouteBadgeSize } from './badge/route-badge';
import { StopServiceStateLabel } from './label/stop-service-state-label';
import { VerboseAgencies } from './verbose/verbose-agencies';
import { VerboseRoutes } from './verbose/verbose-routes';
import { VerboseStop } from './verbose/verbose-stop';
import { VerboseStopDisplayNames } from './verbose/verbose-stop-display-names';

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
  /** Whether to render agency badges in the main summary row. */
  showAgencies: boolean;
  /** Route types served by the stop, rendered as the lead emoji. */
  routeTypes: AppRouteTypeValue[];
  /** Whether to render route type emoji before the stop name. */
  showRouteTypes: boolean;
  /** Routes to render as badges in detailed mode. */
  routes?: Route[];
  /** Whether to render route badges in detailed mode. */
  showRoutes: boolean;
  /** Stop to display. */
  stop: Stop;
  /** Active information density level. */
  infoLevel: InfoLevel;
  /** Display language fallback chain for translated names. */
  dataLangs: readonly string[];
  /** Service state of the stop on the current service day. */
  stopServiceState?: StopServiceState;
  /** Badge size for agency badges. */
  agencyBadgeSize: AgencyBadgeSize;
  /** Badge size for route badges. */
  routeBadgeSize: RouteBadgeSize;
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
  showAgencies,
  routeTypes,
  showRouteTypes,
  routes,
  showRoutes,
  stop,
  infoLevel,
  dataLangs,
  stopServiceState,
  agencyBadgeSize,
  routeBadgeSize,
  distanceBadge,
}: StopSummaryProps) {
  const { t } = useTranslation();
  const info = useInfoLevel(infoLevel);
  const showVerbose = infoLevel === 'verbose';
  const stopNames = getStopDisplayNames(
    stop,
    dataLangs,
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
  const wheelchairAccessibleLabel = t('stop.accessibility.wheelchairAccessible');
  const wheelchairNotAccessibleLabel = t('stop.accessibility.wheelchairNotAccessible');

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
        {showRouteTypes && <span className={routeTypeClass}>{routeTypesEmoji(routeTypes)}</span>}
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
        {stopServiceState && <StopServiceStateLabel stopServiceState={stopServiceState} />}
        {showAgencies &&
          agencies.length > 0 &&
          agencies.map((agency) => (
            <AgencyBadge
              key={agency.agency_id}
              agency={agency}
              size={agencyBadgeSize}
              dataLang={dataLangs}
              agencyLangs={resolveAgencyLang(agencies, agency.agency_id)}
              infoLevel={infoLevel}
              showBorder={true}
            />
          ))}
      </div>
      {showRoutes && info.isDetailedEnabled && routes && routes.length > 0 && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {routes.map((route) => (
            <RouteBadge
              key={route.route_id}
              route={route}
              dataLang={dataLangs}
              agencyLangs={resolveAgencyLang(agencies, route.agency_id)}
              infoLevel={infoLevel}
              size={routeBadgeSize}
              showBorder={true}
            />
          ))}
        </div>
      )}

      {showVerbose && (
        <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
          <summary
            tabIndex={-1}
            className="cursor-pointer select-none"
            onClick={(e) => e.stopPropagation()}
          >
            [META]
          </summary>
          <div className="mt-1 ml-2 space-y-1">
            <VerboseAgencies agencies={agencies} infoLevel={infoLevel} dataLang={dataLangs} />
            <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
              <summary
                tabIndex={-1}
                className="cursor-pointer select-none"
                onClick={(e) => e.stopPropagation()}
              >
                [Stop]
              </summary>
              <div className="border-app-neutral mt-1 overflow-x-auto rounded border border-dashed p-1 whitespace-nowrap">
                <VerboseStop stop={stop} serviceState={stopServiceState} />
              </div>
              <VerboseStopDisplayNames names={stopNames} />
            </details>
            <VerboseRoutes
              routes={routes ?? []}
              infoLevel={infoLevel}
              dataLang={dataLangs}
              agencies={agencies}
            />
          </div>
        </details>
      )}
    </div>
  );
}
