import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DEFAULT_AGENCY_LANG } from '@/config/transit-defaults';
import { getStopDisplayNames } from '@/domain/transit/get-stop-display-names';
import { resolveStopRouteTypes } from '@/domain/transit/resolve-stop-route-types';
import { useInfoLevel } from '@/hooks/use-info-level';
import { createLogger } from '@/lib/logger';
import type { TransitRepository } from '@/repositories/transit-repository';
import type { InfoLevel } from '@/types/app/settings';
import type { AppRouteTypeValue, Stop } from '@/types/app/transit';
import { katakanaToHiragana } from '@/utils/kana-normalize';
import { routeTypesEmoji } from '@/utils/route-type-emoji';
import {
  buildSearchIndexEntry,
  filterStopsByQuery,
  type SearchIndexEntry,
} from '@/utils/stop-search-index';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IdBadge } from '../badge/id-badge';
import { StopActionButtons } from '../stop-action-buttons';

const logger = createLogger('StopSearch');

const MAX_RESULTS = 20;

interface StopSearchResultItemProps {
  stop: Stop;
  routeTypes: AppRouteTypeValue[];
  isAnchor: boolean;
  query: string;
  normalizedQuery: string;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Whether this item is currently highlighted via keyboard navigation. */
  isSelected: boolean;
  /** Ref forwarded to the underlying button so the parent can scroll it into view. */
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: (stop: Stop) => void;
  onToggleAnchor?: (stopId: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  onOpenTripInspectionByStopId?: (stopId: string) => void;
}

function StopSearchResultItem({
  stop,
  routeTypes,
  isAnchor,
  query,
  normalizedQuery,
  infoLevel,
  dataLang,
  isSelected,
  buttonRef,
  onSelect,
  onToggleAnchor,
  onShowStopTimetable,
  onOpenTripInspectionByStopId,
}: StopSearchResultItemProps) {
  const info = useInfoLevel(infoLevel);
  // Always show subNames in search results for discoverability.
  //
  // We pass DEFAULT_AGENCY_LANG (not the agency-specific lang) on
  // purpose. `getStopDisplayNames`'s third argument only controls the
  // sort priority of the alternative names in `subNames`; it does not
  // affect the resolved primary `name` or the set of names that appear
  // in `subNames`. Search loads only `Stop[]` via `repo.getAllStops()`
  // and intentionally never pulls `StopWithMeta` / agencies for every
  // result, so we cannot call `resolveAgencyLang(agencies, ...)` here.
  // Doing so would require a parallel batch lookup just to influence
  // sub-name ordering, which is not worth the cost for a search list.
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
          <span className="text-foreground text-[15px]">
            {routeTypesEmoji(routeTypes)}{' '}
            <HighlightedName
              name={stopNames.name}
              query={query}
              normalizedQuery={normalizedQuery}
            />
          </span>
          {stopNames.subNames.length > 0 && (
            <span className="text-muted-foreground text-xs leading-snug">
              {stopNames.subNames.map((name, i) => (
                <span key={`${i}-${name}`}>
                  {i > 0 && ' / '}
                  <HighlightedName name={name} query={query} normalizedQuery={normalizedQuery} />
                </span>
              ))}
            </span>
          )}
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

function HighlightedName({
  name,
  query,
  normalizedQuery,
}: {
  name: string;
  query: string;
  normalizedQuery: string;
}) {
  if (!query) {
    return <>{name}</>;
  }

  // Try direct match first
  let idx = name.indexOf(query);
  let matchLen = query.length;

  // Fall back to case-insensitive match
  if (idx === -1) {
    idx = name.toLowerCase().indexOf(query.toLowerCase());
    matchLen = query.length;
  }

  // Fall back to normalized (kana) match — 1:1 char mapping preserves indices
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

interface StopSearchInputSectionProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

function StopSearchInputSection({
  inputRef,
  placeholder,
  query,
  onQueryChange,
  onInputKeyDown,
}: StopSearchInputSectionProps) {
  return (
    <div className="border-border shrink-0 border-b px-4 py-3">
      <input
        ref={inputRef}
        type="text"
        className="border-input bg-background focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2.5 text-base outline-none focus:ring-2"
        placeholder={placeholder}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onInputKeyDown}
      />
    </div>
  );
}

interface StopSearchDialogProps {
  repo: TransitRepository;
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
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
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[]>([]);
  const [routeTypeMap, setRouteTypeMap] = useState<Map<string, AppRouteTypeValue[]>>(
    () => new Map(),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Tracks which repo instance the searchIndex / routeTypeMap were built for.
  // Lets us skip the rebuild when the dialog is reopened against the same repo.
  // Updated only after both async loads finish so we never short-circuit on
  // partially-loaded state from a cancelled run.
  const builtForRepoRef = useRef<TransitRepository | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (builtForRepoRef.current === repo) {
      return;
    }
    let cancelled = false;

    repo
      .getAllStops()
      .then((result) => {
        if (cancelled || !result.success) {
          return;
        }
        // Pre-build the search index so the per-keystroke filter only does
        // single-string `includes` calls, not repeated `katakanaToHiragana`
        // normalization in the hot loop.
        const index = result.data.map(buildSearchIndexEntry);
        setSearchIndex(index);

        // Batch-fetch route types for all stops
        return Promise.all(
          result.data.map(async (stop) => {
            const rtResult = await repo.getRouteTypesForStop(stop.stop_id);
            const routeTypes = rtResult.success ? rtResult.data : [-1 as const];
            return [stop.stop_id, routeTypes] as const;
          }),
        ).then((entries) => {
          if (!cancelled) {
            setRouteTypeMap(new Map(entries));
            builtForRepoRef.current = repo;
          }
        });
      })
      .catch((error) => {
        logger.error('Failed to load stops for search:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [repo, open]);

  // Auto-focus input on open
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
        setSelectedIndex(0);
      }
    },
    [onOpenChange],
  );

  const filteredStops = useMemo(
    () => filterStopsByQuery(searchIndex, query, MAX_RESULTS),
    [query, searchIndex],
  );

  const trimmedQuery = query.trim();
  const normalizedQuery = katakanaToHiragana(trimmedQuery.toLowerCase());

  // Reset highlight to the first row whenever the result set changes so the
  // user can press Enter immediately after typing. We use the official
  // React 19 "store info from previous renders" pattern: comparing the
  // memoised filteredStops identity in render and updating state inline,
  // rather than running a setState inside useEffect (which is now lint-banned).
  // Stale entries in itemRefs.current are cleared automatically: callback
  // refs of unmounted rows are invoked with null on the next commit.
  const [lastFilteredStops, setLastFilteredStops] = useState(filteredStops);
  if (lastFilteredStops !== filteredStops) {
    setLastFilteredStops(filteredStops);
    setSelectedIndex(0);
  }

  // Scroll the highlighted row into view whenever the selection changes or
  // the result set is replaced. The `filteredStops` dep covers the case
  // where the user has manually scrolled the list away from the highlighted
  // row and then types more — `selectedIndex` may already be 0 (so React's
  // setState bailout suppresses the selection effect on its own), but we
  // still want the new top row to be visible.
  // `block: 'nearest'` keeps the row visible without jumping the list around
  // when the row is already on screen.
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, filteredStops]);

  const handleSelect = useCallback(
    (stop: Stop) => {
      onSelectStop(
        stop,
        resolveStopRouteTypes({
          stopId: stop.stop_id,
          routeTypeMap,
          routes: null,
          unknownPolicy: 'include-unknown',
        }),
      );
    },
    [onSelectStop, routeTypeMap],
  );

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      // Skip while IME composition is in progress so the Enter that confirms
      // the conversion does not also pick a result.
      if (event.nativeEvent.isComposing) {
        return;
      }
      if (filteredStops.length === 0) {
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, filteredStops.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const target = filteredStops[selectedIndex] ?? filteredStops[0];
        if (target) {
          handleSelect(target);
        }
      }
    },
    [filteredStops, selectedIndex, handleSelect],
  );

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
        <div className="flex-1 overflow-y-auto">
          {filteredStops.length > 0
            ? filteredStops.map((stop, index) => (
                <StopSearchResultItem
                  key={stop.stop_id}
                  stop={stop}
                  routeTypes={resolveStopRouteTypes({
                    stopId: stop.stop_id,
                    routeTypeMap,
                    routes: null,
                    unknownPolicy: 'include-unknown',
                  })}
                  isAnchor={isStopAnchor?.(stop.stop_id) ?? false}
                  query={trimmedQuery}
                  normalizedQuery={normalizedQuery}
                  infoLevel={infoLevel}
                  dataLang={dataLang}
                  isSelected={index === selectedIndex}
                  buttonRef={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onSelect={handleSelect}
                  onToggleAnchor={onToggleAnchor}
                  onShowStopTimetable={onShowStopTimetable}
                  onOpenTripInspectionByStopId={onOpenTripInspectionByStopId}
                />
              ))
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
