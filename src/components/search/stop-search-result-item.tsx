import { AgencyBadge } from '@/components/badge/agency-badge';
import { DistanceBadge } from '@/components/badge/distance-badge';
import { IdBadge } from '@/components/badge/id-badge';
import { RouteBadge } from '@/components/badge/route-badge';
import { StopActionButtons } from '@/components/stop-action-buttons';
import { StopMetrics } from '@/components/stop-metrics';
import { DEFAULT_AGENCY_LANG, resolveAgencyLang } from '@/config/transit-defaults';
import { bearingDeg, distanceM } from '@/domain/transit/distance';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { useInfoLevel } from '@/hooks/use-info-level';
import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { Agency, AppRouteTypeValue, Route, Stop } from '@/types/app/transit';
import type { StopWithMeta } from '@/types/app/transit-composed';
import { katakanaToHiragana } from '@/utils/kana-normalize';
import { routeTypesEmoji } from '@/utils/route-type-emoji';
import { AccessibilityLabel } from '../stop/accessibility-label';
import { PlatformCodeLabel } from '../stop/platform-code-label';

interface HighlightedNameProps {
  name: string;
  query: string;
  normalizedQuery: string;
}

/**
 * Renders `name` with the matched substring wrapped in `<mark>`.
 *
 * Match precedence mirrors {@link filterStopsByQuery}:
 *   1. direct substring,
 *   2. case-insensitive substring,
 *   3. lower-cased + katakana→hiragana normalized substring (1:1 char mapping
 *      preserves indices, so the highlight aligns with the original `name`).
 */
function HighlightedName({ name, query, normalizedQuery }: HighlightedNameProps) {
  if (!query) {
    return <>{name}</>;
  }

  let idx = name.indexOf(query);
  let matchLen = query.length;

  if (idx === -1) {
    idx = name.toLowerCase().indexOf(query.toLowerCase());
    matchLen = query.length;
  }

  if (idx === -1 && normalizedQuery) {
    idx = katakanaToHiragana(name.toLowerCase()).indexOf(normalizedQuery);
    matchLen = normalizedQuery.length;
  }

  if (idx === -1) {
    return <>{name}</>;
  }

  return (
    <>
      {name.slice(0, idx)}
      <mark className="rounded-sm bg-[#fff9c4] px-px text-inherit dark:bg-yellow-800">
        {name.slice(idx, idx + matchLen)}
      </mark>
      {name.slice(idx + matchLen)}
    </>
  );
}

