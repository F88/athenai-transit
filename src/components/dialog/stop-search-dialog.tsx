import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { resolveStopRouteTypes } from '@/domain/transit/resolve-stop-route-types';
import { useListKeyboardNavigation } from '@/hooks/use-list-keyboard-navigation';
import { useStopSearchIndex } from '@/hooks/use-stop-search-index';
import { useStopSearchMeta } from '@/hooks/use-stop-search-meta';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { AppRouteTypeValue, Stop } from '@/types/app/transit';
import { katakanaToHiragana } from '@/utils/kana-normalize';
import { filterStopsByQuery } from '@/domain/transit/stop-search-index';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StopSearchInputSection } from '../search/stop-search-input-section';
import { StopSearchResultItem } from '../search/stop-search-result-item';

const MAX_RESULTS = 20;

interface StopSearchDialogProps {
  repo: TransitRepository;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /**
   * Reference point for distance / direction display in result rows. Pass
   * the current map center; null suppresses the distance badge.
   */
  mapCenter: LatLng | null;
  isStopAnchor?: (stopId: string) => boolean;
  onSelectStop: (stop: Stop, routeTypes: AppRouteTypeValue[]) => void;
  onToggleAnchor?: (stopId: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  onOpenTripInspectionByStopId?: (stopId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StopSearchDialog = memo(function StopSearchDialog({
  repo,
  infoLevel,
  dataLang,
  mapCenter,
  isStopAnchor,
  onSelectStop,
  onToggleAnchor,
  onShowStopTimetable,
  onOpenTripInspectionByStopId,
  open,
  onOpenChange,
}: StopSearchDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { searchIndex, routeTypeMap } = useStopSearchIndex(repo, open);

  // Auto-focus input on open.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setQuery('');
      }
    },
    [onOpenChange],
  );

  const filterResult = useMemo(
    () => filterStopsByQuery(searchIndex, query, MAX_RESULTS),
    [query, searchIndex],
  );
  const filteredStops = filterResult.stops;
  const totalMatches = filterResult.total;

  // Resolve agencies / routes / stats / geo for the current page of results
  // via a single batched lookup. Synchronous and cheap at ≤ MAX_RESULTS.
  const stopMetaMap = useStopSearchMeta(repo, filteredStops);

  const trimmedQuery = query.trim();
  const normalizedQuery = katakanaToHiragana(trimmedQuery.toLowerCase());

  // Resolve route types once per result set so the row render and the Enter /
  // click activation share the same lookup. `filteredStops` is capped at
  // `MAX_RESULTS`, so building this map per render is cheap.
  const resolvedRouteTypesByStop = useMemo(() => {
    const map = new Map<string, AppRouteTypeValue[]>();
    for (const stop of filteredStops) {
      map.set(
        stop.stop_id,
        resolveStopRouteTypes({
          stopId: stop.stop_id,
          routeTypeMap,
          routes: null,
          unknownPolicy: 'include-unknown',
        }),
      );
    }
    return map;
  }, [filteredStops, routeTypeMap]);

  const handleSelect = useCallback(
    (stop: Stop) => {
      const routeTypes =
        resolvedRouteTypesByStop.get(stop.stop_id) ??
        resolveStopRouteTypes({
          stopId: stop.stop_id,
          routeTypeMap,
          routes: null,
          unknownPolicy: 'include-unknown',
        });
      onSelectStop(stop, routeTypes);
    },
    [onSelectStop, resolvedRouteTypesByStop, routeTypeMap],
  );

  const { selectedIndex, handleInputKeyDown, registerItemRef } = useListKeyboardNavigation({
    items: filteredStops,
    onActivate: handleSelect,
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-12 flex max-h-[80dvh] max-w-[80vw] translate-y-0 flex-col gap-0 overflow-hidden border-4 p-0"
      >
        <DialogHeader className="border-border shrink-0 border-b p-4">
          <DialogTitle className="text-[15px]">{t('search.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('search.description')}</DialogDescription>
        </DialogHeader>
        <StopSearchInputSection
          inputRef={inputRef}
          placeholder={t('search.placeholder')}
          query={query}
          onQueryChange={setQuery}
          onInputKeyDown={handleInputKeyDown}
        />
        {filteredStops.length > 0 && (
          <div
            className="border-border text-muted-foreground shrink-0 border-b px-4 py-1.5 text-right text-xs"
            aria-live="polite"
          >
            {totalMatches > filteredStops.length
              ? t('search.resultCountTruncated', {
                  shown: filteredStops.length,
                  total: totalMatches,
                })
              : t('search.resultCount', { count: filteredStops.length })}
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {filteredStops.length > 0
            ? filteredStops.map((stop, index) => {
                const meta = stopMetaMap.get(stop.stop_id);
                return (
                  <StopSearchResultItem
                    key={stop.stop_id}
                    stop={stop}
                    routeTypes={resolvedRouteTypesByStop.get(stop.stop_id) ?? [-1]}
                    isAnchor={isStopAnchor?.(stop.stop_id) ?? false}
                    query={trimmedQuery}
                    normalizedQuery={normalizedQuery}
                    infoLevel={infoLevel}
                    dataLang={dataLang}
                    mapCenter={mapCenter}
                    agencies={meta?.agencies}
                    routes={meta?.routes}
                    stats={meta?.stats}
                    geo={meta?.geo}
                    isSelected={index === selectedIndex}
                    buttonRef={registerItemRef(index)}
                    onSelect={handleSelect}
                    onToggleAnchor={onToggleAnchor}
                    onShowStopTimetable={onShowStopTimetable}
                    onOpenTripInspectionByStopId={onOpenTripInspectionByStopId}
                  />
                );
              })
            : query.trim() !== '' && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                  {t('search.noResults')}
                </p>
              )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
