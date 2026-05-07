import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { resolveStopRouteTypes } from '@/domain/transit/resolve-stop-route-types';
import { filterStopsByQuery, normalizeForSearch } from '@/domain/transit/stop-search-index';
import { useListKeyboardNavigation } from '@/hooks/use-list-keyboard-navigation';
import { useStopSearchIndex } from '@/hooks/use-stop-search-index';
import { useStopSearchMeta } from '@/hooks/use-stop-search-meta';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { AppRouteTypeValue, Stop } from '@/types/app/transit';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StopSearchInputSection } from '../search/stop-search-input-section';
import { StopSearchResultItem } from '../search/stop-search-result-item';

const PAGE_SIZE = 30;

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
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  // Decouple input echo from the heavier filter / highlight / meta-lookup
  // pipeline. The input updates synchronously while filtering runs at a
  // lower priority — under bursty typing React drops intermediate pipeline
  // runs and only commits the latest one.
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // How many ranked matches to surface. Starts at PAGE_SIZE; the bottom
  // sentinel below grows it by another PAGE_SIZE whenever it scrolls into
  // view, so the result list pages itself in. Resets to PAGE_SIZE whenever
  // the deferred query changes — a new search always starts on the first
  // page. The reset uses the React-recommended "adjusting state on prop
  // change" pattern (compare with previous value during render) so we do
  // not commit a render with stale paging.
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const [prevDeferredQuery, setPrevDeferredQuery] = useState(deferredQuery);
  if (deferredQuery !== prevDeferredQuery) {
    setPrevDeferredQuery(deferredQuery);
    setDisplayLimit(PAGE_SIZE);
  }

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

  // Pin the scroll position back to the top whenever the deferred query
  // changes, so the bottom sentinel does not immediately re-fire from a
  // residual scroll offset left over from the previous (longer) result
  // list. State (`displayLimit`) reset is handled via the during-render
  // compare above; this effect only handles DOM mutation.
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [deferredQuery]);

  const filterResult = useMemo(
    () => filterStopsByQuery(searchIndex, deferredQuery, displayLimit),
    [deferredQuery, searchIndex, displayLimit],
  );
  const filteredStops = filterResult.stops;
  const totalMatches = filterResult.total;
  const canLoadMore = totalMatches > filteredStops.length;

  // Auto-load the next page when the bottom sentinel scrolls into view.
  // Using the scroll container itself as the IntersectionObserver `root`
  // (instead of the document viewport) is necessary because the result
  // list scrolls inside the dialog — the document viewport would always
  // see the sentinel as "not clipped" and never report it intersecting.
  useEffect(() => {
    if (!canLoadMore) {
      return;
    }
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setDisplayLimit((prev) => prev + PAGE_SIZE);
          }
        }
      },
      { root, rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore]);

  // Resolve agencies / routes / stats / geo for the current page of results
  // via a single batched lookup. Synchronous and cheap at ≤ MAX_RESULTS.
  const stopMetaMap = useStopSearchMeta(repo, filteredStops);

  // Highlight / no-results use the deferred value so the rendered list and
  // the marks inside it always describe the same query.
  const trimmedQuery = deferredQuery.trim();
  const normalizedQuery = normalizeForSearch(trimmedQuery);

  // Resolve route types once per result set so the row render and the Enter /
  // click activation share the same lookup. `filteredStops` is capped at
  // the current `displayLimit`, so building this map per render is cheap.
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
    // Stable identity for the current logical search. Reset selection only
    // when the actual query changes — pagination growing `filteredStops`
    // must not yank the highlight (and the scroll) back to the first row.
    resetKey: deferredQuery,
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
                  shown: filteredStops.length.toLocaleString(i18n.language),
                  total: totalMatches.toLocaleString(i18n.language),
                })
              : t('search.resultCount', {
                  count: filteredStops.length.toLocaleString(i18n.language),
                })}
          </div>
        )}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
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
            : trimmedQuery !== '' && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                  {t('search.noResults')}
                </p>
              )}
          {canLoadMore && <div ref={sentinelRef} aria-hidden="true" className="h-4" />}
        </div>
      </DialogContent>
    </Dialog>
  );
});