export interface StopSearchResultItemProps {
  stop: Stop;
  routeTypes: AppRouteTypeValue[];
  isAnchor: boolean;
  query: string;
  normalizedQuery: string;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /**
   * Reference point for distance / direction display (typically the current
   * map center). When null, the {@link DistanceBadge} is suppressed.
   */
  mapCenter: LatLng | null;
  /**
   * Agencies operating routes at this stop, resolved via
   * {@link useStopSearchMeta}. Empty array when meta has not been loaded yet
   * or when the stop has no associated agencies.
   */
  agencies?: Agency[];
  /**
   * Routes serving this stop, resolved via {@link useStopSearchMeta}.
   * Rendered as badges in `detailed+` info levels only.
   */
  routes?: Route[];
  /** Per-stop operational statistics (InsightsBundle). */
  stats?: StopWithMeta['stats'];
  /** Geographic indicators (GlobalInsightsBundle). */
  geo?: StopWithMeta['geo'];
  /** Whether this item is currently highlighted via keyboard navigation. */
  isSelected: boolean;
  /** Ref forwarded to the underlying button so the parent can scroll it into view. */
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: (stop: Stop) => void;
  onToggleAnchor?: (stopId: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  onOpenTripInspectionByStopId?: (stopId: string) => void;
}

/**
 * One row in the stop search result list.
 *
 * The action buttons (anchor / timetable / trip inspection) are always shown;
 * they are disabled or hidden by callers via the corresponding callback props.
 */
export function StopSearchResultItem({
  stop,
  routeTypes,
  isAnchor,
  query,
  normalizedQuery,
  infoLevel,
  dataLang,
  mapCenter,
  agencies,
  routes,
  stats,
  geo,
  isSelected,
  buttonRef,
  onSelect,
  onToggleAnchor,
  onShowStopTimetable,
  onOpenTripInspectionByStopId,
}: StopSearchResultItemProps) {
  const info = useInfoLevel(infoLevel);
  // Suppress sub-10m noise to match the StopInfo / StopSummary convention:
  // a "0m" / "3m" badge is just visual jitter when the user is effectively
  // standing on the stop already.
  const distanceRounded = mapCenter ? Math.round(distanceM(mapCenter, stop)) : null;
  const showDistance = distanceRounded != null && distanceRounded >= 10;
  const bearing = mapCenter ? bearingDeg(mapCenter, stop) : null;
  // Display-name resolution. When agencies (from useStopSearchMeta) are
  // available we use the matching agency's lang to bias subName ordering,
  // matching StopSummary's behavior. Otherwise we fall back to the default
  // — search opens before getStopMetaByIds is called for this stop, and the
  // first paint should still resolve a reasonable primary name.
  const agencyLangsForDisplay = agencies
    ? resolveAgencyLang(agencies, stop.agency_id)
    : DEFAULT_AGENCY_LANG;
  const stopNames = getStopDisplayNames(stop, dataLang, agencyLangsForDisplay);

  return (
    <div
      className={`border-border flex items-stretch gap-2 border-t-0 border-r-0 border-b border-l-0 px-4 py-3 last:border-b-0 ${
        isSelected ? 'bg-accent' : 'bg-transparent'
      }`}
    >
      <button
        ref={buttonRef}
        className="active:bg-accent flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left font-[inherit]"
        onClick={() => onSelect(stop)}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          {info.isVerboseEnabled && <IdBadge>{stop.stop_id}</IdBadge>}

          {/* Distance badge */}
          {info.isNormalEnabled && showDistance && (
            <DistanceBadge
              meters={distanceRounded}
              bearingDeg={bearing}
              showDirection
              size="md"
              // size="xl"
            />
          )}

          {stopNames.subNames.length > 0 && (
            <span className="text-muted-foreground text-[10px] leading-snug">
              {stopNames.subNames.map((name, i) => (
                <span key={`${i}-${name}`}>
                  {i > 0 && ' / '}
                  <HighlightedName name={name} query={query} normalizedQuery={normalizedQuery} />
                </span>
              ))}
            </span>
          )}
          <span className="text-foreground flex flex-wrap items-center gap-x-1 text-[16px]">
            <span>
              {routeTypesEmoji(routeTypes)}{' '}
              <HighlightedName
                name={stopNames.name}
                query={query}
                normalizedQuery={normalizedQuery}
              />
            </span>
            {/* Platform code */}
            {stop.platform_code && <PlatformCodeLabel code={stop.platform_code} size={'sm'} />}
            {/* Wheelchair accessibility */}
            <AccessibilityLabel wheelchairBoarding={stop.wheelchair_boarding} size="sm" />

            {/* Agency badges */}
            {agencies &&
              agencies.length > 0 &&
              agencies.map((agency) => (
                <AgencyBadge
                  key={agency.agency_id}
                  agency={agency}
                  size="sm"
                  dataLang={dataLang}
                  agencyLangs={resolveAgencyLang(agencies, agency.agency_id)}
                  infoLevel={infoLevel}
                  showBorder
                />
              ))}
          </span>
          {/* Route badges row (detailed+) */}
          {info.isDetailedEnabled && routes && routes.length > 0 && agencies && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {routes.map((route) => (
                <RouteBadge
                  key={route.route_id}
                  route={route}
                  dataLang={dataLang}
                  agencyLangs={resolveAgencyLang(agencies, route.agency_id)}
                  infoLevel={infoLevel}
                  size="xs"
                  showBorder
                />
              ))}
            </div>
          )}
          {/* Insights metrics (normal+) */}
          {info.isDetailedEnabled && (stats || geo) && (
            <StopMetrics stats={stats} geo={geo} infoLevel={infoLevel} />
          )}
        </div>
      </button>
      <StopActionButtons
        stopId={stop.stop_id}
        isAnchor={isAnchor}
        layout={info.isNormalEnabled ? 'vertical' : 'horizontal'}
        onToggleAnchor={onToggleAnchor}
        onShowStopTimetable={onShowStopTimetable}
        onOpenTripInspectionByStopId={onOpenTripInspectionByStopId}
        showAnchorButton
        showStopTimetableButton
        showTripInspectionButton
      />
    </div>
  );
}
