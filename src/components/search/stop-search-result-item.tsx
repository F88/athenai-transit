import { DistanceBadge } from '@/components/badge/distance-badge';
import { IdBadge } from '@/components/badge/id-badge';
import { StopActionButtons } from '@/components/stop-action-buttons';
import { DEFAULT_AGENCY_LANG } from '@/config/transit-defaults';
import { bearingDeg, distanceM } from '@/domain/transit/distance';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { useInfoLevel } from '@/hooks/use-info-level';
import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { AppRouteTypeValue, Stop } from '@/types/app/transit';
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
  // Always show subNames in search results for discoverability.
  //
  // We pass DEFAULT_AGENCY_LANG (not the agency-specific lang) on purpose.
  // `getStopDisplayNames`'s third argument only controls the sort priority
  // of the alternative names in `subNames`; it does not affect the resolved
  // primary `name` or the set of names that appear in `subNames`. Search
  // loads only `Stop[]` via `repo.getAllStops()` and intentionally never
  // pulls `StopWithMeta` / agencies for every result, so we cannot call
  // `resolveAgencyLang(agencies, ...)` here. Doing so would require a
  // parallel batch lookup just to influence sub-name ordering, which is
  // not worth the cost for a search list.
  const stopNames = getStopDisplayNames(stop, dataLang, DEFAULT_AGENCY_LANG);

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
            {showDistance && (
              <DistanceBadge meters={distanceRounded} bearingDeg={bearing} showDirection />
            )}
          </span>
        </div>
      </button>
      <StopActionButtons
        stopId={stop.stop_id}
        isAnchor={isAnchor}
        layout="horizontal"
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
