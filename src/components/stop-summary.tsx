import type { ReactNode } from 'react';
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
import { AccessibilityLabel } from './stop/accessibility-label';
import { PlatformCodeLabel } from './stop/platform-code-label';
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
  const info = useInfoLevel(infoLevel);
  const showVerbose = infoLevel === 'verbose';
  const stopNames = getStopDisplayNames(
    stop,
    dataLangs,
    resolveAgencyLang(agencies, stop.agency_id),
  );

  const idRowClass = 'mb-1 flex gap-1';
  const mainRowClass = 'm-0 flex flex-wrap items-center gap-1 text-xl font-semibold';
  const routeTypeClass = 'mr-1';
  const stopNameClass = 'text-info';
  const stopSubNamesClass = 'm-0 mb-0.5 text-xs font-normal text-[#888] dark:text-gray-400';

  return (
    <div className="min-w-0 flex-1">
      {showVerbose && (
        <div className={idRowClass}>
          <IdBadge>{stop.stop_id}</IdBadge>
          {stop.parent_station && <IdBadge>p:{stop.parent_station}</IdBadge>}
        </div>
      )}

      {/* Stop sub names */}
      {info.isNormalEnabled && stopNames.subNames.length > 0 && (
        <p className={stopSubNamesClass}>{stopNames.subNames.join(' / ')}</p>
      )}

      <div className={mainRowClass}>
        {/* Route types */}
        {showRouteTypes && <span className={routeTypeClass}>{routeTypesEmoji(routeTypes)}</span>}
        {/* Stop name */}
        <span className={stopNameClass}>{stopNames.name}</span>
        {/* <span>{stopNames.name}</span> */}
        {/* Platform code */}
        {stop.platform_code && <PlatformCodeLabel code={stop.platform_code} size="sm" />}
        {/* Distance badge */}
        <span className="ml-2">{distanceBadge}</span>
        {/* Accessibility */}
        <AccessibilityLabel wheelchairBoarding={stop.wheelchair_boarding} size="sm" />
        {stopServiceState && (
          <StopServiceStateLabel stopServiceState={stopServiceState} size="sm" />
        )}
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
